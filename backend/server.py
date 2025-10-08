from fastapi import FastAPI, APIRouter, File, UploadFile, HTTPException, Depends, Form, Body, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials, OAuth2PasswordBearer, OAuth2PasswordRequestForm
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timezone, timedelta
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
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGODB_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client['ai-expense-tracker']  # Using direct database name since it's in the connection URL

# JWT settings
SECRET_KEY = os.environ.get("SECRET_KEY", "your-secret-key")  # Update in production
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

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

class ExpenseCreate(ExpenseBase):
    pass

class Expense(ExpenseBase):
    id: str

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

# App Lifespan
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Verify MongoDB connection on startup
    await verify_db_connection()
    yield
    # Cleanup on shutdown
    client.close()

# Create the main app
app = FastAPI(title="AI Expense Tracker", description="Smart expense tracking with AI categorization and receipt OCR", lifespan=lifespan)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:5000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001", 
        "http://127.0.0.1:5000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_origin_regex=None,
    expose_headers=["*"],
    max_age=600,
)

# Create router with /api prefix
api_router = APIRouter(prefix="/api")

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
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
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
@api_router.post("/expenses")
async def create_expense(expense: ExpenseCreate, current_user: User = Depends(get_current_user)):
    try:
        # Add the user_id to the expense
        expense_dict = expense.model_dump()
        expense_dict["user_id"] = current_user.id
        expense_dict["id"] = str(uuid.uuid4())
        
        # Insert into MongoDB
        await db.expenses.insert_one(prepare_for_mongo(expense_dict.copy()))
        
        # Return clean data without MongoDB ObjectId
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

@api_router.post("/expenses/receipt", response_model=dict)
async def upload_receipt(
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
        
        # Process the receipt
        logging.info("Starting receipt processing...")
        result = await processor.process_receipt(contents)
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

# Include routers
app.include_router(api_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8001)
