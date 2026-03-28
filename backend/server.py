from fastapi import FastAPI, APIRouter, File, UploadFile, HTTPException, Depends, Form, Body, status
from fastapi.responses import StreamingResponse
import csv
import io as stdlib_io
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials, OAuth2PasswordBearer, OAuth2PasswordRequestForm
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timezone, timedelta
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from starlette.requests import Request
import os
from typing import List, Optional
from pydantic import BaseModel, Field, EmailStr
from motor.motor_asyncio import AsyncIOMotorClient
import logging
from pathlib import Path
import uuid
import json
import asyncio
import aiofiles
import base64
from PIL import Image
import io
from contextlib import asynccontextmanager
from receipt_processor import ReceiptProcessor
import re
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from dotenv import load_dotenv
import google.generativeai as genai
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGODB_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DATABASE_NAME', 'rupeeflow')]

# JWT settings
SECRET_KEY = os.environ.get("SECRET_KEY", "your-secret-key")  # Update in production
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Gemini API Configuration
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GEMINI_MODEL_NAME = os.environ.get("GEMINI_MODEL")
gemini_model = None
gemini_model_name_in_use = None

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
else:
    logging.warning("GEMINI_API_KEY not found in environment variables. Advanced AI features will be disabled.")


def _create_gemini_model(model_name: str):
    name = (model_name or "").strip()
    if not name:
        raise ValueError("Empty model name")
    if name.startswith("models/"):
        stripped = name[len("models/"):]
    else:
        stripped = name
    try:
        return genai.GenerativeModel(stripped), stripped
    except Exception:
        return genai.GenerativeModel(name), name


def _pick_supported_gemini_model_name() -> str:
    preferred = [
        "gemini-flash-latest",
        "gemini-pro-latest",
        "gemini-2.5-pro",
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-pro",
    ]
    models = list(genai.list_models())
    supported = []
    for m in models:
        methods = getattr(m, "supported_generation_methods", []) or []
        if "generateContent" in methods:
            supported.append(m.name)

    for pref in preferred:
        for name in supported:
            if pref in name:
                return name

    if supported:
        return supported[0]

    raise RuntimeError("No Gemini models available that support generateContent")


def ensure_gemini_model():
    global gemini_model, gemini_model_name_in_use
    if gemini_model is not None:
        return
    if not GEMINI_API_KEY:
        return

    configured = (GEMINI_MODEL_NAME or "").strip()
    try:
        if configured:
            lookup_name = configured if configured.startswith("models/") else f"models/{configured}"
            model_info = genai.get_model(lookup_name)
            methods = getattr(model_info, "supported_generation_methods", []) or []
            if "generateContent" not in methods:
                raise RuntimeError(f"Model does not support generateContent: {lookup_name}")
            gemini_model, gemini_model_name_in_use = _create_gemini_model(lookup_name)
            logging.info(f"Using configured Gemini model: {gemini_model_name_in_use}")
            return
    except Exception as e:
        logging.error(f"Configured GEMINI_MODEL failed: {configured}. Error: {str(e)}")

    try:
        picked = _pick_supported_gemini_model_name()
        gemini_model, gemini_model_name_in_use = _create_gemini_model(picked)
        logging.info(f"Auto-selected Gemini model: {gemini_model_name_in_use}")
    except Exception as e:
        logging.error(f"Failed to auto-select Gemini model: {str(e)}")
        gemini_model = None
        gemini_model_name_in_use = None

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

# Models
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    user_id: Optional[str] = None

class UserBase(BaseModel):
    email: EmailStr
    full_name: str

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: str

class UserInDB(User):
    hashed_password: str

class ExpenseBase(BaseModel):
    title: str
    amount: float
    date: str
    category: str
    description: Optional[str] = None
    receipt_url: Optional[str] = None
    user_id: str
    # Additional extracted data from receipt processing
    merchant: Optional[str] = None
    items: Optional[List[dict]] = None
    raw_text: Optional[str] = None
    category_confidence: Optional[str] = None
    category_reason: Optional[str] = None
    extracted_date: Optional[str] = None
    needs_confirmation: Optional[bool] = False
    # Multi-currency fields
    original_currency: Optional[str] = "INR"
    original_amount: Optional[float] = None
    exchange_rate: Optional[float] = 1.0

class ExpenseCreate(ExpenseBase):
    pass

class Expense(ExpenseBase):
    id: str

# Budget Models
class BudgetBase(BaseModel):
    category: str
    amount: float  # Budget limit
    period: str = "monthly"  # monthly, weekly, yearly

class BudgetCreate(BudgetBase):
    pass

class BudgetModel(BudgetBase):
    id: str
    user_id: str
    spent: float = 0.0  # Computed field

# Goal Models
class GoalBase(BaseModel):
    title: str
    target_amount: float
    target_date: Optional[str] = None
    color: str = "indigo" # for UI gamification
    icon: str = "💰"

class GoalCreate(GoalBase):
    pass

class GoalModel(GoalBase):
    id: str
    user_id: str
    current_amount: float = 0.0

# Recurring Expense Models
class RecurringBase(BaseModel):
    title: str
    amount: float
    category: str
    frequency: str  # daily, weekly, monthly, yearly
    next_date: str
    description: Optional[str] = None
    is_active: bool = True

class RecurringCreate(RecurringBase):
    pass

class RecurringExpenseModel(RecurringBase):
    id: str
    user_id: str

# Income Models
class IncomeBase(BaseModel):
    title: str
    amount: float
    date: str
    source: str  # Salary, Freelance, Business, Investment, Gift, Other
    description: Optional[str] = None
    is_recurring: bool = False
    frequency: Optional[str] = None  # monthly, weekly, etc.

class IncomeCreate(IncomeBase):
    pass

class IncomeModel(IncomeBase):
    id: str
    user_id: str

# Expense Update Model
class ExpenseUpdate(BaseModel):
    title: Optional[str] = None
    amount: Optional[float] = None
    date: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    merchant: Optional[str] = None
    notes: Optional[str] = None
    original_currency: Optional[str] = None

# Group Models
class GroupBase(BaseModel):
    name: str
    description: Optional[str] = None
    currency: str = "INR"

class GroupCreate(GroupBase):
    pass

class GroupModel(GroupBase):
    id: str
    admin_id: str
    members: List[str] = [] # User IDs
    invite_code: str
    created_at: str

# Helper functions for MongoDB
def parse_from_mongo(obj):
    """Parse MongoDB object to remove _id"""
    if isinstance(obj, dict):
        obj.pop('_id', None)
        return obj
    return obj

def prepare_for_mongo(obj):
    """Prepare object for MongoDB insertion"""
    if isinstance(obj, dict):
        if 'id' not in obj:
            obj['id'] = str(uuid.uuid4())
        return obj
    return obj

# Currency Cache System
class CurrencyCache:
    def __init__(self):
        self.rates = {}
        self.last_updated = None
        self.base = "INR"

    async def get_rates(self):
        now = datetime.now()
        if not self.rates or not self.last_updated or (now - self.last_updated) > timedelta(hours=12):
            try:
                # Using Frankfurter API (Free, no key required)
                async with httpx.AsyncClient() as client:
                    response = await client.get("https://api.frankfurter.app/latest?from=INR")
                    if response.status_code == 200:
                        data = response.json()
                        self.rates = data.get("rates", {})
                        self.rates["INR"] = 1.0
                        self.last_updated = now
                        logging.info("Exchange rates updated successfully.")
            except Exception as e:
                logging.error(f"Failed to update exchange rates: {e}")
                # Fallback rates if API fails
                if not self.rates:
                    self.rates = {"USD": 0.012, "EUR": 0.011, "GBP": 0.009, "INR": 1.0}
        return self.rates

currency_cache = CurrencyCache()

# Create router with /api prefix
api_router = APIRouter(prefix="/api")

@api_router.get("/currency/rates")
async def get_currency_rates():
    rates = await currency_cache.get_rates()
    return {"base": "INR", "rates": rates, "last_updated": currency_cache.last_updated}

async def convert_to_inr(amount: float, from_currency: str):
    if from_currency == "INR":
        return amount, 1.0
    
    rates = await currency_cache.get_rates()
    # Frankfurter gives rates relative to base (INR)
    # So if USD rate is 0.012, then 1 INR = 0.012 USD
    # To get 1 USD in INR: 1 / 0.012
    rate_to_inr = rates.get(from_currency)
    
    if not rate_to_inr:
        return amount, 1.0 # Fallback to 1:1 if currency not found
        
    actual_rate = 1.0 / rate_to_inr
    return amount * actual_rate, actual_rate

def format_currency_inr(amount):
    """Format amount as INR currency string"""
    try:
        return f"₹{float(amount):,.2f}"
    except (ValueError, TypeError):
        return f"₹{amount}"

# Security Functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expires = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expires})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    # Auth bypass for development
    if token == "mock-token":
        return User(id="dev-user", email="dev@rupeeflow.com", full_name="Development User")
        
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = await db.users.find_one({"id": user_id})
    if user is None:
        raise credentials_exception
    return User(**parse_from_mongo(user))

# MongoDB connection verification
async def verify_db_connection():
    try:
        await client.admin.command('ping')
        logging.info("Successfully connected to MongoDB")
    except Exception as e:
        logging.error(f"Failed to connect to MongoDB: {e}")
        raise

def get_next_date(current_date_str, freq):
    from datetime import datetime, timedelta
    dt = datetime.strptime(current_date_str, "%Y-%m-%d")
    if freq == "daily":
        dt += timedelta(days=1)
    elif freq == "weekly":
        dt += timedelta(days=7)
    elif freq == "monthly":
        # Simple approximation for monthly/yearly
        dt += timedelta(days=30)
    elif freq == "yearly":
        dt += timedelta(days=365)
    return dt.strftime("%Y-%m-%d")

import asyncio

async def recurring_expense_worker():
    while True:
        try:
            from datetime import datetime
            today_str = datetime.now().strftime("%Y-%m-%d")
            cursor = db.recurring.find({"is_active": True, "next_date": {"$lte": today_str}})
            async for item in cursor:
                expense_dict = {
                    "id": str(uuid.uuid4()),
                    "title": item["title"],
                    "amount": float(item["amount"]),
                    "date": item["next_date"], # Log on the date it was due
                    "category": item["category"],
                    "description": item.get("description", f"Auto-logged recurring: {item['title']}"),
                    "user_id": item["user_id"],
                    "merchant": item["title"],
                    "needs_confirmation": False,
                    "original_currency": "INR",
                    "original_amount": float(item["amount"]),
                    "exchange_rate": 1.0,
                }
                # Insert expense into main transactions
                await db.expenses.insert_one(prepare_for_mongo(expense_dict))
                
                # Advance date
                new_next_date = get_next_date(item["next_date"], item.get("frequency", "monthly"))
                # If still in past (e.g. app was off for days), loop until it's future
                while new_next_date <= today_str:
                    new_next_date = get_next_date(new_next_date, item.get("frequency", "monthly"))
                
                await db.recurring.update_one(
                    {"id": item["id"]},
                    {"$set": {"next_date": new_next_date}}
                )
        except Exception as e:
            logging.error(f"Recurring worker error: {e}")
            
        await asyncio.sleep(3600)  # Check every hour

# App Lifespan
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Verify MongoDB connection on startup
    await verify_db_connection()
    # Start recurring worker
    worker_task = asyncio.create_task(recurring_expense_worker())
    yield
    # Cleanup on shutdown
    worker_task.cancel()
    client.close()

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="AI Expense Tracker", description="Smart expense tracking with AI categorization and receipt OCR", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    allow_origin_regex=None,
    expose_headers=["*"],
    max_age=600,
)

# Create router with /api prefix (Moved up)

# Security
security = HTTPBearer(auto_error=False)

# Auth Routes
@api_router.post("/auth/register", response_model=User)
async def register(user_data: UserCreate):
    # Log registration attempt
    logging.info(f"Registration attempt for email: {user_data.email}")

    try:
        # Check if user exists
        existing_user = await db.users.find_one({"email": user_data.email})
        if existing_user:
            logging.warning(f"Email already registered: {user_data.email}")
            raise HTTPException(status_code=400, detail="Email already registered")

        # Validate password length and complexity
        password_bytes = user_data.password.encode('utf-8')
        if len(password_bytes) > 72:
            raise HTTPException(status_code=400, detail="Password must be less than 72 bytes")
        if len(password_bytes) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters long")
        
        # Create user with generated ID
        user_dict = {
            **user_data.model_dump(),
            "id": str(uuid.uuid4()),
            "hashed_password": get_password_hash(user_data.password)
        }
        user = UserInDB(**user_dict)
        
        # Prepare and insert into MongoDB
        mongo_dict = prepare_for_mongo(user.model_dump())
        try:
            await db.users.insert_one(mongo_dict)
            logging.info(f"Successfully registered user: {user_data.email}")
            return User(**user.model_dump())
        except Exception as e:
            logging.error(f"Failed to insert user into MongoDB: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to create user account")
            
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Unexpected error during registration: {str(e)}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")

@api_router.post("/auth/login", response_model=Token)
@limiter.limit("5/minute")
async def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends()):
    # Find user
    user = await db.users.find_one({"email": form_data.username})
    if not user or not verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create token
    access_token = create_access_token(data={"sub": user["id"]})
    return {"access_token": access_token, "token_type": "bearer"}

@api_router.get("/auth/me", response_model=User)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user

@api_router.get("/user/dashboard")
async def get_user_dashboard(current_user: User = Depends(get_current_user)):
    """Get comprehensive user dashboard information"""
    try:
        # Get user basic info
        user_info = {
            "id": current_user.id,
            "email": current_user.email,
            "full_name": current_user.full_name
        }
        
        # Get user expense statistics
        total_expenses_result = await db.expenses.aggregate([
            {"$match": {"user_id": current_user.id}},
            {
                "$group": {
                    "_id": None,
                    "total_amount": {"$sum": "$amount"},
                    "total_count": {"$sum": 1}
                }
            }
        ]).to_list(1)
        
        total_spent = total_expenses_result[0]["total_amount"] if total_expenses_result else 0
        total_transactions = total_expenses_result[0]["total_count"] if total_expenses_result else 0
        
        # Get category breakdown
        category_breakdown = []
        category_cursor = db.expenses.aggregate([
            {"$match": {"user_id": current_user.id}},
            {
                "$group": {
                    "_id": "$category",
                    "total": {"$sum": "$amount"},
                    "count": {"$sum": 1}
                }
            },
            {"$sort": {"total": -1}}
        ])
        
        async for doc in category_cursor:
            category_breakdown.append({
                "category": doc["_id"],
                "total": doc["total"],
                "count": doc["count"],
                "percentage": (doc["total"] / total_spent * 100) if total_spent > 0 else 0
            })
        
        # Get recent expenses (last 5)
        recent_expenses = []
        recent_cursor = db.expenses.find(
            {"user_id": current_user.id}
        ).sort("date", -1).limit(5)
        
        async for doc in recent_cursor:
            recent_expenses.append(parse_from_mongo(doc))
        
        # Get monthly spending trend (last 6 months)
        end_date = datetime.now()
        start_date = end_date - timedelta(days=180)  # 6 months
        
        monthly_trend = []
        monthly_cursor = db.expenses.aggregate([
            {
                "$match": {
                    "user_id": current_user.id,
                    "date": {"$gte": start_date.strftime("%Y-%m-%d")}
                }
            },
            {
                "$group": {
                    "_id": {
                        "year": {"$substr": ["$date", 0, 4]},
                        "month": {"$substr": ["$date", 5, 2]}
                    },
                    "total": {"$sum": "$amount"},
                    "count": {"$sum": 1}
                }
            },
            {"$sort": {"_id.year": 1, "_id.month": 1}}
        ])
        
        async for doc in monthly_cursor:
            month_str = f"{doc['_id']['year']}-{doc['_id']['month']}"
            monthly_trend.append({
                "month": month_str,
                "total": doc["total"],
                "count": doc["count"]
            })
        
        # Get account creation date from user document
        user_doc = await db.users.find_one({"id": current_user.id})
        
        return {
            "user_info": user_info,
            "expense_statistics": {
                "total_spent": total_spent,
                "total_transactions": total_transactions,
                "average_per_transaction": total_spent / total_transactions if total_transactions > 0 else 0
            },
            "category_breakdown": category_breakdown[:10],  # Top 10 categories
            "recent_expenses": recent_expenses,
            "monthly_trend": monthly_trend,
            "account_info": {
                "member_since": user_doc.get("created_at", "Not available") if user_doc else "Not available",
                "last_login": "Current session"
            }
        }
        
    except Exception as e:
        logging.error(f"Failed to get user dashboard: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to load user dashboard")

# Expense Routes
async def check_anomaly(expense_amount: float, category: str, user_id: str):
    """Internal helper to check if an expense is an anomaly using Gemini."""
    try:
        if not gemini_model:
            return False, ""
        
        # Get last 20 expenses in this category for context
        history = await db.expenses.find({"user_id": user_id, "category": category}).sort("date", -1).limit(20).to_list(20)
        if len(history) < 3: # Not enough history to detect anomaly
            return False, ""
            
        history_summary = [{"amount": h["amount"], "date": h["date"]} for h in history]
        
        prompt = f"""
        User is adding a new expense: ₹{expense_amount} in category '{category}'.
        Previous 20 expenses in this category: {json.dumps(history_summary)}
        
        Does this new expense of ₹{expense_amount} look like a significant anomaly or potential error compared to their historical spending pattern?
        Answer in JSON format: {{"is_anomaly": boolean, "reason": "brief reason if true, else empty"}}
        """
        
        response = await asyncio.to_thread(gemini_model.generate_content, prompt)
        res_text = response.text.strip()
        # Clean potential markdown
        if "```json" in res_text:
            res_text = res_text.split("```json")[1].split("```")[0].strip()
        elif "```" in res_text:
            res_text = res_text.split("```")[1].strip()
            
        data = json.loads(res_text)
        return data.get("is_anomaly", False), data.get("reason", "")
    except Exception as e:
        logging.error(f"Anomaly check failed: {e}")
        return False, ""

@api_router.post("/expenses")
async def create_expense(expense: ExpenseCreate, current_user: User = Depends(get_current_user)):
    try:
        # Add the user_id to the expense
        expense_dict = expense.model_dump()
        expense_dict["user_id"] = current_user.id
        expense_dict["id"] = str(uuid.uuid4())
        
        # Handle Multi-Currency Conversion
        if expense_dict.get("original_currency") and expense_dict.get("original_currency") != "INR":
            # If original_amount was provided, use it, otherwise use 'amount' as original_amount
            orig_amt = expense_dict.get("original_amount") or expense_dict["amount"]
            inr_amt, rate = await convert_to_inr(orig_amt, expense_dict["original_currency"])
            
            expense_dict["amount"] = round(inr_amt, 2)
            expense_dict["original_amount"] = orig_amt
            expense_dict["exchange_rate"] = rate
        else:
            expense_dict["original_currency"] = "INR"
            expense_dict["original_amount"] = expense_dict["amount"]
            expense_dict["exchange_rate"] = 1.0

        # Anomaly check
        is_anomaly, reason = await check_anomaly(expense_dict["amount"], expense_dict["category"], current_user.id)
        expense_dict["is_anomaly"] = is_anomaly
        expense_dict["anomaly_reason"] = reason
        
        # Insert into MongoDB
        await db.expenses.insert_one(prepare_for_mongo(expense_dict.copy()))
        
        # Return clean data
        return expense_dict
    except Exception as e:
        logging.error(f"Failed to create expense: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create expense")

@api_router.get("/expenses")
async def get_expenses(current_user: User = Depends(get_current_user)):
    try:
        cursor = db.expenses.find({"user_id": current_user.id})
        expenses = []
        async for doc in cursor:
            # Return all data from MongoDB without strict model validation
            expense_data = parse_from_mongo(doc)
            expenses.append(expense_data)
        return expenses
    except Exception as e:
        logging.error(f"Failed to get expenses: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get expenses")

@api_router.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str, current_user: User = Depends(get_current_user)):
    try:
        # Check if expense exists and belongs to current user
        expense = await db.expenses.find_one({"id": expense_id, "user_id": current_user.id})
        if not expense:
            raise HTTPException(status_code=404, detail="Expense not found")
        
        # Delete the expense
        result = await db.expenses.delete_one({"id": expense_id, "user_id": current_user.id})
        
        if result.deleted_count == 1:
            logging.info(f"Successfully deleted expense: {expense_id}")
            return {"message": f"Expense {expense_id} deleted successfully"}
        else:
            logging.error(f"Failed to delete expense: {expense_id}")
            raise HTTPException(status_code=500, detail="Failed to delete expense")
            
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to delete expense: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete expense")

@api_router.put("/expenses/{expense_id}")
async def update_expense(expense_id: str, update: ExpenseUpdate, current_user: User = Depends(get_current_user)):
    """Edit an existing expense"""
    try:
        expense = await db.expenses.find_one({"id": expense_id, "user_id": current_user.id})
        if not expense:
            raise HTTPException(status_code=404, detail="Expense not found")

        # Build update dict from non-None fields
        update_data = {k: v for k, v in update.model_dump().items() if v is not None}

        # Handle currency conversion if amount/currency changed
        if "amount" in update_data or "original_currency" in update_data:
            currency = update_data.get("original_currency", expense.get("original_currency", "INR"))
            amount = update_data.get("amount", expense.get("amount", 0))
            if currency and currency != "INR":
                inr_amt, rate = await convert_to_inr(amount, currency)
                update_data["amount"] = round(inr_amt, 2)
                update_data["original_amount"] = amount
                update_data["exchange_rate"] = rate
            else:
                update_data["original_currency"] = "INR"
                update_data["original_amount"] = amount
                update_data["exchange_rate"] = 1.0

        await db.expenses.update_one({"id": expense_id, "user_id": current_user.id}, {"$set": update_data})
        updated = await db.expenses.find_one({"id": expense_id})
        return parse_from_mongo(updated)
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to update expense: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update expense")

# ─── Income Routes ────────────────────────────────────────────────────────────

@api_router.post("/income")
async def create_income(income: IncomeCreate, current_user: User = Depends(get_current_user)):
    """Log a new income entry"""
    try:
        income_dict = income.model_dump()
        income_dict["id"] = str(uuid.uuid4())
        income_dict["user_id"] = current_user.id
        await db.income.insert_one(prepare_for_mongo(income_dict.copy()))
        return income_dict
    except Exception as e:
        logging.error(f"Failed to create income: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create income")

@api_router.get("/income")
async def get_income(current_user: User = Depends(get_current_user)):
    """Get all income entries for the current user"""
    try:
        cursor = db.income.find({"user_id": current_user.id}).sort("date", -1)
        entries = [parse_from_mongo(doc) async for doc in cursor]
        return entries
    except Exception as e:
        logging.error(f"Failed to fetch income: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch income")

@api_router.delete("/income/{income_id}")
async def delete_income(income_id: str, current_user: User = Depends(get_current_user)):
    """Delete an income entry"""
    try:
        entry = await db.income.find_one({"id": income_id, "user_id": current_user.id})
        if not entry:
            raise HTTPException(status_code=404, detail="Income entry not found")
        await db.income.delete_one({"id": income_id, "user_id": current_user.id})
        return {"message": f"Income {income_id} deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to delete income: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete income")

@api_router.get("/income/summary")
async def get_income_summary(current_user: User = Depends(get_current_user)):
    """Return total income, total expenses, net savings and savings rate"""
    try:
        # Total income
        income_agg = await db.income.aggregate([
            {"$match": {"user_id": current_user.id}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        total_income = income_agg[0]["total"] if income_agg else 0.0

        # Total expenses (INR)
        expense_agg = await db.expenses.aggregate([
            {"$match": {"user_id": current_user.id}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        total_expenses = expense_agg[0]["total"] if expense_agg else 0.0

        # Monthly income breakdown for chart
        monthly_income = await db.income.aggregate([
            {"$match": {"user_id": current_user.id}},
            {"$group": {
                "_id": {"$substr": ["$date", 0, 7]},
                "total": {"$sum": "$amount"}
            }},
            {"$sort": {"_id": 1}},
            {"$limit": 12}
        ]).to_list(12)

        # Income by source
        by_source = await db.income.aggregate([
            {"$match": {"user_id": current_user.id}},
            {"$group": {"_id": "$source", "total": {"$sum": "$amount"}}},
            {"$sort": {"total": -1}}
        ]).to_list(20)

        net_savings = total_income - total_expenses
        savings_rate = round((net_savings / total_income * 100), 1) if total_income > 0 else 0.0

        return {
            "total_income": round(total_income, 2),
            "total_expenses": round(total_expenses, 2),
            "net_savings": round(net_savings, 2),
            "savings_rate": savings_rate,
            "monthly_income": [{"month": m["_id"], "income": round(m["total"], 2)} for m in monthly_income],
            "by_source": [{"source": s["_id"], "total": round(s["total"], 2)} for s in by_source]
        }
    except Exception as e:
        logging.error(f"Failed to calculate income summary: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to calculate income summary")

# ─────────────────────────────────────────────────────────────────────────────

@api_router.get("/expenses/export")
async def export_expenses_csv(current_user: User = Depends(get_current_user)):
    """Export all user expenses as a CSV file"""
    try:
        cursor = db.expenses.find({"user_id": current_user.id}).sort("date", -1)
        expenses = []
        async for doc in cursor:
            expenses.append(parse_from_mongo(doc))

        output = stdlib_io.StringIO()
        fieldnames = ["date", "title", "amount", "category", "description", "merchant"]
        writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for exp in expenses:
            writer.writerow({
                "date": exp.get("date", ""),
                "title": exp.get("title", ""),
                "amount": exp.get("amount", 0),
                "category": exp.get("category", ""),
                "description": exp.get("description", ""),
                "merchant": exp.get("merchant", "")
            })

        output.seek(0)
        return StreamingResponse(
            stdlib_io.BytesIO(output.getvalue().encode("utf-8")),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=rupeeflow_expenses.csv"}
        )
    except Exception as e:
        logging.error(f"Export failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to export expenses")

@api_router.get("/expenses/pdf")
async def export_expenses_pdf(current_user: User = Depends(get_current_user)):
    """Export all user expenses as a professional PDF report"""
    try:
        cursor = db.expenses.find({"user_id": current_user.id}).sort("date", -1)
        expenses = [parse_from_mongo(doc) async for doc in cursor]

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        elements = []
        styles = getSampleStyleSheet()

        # Header
        elements.append(Paragraph(f"Financial Statement: {current_user.full_name}", styles['Title']))
        elements.append(Paragraph(f"Generated on {datetime.now().strftime('%Y-%m-%d')}", styles['Normal']))
        elements.append(Spacer(1, 20))

        # Table Data
        data = [["Date", "Category", "Merchant", "Amount (₹)"]]
        total = 0
        for exp in expenses:
            amt = float(exp.get("amount", 0))
            data.append([
                exp.get("date", ""),
                exp.get("category", ""),
                exp.get("merchant", "N/A"),
                f"₹{amt:,.2f}"
            ])
            total += amt

        data.append(["", "", "TOTAL", f"₹{total:,.2f}"])

        # Table Styling
        t = Table(data, hAlign='LEFT')
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#4f46e5")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, -1), (-1, -1), colors.lightgrey),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey)
        ]))
        elements.append(t)

        doc.build(elements)
        buffer.seek(0)
        return StreamingResponse(
            buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=rupeeflow_report_{datetime.now().strftime('%Y%m%d')}.pdf"}
        )
    except Exception as e:
        logging.error(f"PDF Export failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to generate PDF")

# ─────────────────────── BUDGET ROUTES ───────────────────────

@api_router.get("/budgets")
async def get_budgets(current_user: User = Depends(get_current_user)):
    """Get all budgets with real-time spending for the current month"""
    try:
        now = datetime.now()
        month_start = now.strftime("%Y-%m-01")

        cursor = db.budgets.find({"user_id": current_user.id})
        budgets = []
        async for doc in cursor:
            budget = parse_from_mongo(doc)
            # Calculate spent amount for this category this month
            spent_pipeline = [
                {"$match": {
                    "user_id": current_user.id,
                    "category": budget["category"],
                    "date": {"$gte": month_start}
                }},
                {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
            ]
            result = await db.expenses.aggregate(spent_pipeline).to_list(1)
            budget["spent"] = result[0]["total"] if result else 0.0
            budget["remaining"] = max(0, budget["amount"] - budget["spent"])
            budget["percentage"] = min(100, round((budget["spent"] / budget["amount"]) * 100, 1)) if budget["amount"] > 0 else 0
            budget["is_exceeded"] = budget["spent"] > budget["amount"]
            budgets.append(budget)
        return budgets
    except Exception as e:
        logging.error(f"Failed to get budgets: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get budgets")

@api_router.post("/budgets")
async def create_budget(budget: BudgetCreate, current_user: User = Depends(get_current_user)):
    """Create or update a budget for a category"""
    try:
        # Upsert: one budget per category per user
        existing = await db.budgets.find_one({"user_id": current_user.id, "category": budget.category})
        if existing:
            await db.budgets.update_one(
                {"user_id": current_user.id, "category": budget.category},
                {"$set": {"amount": budget.amount, "period": budget.period}}
            )
            existing["amount"] = budget.amount
            existing["period"] = budget.period
            return parse_from_mongo(existing)
        
        budget_dict = {
            **budget.model_dump(),
            "id": str(uuid.uuid4()),
            "user_id": current_user.id
        }
        await db.budgets.insert_one(prepare_for_mongo(budget_dict.copy()))
        return budget_dict
    except Exception as e:
        logging.error(f"Failed to create budget: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create budget")

@api_router.delete("/budgets/{budget_id}")
async def delete_budget(budget_id: str, current_user: User = Depends(get_current_user)):
    try:
        result = await db.budgets.delete_one({"id": budget_id, "user_id": current_user.id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Budget not found")
        return {"message": "Budget deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to delete budget: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete budget")

# ─────────────────────── CUSTOM CATEGORIES ───────────────────────

class CategoryCreate(BaseModel):
    name: str
    icon: Optional[str] = "📌"
    color: Optional[str] = "gray"

@api_router.get("/categories")
async def get_categories(current_user: User = Depends(get_current_user)):
    """List user's custom categories"""
    try:
        cursor = db.categories.find({"user_id": current_user.id})
        return [parse_from_mongo(doc) async for doc in cursor]
    except Exception as e:
        logging.error(f"Failed to fetch categories: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch categories")

@api_router.post("/categories")
async def create_category(cat: CategoryCreate, current_user: User = Depends(get_current_user)):
    """Create a new custom category"""
    try:
        # Prevent duplicates
        existing = await db.categories.find_one({"user_id": current_user.id, "name": cat.name})
        if existing:
            raise HTTPException(status_code=400, detail="Category already exists")
        cat_dict = cat.model_dump()
        cat_dict["id"] = str(uuid.uuid4())
        cat_dict["user_id"] = current_user.id
        await db.categories.insert_one(prepare_for_mongo(cat_dict.copy()))
        return cat_dict
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to create category: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create category")

@api_router.delete("/categories/{cat_id}")
async def delete_category(cat_id: str, current_user: User = Depends(get_current_user)):
    """Delete a custom category"""
    try:
        result = await db.categories.delete_one({"id": cat_id, "user_id": current_user.id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Category not found")
        return {"message": "Category deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to delete category")

@api_router.get("/budgets/alerts")
async def get_budget_alerts(current_user: User = Depends(get_current_user)):
    """Return budgets that have exceeded 80% or 100% of their monthly limit"""
    try:
        now = datetime.now(timezone.utc)
        month_start = now.replace(day=1).strftime("%Y-%m-%d")
        month_end   = now.strftime("%Y-%m-%d")

        # Get all budgets
        budgets = [parse_from_mongo(doc) async for doc in db.budgets.find({"user_id": current_user.id})]

        alerts = []
        for budget in budgets:
            cat = budget.get("category")
            limit = budget.get("amount", 0)
            if not cat or limit <= 0:
                continue

            # Sum expenses in this category this month
            agg = await db.expenses.aggregate([
                {"$match": {
                    "user_id": current_user.id,
                    "category": cat,
                    "date": {"$gte": month_start, "$lte": month_end}
                }},
                {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
            ]).to_list(1)
            spent = agg[0]["total"] if agg else 0.0
            pct = round(spent / limit * 100, 1)

            if pct >= 80:
                alerts.append({
                    "budget_id": budget.get("id"),
                    "category": cat,
                    "limit": round(limit, 2),
                    "spent": round(spent, 2),
                    "pct": pct,
                    "level": "critical" if pct >= 100 else "warning"
                })

        alerts.sort(key=lambda x: x["pct"], reverse=True)
        return alerts
    except Exception as e:
        logging.error(f"Failed to get budget alerts: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get budget alerts")

# ─────────────────────── RECURRING EXPENSE ROUTES ───────────────────────


async def _sync_recurring_expenses(user_id: str):
    """Auto-generate expenses for recurring items that are due."""
    today = datetime.now().strftime("%Y-%m-%d")
    cursor = db.recurring.find({"user_id": user_id, "is_active": True, "next_date": {"$lte": today}})
    async for rec in cursor:
        # Create an actual expense
        expense = {
            "id": str(uuid.uuid4()),
            "title": rec["title"],
            "amount": rec["amount"],
            "category": rec["category"],
            "description": rec.get("description", f"Recurring: {rec['title']}"),
            "date": rec["next_date"],
            "user_id": user_id,
            "receipt_url": None,
            "is_recurring": True
        }
        await db.expenses.insert_one(prepare_for_mongo(expense.copy()))
        # Advance next_date based on frequency
        freq = rec.get("frequency", "monthly")
        nd = datetime.strptime(rec["next_date"], "%Y-%m-%d")
        if freq == "daily":
            nd = nd + timedelta(days=1)
        elif freq == "weekly":
            nd = nd + timedelta(weeks=1)
        elif freq == "monthly":
            # Add one month
            month = nd.month % 12 + 1
            year = nd.year + (1 if nd.month == 12 else 0)
            import calendar
            day = min(nd.day, calendar.monthrange(year, month)[1])
            nd = nd.replace(year=year, month=month, day=day)
        elif freq == "yearly":
            nd = nd.replace(year=nd.year + 1)
        await db.recurring.update_one(
            {"id": rec["id"]},
            {"$set": {"next_date": nd.strftime("%Y-%m-%d")}}
        )
    logging.info(f"Recurring sync done for user {user_id}")

@api_router.get("/recurring")
async def get_recurring(current_user: User = Depends(get_current_user)):
    # Sync before listing
    await _sync_recurring_expenses(current_user.id)
    cursor = db.recurring.find({"user_id": current_user.id})
    items = [parse_from_mongo(doc) async for doc in cursor]
    return items

@api_router.post("/recurring")
async def create_recurring(item: RecurringCreate, current_user: User = Depends(get_current_user)):
    try:
        rec_dict = {
            **item.model_dump(),
            "id": str(uuid.uuid4()),
            "user_id": current_user.id
        }
        await db.recurring.insert_one(prepare_for_mongo(rec_dict.copy()))
        return rec_dict
    except Exception as e:
        logging.error(f"Failed to create recurring: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create recurring expense")

@api_router.patch("/recurring/{item_id}")
async def toggle_recurring(item_id: str, current_user: User = Depends(get_current_user)):
    doc = await db.recurring.find_one({"id": item_id, "user_id": current_user.id})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    new_state = not doc.get("is_active", True)
    await db.recurring.update_one({"id": item_id}, {"$set": {"is_active": new_state}})
    return {"is_active": new_state}

@api_router.delete("/recurring/{item_id}")
async def delete_recurring(item_id: str, current_user: User = Depends(get_current_user)):
    result = await db.recurring.delete_one({"id": item_id, "user_id": current_user.id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"message": "Deleted"}

# ====================
# Goals API (Gamification)
# ====================

@api_router.get("/goals")
async def get_goals(current_user: User = Depends(get_current_user)):
    cursor = db.goals.find({"user_id": current_user.id})
    goals = await cursor.to_list(length=100)
    return [parse_from_mongo(g) for g in goals]

@api_router.post("/goals")
async def create_goal(goal: GoalCreate, current_user: User = Depends(get_current_user)):
    goal_dict = goal.model_dump()
    goal_dict["id"] = str(uuid.uuid4())
    goal_dict["user_id"] = current_user.id
    goal_dict["current_amount"] = 0.0
    await db.goals.insert_one(prepare_for_mongo(goal_dict.copy()))
    return parse_from_mongo(goal_dict)

@api_router.post("/goals/{goal_id}/contribute")
async def contribute_to_goal(goal_id: str, contribution: dict, current_user: User = Depends(get_current_user)):
    amount = float(contribution.get("amount", 0))
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Contribution must be positive")
    
    goal = await db.goals.find_one({"id": goal_id, "user_id": current_user.id})
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
        
    new_amount = goal.get("current_amount", 0.0) + amount
    await db.goals.update_one(
        {"id": goal_id},
        {"$set": {"current_amount": new_amount}}
    )
    
    # Also log this as an expense categorized as "Savings"
    expense_dict = {
        "id": str(uuid.uuid4()),
        "title": f"Saved for: {goal.get('title')}",
        "amount": amount,
        "date": datetime.now().strftime("%Y-%m-%d"),
        "category": "Savings",
        "description": "Goal Contribution",
        "user_id": current_user.id,
        "is_savings": True
    }
    await db.expenses.insert_one(prepare_for_mongo(expense_dict))
    
    goal["current_amount"] = new_amount
    return parse_from_mongo(goal)

@api_router.delete("/goals/{goal_id}")
async def delete_goal(goal_id: str, current_user: User = Depends(get_current_user)):
    result = await db.goals.delete_one({"id": goal_id, "user_id": current_user.id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Goal not found")
    return {"status": "deleted"}

@api_router.post("/expenses/receipt", response_model=dict)
@limiter.limit("10/minute")
async def upload_receipt(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    if not file.content_type or not file.content_type.startswith('image/'):
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Please upload an image file."
        )
    
    try:
        # Read the image file
        contents = await file.read()
        logging.info(f"Received file: {file.filename}, size: {len(contents)} bytes, content_type: {file.content_type}")
        
        if not contents:
            raise ValueError("Empty file uploaded")
            
        # Initialize receipt processor
        processor = ReceiptProcessor()
        
        # Process the receipt - use Gemini Vision if available for superior accuracy
        logging.info("Starting receipt processing...")
        ensure_gemini_model()
        result = await processor.process_receipt(contents, gemini_model=gemini_model)
        logging.info(f"Receipt processing result: {result}")
        
        if not result.get("success", False):
            # Return the error from the processor
            return {
                "success": False,
                "error": result.get("error", "Unknown error occurred"),
                "error_type": result.get("error_type", "unknown")
            }
        
        # Generate a unique filename
        filename = f"{uuid.uuid4()}_{file.filename}"
        file_path = ROOT_DIR / "uploads" / filename
        
        # Ensure uploads directory exists
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        
        # Save the file
        try:
            async with aiofiles.open(file_path, 'wb') as f:
                await f.write(contents)
        except Exception as e:
            logging.error(f"Failed to save receipt file: {str(e)}")
            # Continue even if file save fails
        
        # Prepare the extracted data (remove success flag from nested data)
        extracted_data = {k: v for k, v in result.items() if k != "success"}
        extracted_data["receipt_url"] = f"/uploads/{filename}"
        
        # Create expense with extracted data regardless of confidence level
        expense_created = False
        expense_id = None
        
        if result.get("amount") and result.get("description"):
            try:
                # Create expense with ALL extracted data (regardless of confidence)
                expense_data = {
                    "title": result["description"],
                    "amount": float(result["amount"]),
                    "date": result.get("date", datetime.now().strftime("%Y-%m-%d")),
                    "category": result.get("category", "Other"),
                    "description": result["description"],
                    "receipt_url": f"/uploads/{filename}",
                    "user_id": current_user.id,
                    "id": str(uuid.uuid4()),
                    # Store ALL extracted data
                    "merchant": result.get("merchant"),
                    "items": result.get("items", []),
                    "raw_text": result.get("raw_text"),
                    "category_confidence": result.get("category_confidence"),
                    "category_reason": result.get("category_reason"),
                    "extracted_date": result.get("date"),
                    "needs_confirmation": result.get("needs_confirmation", False)
                }
                
                # Insert into MongoDB
                await db.expenses.insert_one(prepare_for_mongo(expense_data))
                expense_created = True
                expense_id = expense_data["id"]
                
                logging.info(f"Automatically created expense with ID: {expense_id}")
                logging.info(f"Saved expense data keys: {list(expense_data.keys())}")
                logging.info(f"Items saved: {len(expense_data.get('items', []))} items")
                
            except Exception as e:
                logging.error(f"Failed to auto-create expense: {str(e)}")
                # Continue even if expense creation fails
        
        # Return response in expected format
        response_data = {
            "success": True,
            "extracted_data": extracted_data,
            "expense_created": expense_created
        }
        
        if expense_created:
            response_data["expense_id"] = expense_id
            if result.get("category_confidence") == "high":
                response_data["message"] = "Receipt processed and expense created automatically!"
            else:
                response_data["message"] = "Receipt processed and expense created. Please review the categorization."
        else:
            response_data["message"] = "Receipt processed successfully. Please review the extracted data."
            
        return response_data
        
    except ValueError as e:
        # Handle validation errors
        return {
            "success": False,
            "error": str(e),
            "error_type": "validation"
        }
    except Exception as e:
        logging.error(f"Failed to process receipt: {str(e)}")
        return {
            "success": False,
            "error": "An unexpected error occurred while processing the receipt. Please try again.",
            "error_type": "system"
        }

@api_router.get("/analytics/monthly")
async def get_monthly_analytics(months: int = 6, current_user: User = Depends(get_current_user)):
    try:
        # Calculate date range
        end_date = datetime.now()
        start_date = end_date - timedelta(days=months * 30)
        
        # Aggregate pipeline
        pipeline = [
            {
                "$match": {
                    "user_id": current_user.id,
                    "date": {"$gte": start_date.strftime("%Y-%m-%d")}
                }
            },
            {
                "$group": {
                    "_id": {
                        "year": {"$substr": ["$date", 0, 4]},
                        "month": {"$substr": ["$date", 5, 2]}
                    },
                    "total": {"$sum": "$amount"},
                    "count": {"$sum": 1}
                }
            },
            {
                "$sort": {"_id.year": 1, "_id.month": 1}
            }
        ]
        
        cursor = db.expenses.aggregate(pipeline)
        results = []
        async for doc in cursor:
            month_str = f"{doc['_id']['year']}-{doc['_id']['month']}"
            results.append({
                "month": month_str,
                "total": doc["total"],
                "count": doc["count"]
            })
            
        return results
    except Exception as e:
        logging.error(f"Failed to get monthly analytics: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get monthly analytics")

@api_router.post("/ai-assistant/chat")
async def ai_assistant_chat(request: dict, current_user: User = Depends(get_current_user)):
    """Advanced AI assistant using Gemini API for intelligent expense analysis"""
    try:
        user_query = request.get("query", "").strip()
        if not user_query:
            raise HTTPException(status_code=400, detail="Query cannot be empty")

        global gemini_model

        ensure_gemini_model()
        
        # Fetch user's recent expenses for context
        expenses_cursor = db.expenses.find({"user_id": current_user.id}).sort("date", -1).limit(50)
        expenses = []
        async for doc in expenses_cursor:
            expenses.append(parse_from_mongo(doc))

        # Prepare expense data for AI context
        expense_summary = []
        for exp in expenses[:20]:  # Limit to last 20 expenses for context
            expense_summary.append({
                "amount": exp.get("amount"),
                "category": exp.get("category"),
                "description": exp.get("description"),
                "date": exp.get("date"),
                "merchant": exp.get("merchant", "")
            })

        # Calculate basic statistics
        total_spent = sum(float(exp.get("amount", 0) or 0) for exp in expenses)
        category_totals = {}
        for exp in expenses:
            category = exp.get("category")
            amount = float(exp.get("amount", 0) or 0)
            if category:
                category_totals[category] = category_totals.get(category, 0) + amount
        
        # Fetch budget data for richer context
        now = datetime.now()
        month_start = now.strftime("%Y-%m-01")
        budgets_cursor = db.budgets.find({"user_id": current_user.id})
        budget_summary = []
        async for bdoc in budgets_cursor:
            cat = bdoc.get("category", "")
            limit = bdoc.get("amount", 0)
            spent_res = await db.expenses.aggregate([
                {"$match": {"user_id": current_user.id, "category": cat, "date": {"$gte": month_start}}},
                {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
            ]).to_list(1)
            spent = spent_res[0]["total"] if spent_res else 0
            budget_summary.append({"category": cat, "limit": limit, "spent": spent, "remaining": max(0, limit - spent)})

        # Create context for Gemini
        context = f"""
        You are RupeeFlow's AI assistant — an expert personal finance advisor for Indian users.

        Your job is to answer the user's question as helpfully as possible.

        Rules:
        1) Answer ALL questions, even if they are not directly about the user's stored expenses.
        2) If the question requires expense data, use the provided data below.
        3) Proactively mention budget alerts if the user is close to or exceeding a budget limit.
        4) Give actionable, concise, practical advice. Use ₹ symbol for Indian Rupees.
        5) Format numbers clearly (e.g., ₹1,500.00).

        User profile:
        - User: {current_user.full_name} ({current_user.email})
        - Recorded transactions: {len(expenses)}
        - Total spent: ₹{total_spent:.2f}
        - Current month: {now.strftime('%B %Y')}

        Recent expenses (up to 20):
        {json.dumps(expense_summary, indent=2)}

        Category totals (all time):
        {json.dumps(category_totals, indent=2)}

        Monthly budgets (current month):
        {json.dumps(budget_summary, indent=2)}

        Current date: {now.strftime('%Y-%m-%d')}

        User question: {user_query}
        """
        
        if not gemini_model:
            return {
                "answer": "Advanced AI features are currently unavailable. Please verify GEMINI_API_KEY and try again.",
                "data": {"expenses": expenses[:5]},
                "is_ai_response": False
            }
        
        # Get response from Gemini
        last_error = None
        for attempt in range(2):
            try:
                response = await asyncio.to_thread(gemini_model.generate_content, context)
                ai_response = getattr(response, "text", None) or ""
                if ai_response.strip():
                    return {
                        "answer": ai_response,
                        "data": {
                            "total_expenses": len(expenses),
                            "total_spent": total_spent,
                            "category_breakdown": category_totals,
                            "recent_expenses": expenses[:5]
                        },
                        "is_ai_response": True
                    }
                last_error = RuntimeError("Empty response from Gemini")
            except Exception as e:
                last_error = e
                if attempt == 0:
                    await asyncio.sleep(0.5)

        logging.error(f"Gemini API error: {str(last_error)}")

        error_text = str(last_error)
        if "429" in error_text or "quota" in error_text.lower() or "rate limit" in error_text.lower():
            retry_seconds = None
            m = re.search(r"retry in ([0-9.]+)s", error_text, flags=re.IGNORECASE)
            if m:
                retry_seconds = m.group(1)
            if retry_seconds is None:
                m2 = re.search(r"retry_delay\s*\{\s*seconds:\s*(\d+)", error_text, flags=re.IGNORECASE)
                if m2:
                    retry_seconds = m2.group(1)

            # Build budget-aware fallback
            budget_alerts = [b for b in budget_summary if b.get("remaining", 0) <= 0]
            alert_text = f" You've exceeded budgets in {len(budget_alerts)} categories." if budget_alerts else ""
            
            fallback_answer = (
                f"I'm processing a lot of requests right now, but I've got your summary! "
                f"You've spent {format_currency_inr(total_spent)} this month across {len(expenses)} transactions.{alert_text} "
                f"Your top category is {max(category_totals.items(), key=lambda x: x[1])[0] if category_totals else 'N/A'}. "
                f"How else can I help?"
            )
            return {
                "answer": fallback_answer,
                "data": {
                    "total_expenses": len(expenses),
                    "total_spent": total_spent,
                    "category_breakdown": category_totals,
                    "budget_summary": budget_summary,
                    "is_fallback": True
                },
                "is_ai_response": False
            }

        if "not found" in error_text.lower() and "models/" in error_text.lower():
            gemini_model = None
            try:
                ensure_gemini_model()
            except Exception:
                pass

            if gemini_model is not None:
                try:
                    response = await asyncio.to_thread(gemini_model.generate_content, context)
                    ai_response = getattr(response, "text", None) or ""
                    if ai_response.strip():
                        return {
                            "answer": ai_response,
                            "data": {
                                "total_expenses": len(expenses),
                                "total_spent": total_spent,
                                "category_breakdown": category_totals,
                                "recent_expenses": expenses[:5]
                            },
                            "is_ai_response": True
                        }
                except Exception as e:
                    logging.error(f"Gemini retry after auto-select failed: {str(e)}")

            return {
                "answer": f"Your API key does not support the configured Gemini model. I attempted to auto-select a supported model. If this persists, set GEMINI_MODEL to a valid model such as 'models/gemini-pro-latest' or 'models/gemini-flash-latest' in backend/.env and restart. Current picked model: {gemini_model_name_in_use or 'none'}.",
                "data": {
                    "total_expenses": len(expenses),
                    "total_spent": total_spent,
                    "category_breakdown": category_totals,
                    "recent_expenses": expenses[:3]
                },
                "is_ai_response": False
            }

        return {
            "answer": "I'm having trouble generating a response right now. Please try again in a moment.",
            "data": {
                "total_expenses": len(expenses),
                "total_spent": total_spent,
                "category_breakdown": category_totals,
                "recent_expenses": expenses[:3]
            },
            "is_ai_response": False
        }
            
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"AI assistant error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to process AI request")

@api_router.get("/insights")
async def get_insights(current_user: User = Depends(get_current_user)):
    try:
        # Get category breakdown
        category_pipeline = [
            {
                "$match": {"user_id": current_user.id}
            },
            {
                "$group": {
                    "_id": "$category",
                    "total": {"$sum": "$amount"},
                    "count": {"$sum": 1}
                }
            }
        ]
        
        # Get total spending
        total_pipeline = [
            {
                "$match": {"user_id": current_user.id}
            },
            {
                "$group": {
                    "_id": None,
                    "total": {"$sum": "$amount"},
                    "count": {"$sum": 1}
                }
            }
        ]
        
        # Get spending trends (last 30 days vs previous 30 days)
        end_date = datetime.now()
        thirty_days_ago = end_date - timedelta(days=30)
        sixty_days_ago = end_date - timedelta(days=60)
        
        trends_pipeline = [
            {
                "$match": {
                    "user_id": current_user.id,
                    "date": {
                        "$gte": sixty_days_ago.strftime("%Y-%m-%d"),
                        "$lte": end_date.strftime("%Y-%m-%d")
                    }
                }
            },
            {
                "$project": {
                    "amount": 1,
                    "is_current": {
                        "$gte": [
                            "$date",
                            thirty_days_ago.strftime("%Y-%m-%d")
                        ]
                    }
                }
            },
            {
                "$group": {
                    "_id": "$is_current",
                    "total": {"$sum": "$amount"}
                }
            }
        ]
        
        # Execute all pipelines
        category_cursor = db.expenses.aggregate(category_pipeline)
        total_cursor = db.expenses.aggregate(total_pipeline)
        trends_cursor = db.expenses.aggregate(trends_pipeline)
        
        # Process results
        categories = []
        async for doc in category_cursor:
            categories.append({
                "category": doc["_id"],
                "total": doc["total"],
                "count": doc["count"]
            })
        
        total_doc = await total_cursor.to_list(length=1)
        total_stats = total_doc[0] if total_doc else {"total": 0, "count": 0}
        
        trends = {}
        async for doc in trends_cursor:
            period = "current" if doc["_id"] else "previous"
            trends[period] = doc["total"]
        
        # Calculate spending trend percentage
        spending_trend = 0
        if trends.get("previous", 0) > 0:
            spending_trend = ((trends.get("current", 0) - trends.get("previous", 0)) 
                            / trends.get("previous", 0) * 100)
        
        return {
            "total_spending": total_stats["total"],
            "total_transactions": total_stats["count"],
            "categories": categories,
            "spending_trend": spending_trend
        }
    except Exception as e:
        logging.error(f"Failed to get insights: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get insights")

@api_router.get("/ai/forecast")
async def get_spend_forecast(current_user: User = Depends(get_current_user)):
    """Analyze last 3 months and provide a forecast for next month."""
    try:
        ensure_gemini_model()
        if not gemini_model:
            return {"error": "AI features disabled", "forecast": None}

        # Get history (last 100 expenses)
        cursor = db.expenses.find({"user_id": current_user.id}).sort("date", -1).limit(100)
        expenses = []
        async for doc in cursor:
            expenses.append(parse_from_mongo(doc))
            
        if not expenses:
            return {"forecast": "No expense history found to generate a forecast."}

        # Group by category for context
        cats = {}
        for e in expenses:
            c = e.get("category", "Other")
            cats[c] = cats.get(c, 0) + e.get("amount", 0)

        prompt = f"""
        User: {current_user.full_name}
        History (last 100 trans): {json.dumps([{"amount":e["amount"],"cat":e["category"],"date":e["date"]} for e in expenses])}
        Category Totals: {json.dumps(cats)}
        
        Based on this spending history, provide:
        1. A predicted total spend for NEXT month.
        2. Top 3 categories likely to have highest spend.
        3. One smart saving tip tailored to their patterns.
        
        Format the response in JSON: {{"predicted_total": number, "top_categories": list, "savings_tip": string}}
        """
        
        try:
            response = await asyncio.to_thread(gemini_model.generate_content, prompt)
            res_text = response.text.strip()
            if "```json" in res_text:
                res_text = res_text.split("```json")[1].split("```")[0].strip()
            elif "```" in res_text:
                res_text = res_text.split("```")[1].strip()
            
            prediction = json.loads(res_text)
        except Exception as api_e:
            logging.warning(f"AI API Quota/Error triggered. Using Statistical Fallback Engine: {api_e}")
            sorted_cats = sorted(cats.items(), key=lambda x: x[1], reverse=True)
            top_3 = [c[0] for c in sorted_cats[:3]]
            total_spent = sum([e.get("amount", 0) for e in expenses])
            
            from datetime import datetime
            try:
                d1 = datetime.strptime(expenses[-1]['date'], "%Y-%m-%d")
                d2 = datetime.strptime(expenses[0]['date'], "%Y-%m-%d")
                days_tracked = max(1, (d2-d1).days)
            except:
                days_tracked = 30
                
            daily_avg = total_spent / days_tracked
            projected = daily_avg * 30 * 1.02 # 2% projected variance
            
            main_spending = top_3[0] if top_3 else "discretionary categories"
            prediction = {
                "predicted_total": round(projected, 2),
                "top_categories": top_3,
                "savings_tip": f"Based on static analysis, your highest outflow is {main_spending}. Reducing this by just 15% could yield substantial monthly savings."
            }

        return {
            "success": True,
            "forecast": prediction
        }
    except Exception as e:
        logging.error(f"Forecast completely failed: {e}")
        return {"success": False, "error": str(e)}

# Shared Groups / Social Wallet Routes
@api_router.post("/groups", response_model=GroupModel)
async def create_group(group: GroupCreate, current_user: User = Depends(get_current_user)):
    try:
        group_id = str(uuid.uuid4())
        invite_code = str(uuid.uuid4())[:8].upper()
        
        group_dict = group.model_dump()
        group_dict.update({
            "id": group_id,
            "admin_id": current_user.id,
            "members": [current_user.id],
            "invite_code": invite_code,
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        })
        
        await db.groups.insert_one(prepare_for_mongo(group_dict.copy()))
        return group_dict
    except Exception as e:
        logging.error(f"Failed to create group: {e}")
        raise HTTPException(status_code=500, detail="Failed to create group")

@api_router.get("/groups", response_model=List[GroupModel])
async def list_groups(current_user: User = Depends(get_current_user)):
    try:
        cursor = db.groups.find({"members": current_user.id})
        groups = [parse_from_mongo(doc) async for doc in cursor]
        return groups
    except Exception as e:
        logging.error(f"Failed to list groups: {e}")
        raise HTTPException(status_code=500, detail="Failed to list groups")

@api_router.post("/groups/join")
async def join_group(invite_code: str = Body(..., embed=True), current_user: User = Depends(get_current_user)):
    try:
        group = await db.groups.find_one({"invite_code": invite_code.upper()})
        if not group:
            raise HTTPException(status_code=404, detail="Invalid invite code")
        
        if current_user.id in group.get("members", []):
            return parse_from_mongo(group)
            
        await db.groups.update_one(
            {"id": group["id"]},
            {"$push": {"members": current_user.id}}
        )
        
        updated_group = await db.groups.find_one({"id": group["id"]})
        return parse_from_mongo(updated_group)
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to join group: {e}")
        raise HTTPException(status_code=500, detail="Failed to join group")

@api_router.post("/groups/{group_id}/expenses")
async def add_group_expense(group_id: str, expense: ExpenseCreate, current_user: User = Depends(get_current_user)):
    try:
        # Verify user is in group
        group = await db.groups.find_one({"id": group_id, "members": current_user.id})
        if not group:
            raise HTTPException(status_code=403, detail="Not a member of this group")
            
        expense_dict = expense.model_dump()
        expense_dict.update({
            "id": str(uuid.uuid4()),
            "user_id": current_user.id,
            "group_id": group_id,
            "creator_name": current_user.full_name
        })
        
        await db.group_expenses.insert_one(prepare_for_mongo(expense_dict.copy()))
        return expense_dict
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to add group expense: {e}")
        raise HTTPException(status_code=500, detail="Failed to add group expense")

@api_router.get("/groups/{group_id}/expenses")
async def list_group_expenses(group_id: str, current_user: User = Depends(get_current_user)):
    try:
        # Verify user is in group
        group = await db.groups.find_one({"id": group_id, "members": current_user.id})
        if not group:
            raise HTTPException(status_code=403, detail="Not a member of this group")
            
        cursor = db.group_expenses.find({"group_id": group_id}).sort("date", -1)
        expenses = [parse_from_mongo(doc) async for doc in cursor]
        return expenses
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to list group expenses: {e}")
        raise HTTPException(status_code=500, detail="Failed to list group expenses")

@api_router.get("/groups/{group_id}/settlements")
async def get_group_settlements(group_id: str, current_user: User = Depends(get_current_user)):
    try:
        group = await db.groups.find_one({"id": group_id, "members": current_user.id})
        if not group:
            raise HTTPException(status_code=403, detail="Not a member of this group")
            
        members = group.get("members", [])
        num_members = len(members)
        if num_members == 0:
            return []
            
        # Get member names
        balances = {mid: {"name": "Unknown Member", "net": 0.0} for mid in members}
        cursor = db.users.find({"id": {"$in": members}})
        async for u in cursor:
            balances[u["id"]]["name"] = u.get("full_name", "Unknown")
            
        # Calculate net balances
        exp_cursor = db.group_expenses.find({"group_id": group_id})
        async for exp in exp_cursor:
            amount = float(exp.get("amount", 0.0))
            payer_id = exp.get("user_id")
            # If the payer is not in the group anymore, or invalid, we add them temporarily to track properly
            if payer_id not in balances:
                balances[payer_id] = {"name": exp.get("creator_name", "Unknown"), "net": 0.0}
            
            fair_share = amount / num_members
            for mid in members:
                if mid == payer_id:
                    balances[mid]["net"] += (amount - fair_share)
                else:
                    balances[mid]["net"] -= fair_share
                    
        # Greedy settlement algorithm
        debtors = [{"id": k, "name": v["name"], "amount": -v["net"]} for k, v in balances.items() if v["net"] < -0.01]
        creditors = [{"id": k, "name": v["name"], "amount": v["net"]} for k, v in balances.items() if v["net"] > 0.01]
        
        debtors.sort(key=lambda x: x["amount"], reverse=True)
        creditors.sort(key=lambda x: x["amount"], reverse=True)
        
        settlements = []
        i, j = 0, 0
        while i < len(debtors) and j < len(creditors):
            debtor = debtors[i]
            creditor = creditors[j]
            
            settle_amount = min(debtor["amount"], creditor["amount"])
            settle_amount = round(settle_amount, 2)
            
            if settle_amount > 0:
                settlements.append({
                    "from_user_id": debtor["id"],
                    "from_user_name": debtor["name"],
                    "to_user_id": creditor["id"],
                    "to_user_name": creditor["name"],
                    "amount": settle_amount
                })
                
            debtor["amount"] -= settle_amount
            creditor["amount"] -= settle_amount
            
            if debtor["amount"] < 0.01:
                i += 1
            if creditor["amount"] < 0.01:
                j += 1
                
        return settlements
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        logging.error(f"Failed to calculate settlements: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Failed to calculate settlements")

# Include routers
app.include_router(api_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8001)
