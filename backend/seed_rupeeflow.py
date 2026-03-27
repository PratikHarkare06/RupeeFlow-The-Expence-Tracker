import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import uuid
import random
from datetime import datetime, timedelta

async def seed():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["rupeeflow"]
    
    # Try finding the designated test user
    user = await db.users.find_one({"username": "test_user"})
    if not user:
        user = await db.users.find_one({})
    
    if not user:
        print("No users found in rupeeflow DB!")
        return
        
    user_id = user["id"]
    print(f"Seeding expenses for user {user_id} ({user.get('username')})")
    
    categories = ['Food & Dining', 'Transportation', 'Home & Family', 'Entertainment', 'Shopping', 'Bills & Utilities', 'Savings']
    merchants = {
        'Food & Dining': ['Zomato', 'Swiggy', 'Starbucks', 'McDonalds', 'Local Cafe', 'Dominos'],
        'Transportation': ['Uber', 'Ola', 'Petrol Pump', 'Metro Ticket', 'Indian Railways'],
        'Home & Family': ['D-Mart', 'BigBasket Instamart', 'IKEA', 'Hardware Store', 'Groceries'],
        'Entertainment': ['Netflix', 'Amazon Prime', 'PVR Cinemas', 'BookMyShow', 'Steam Games'],
        'Shopping': ['Amazon', 'Flipkart', 'Zara', 'H&M', 'Myntra'],
        'Bills & Utilities': ['Electricity Board', 'JioFiber', 'Airtel', 'Water Bill', 'Gas Bill'],
        'Savings': ['Mutual Fund SIP', 'Fixed Deposit', 'Stock Market', 'Gold']
    }
    
    expenses_to_insert = []
    
    # We will generate about 120 previous historical expenses across the last 100 days
    # This helps the AI forecast train on a solid baseline trajectory
    today = datetime.now()
    
    for _ in range(120):
        days_ago = random.randint(1, 95)
        expense_date = today - timedelta(days=days_ago)
        date_str = expense_date.strftime("%Y-%m-%d")
        
        category = random.choices(
            population=categories,
            weights=[0.3, 0.15, 0.15, 0.1, 0.1, 0.15, 0.05],
            k=1
        )[0]
        
        merchant = random.choice(merchants[category])
        base_amount = random.uniform(80, 800)
        
        # Adjust weight limits
        if category == 'Shopping':
            base_amount *= random.uniform(1.2, 4.0)
        if category == 'Bills & Utilities':
            base_amount *= random.uniform(0.8, 1.5)
        if category == 'Savings':
            base_amount *= random.uniform(3.0, 10.0)
            
        expense_dict = {
            "id": str(uuid.uuid4()),
            "amount": round(base_amount, 2),
            "date": date_str,
            "category": category,
            "description": f"Payment at {merchant} on {date_str}",
            "user_id": user_id,
            "merchant": merchant,
            "needs_confirmation": False,
            "original_currency": "INR",
            "original_amount": round(base_amount, 2),
            "exchange_rate": 1.0
        }
        expenses_to_insert.append(expense_dict)
        
    # Also add a few 'anomaly' expenses over the last week for the AI to flag!
    for _ in range(3):
        days_ago = random.randint(1, 5)
        date_str = (today - timedelta(days=days_ago)).strftime("%Y-%m-%d")
        category = "Shopping"
        amount = round(random.uniform(18000, 45000), 2)
        expense_dict = {
            "id": str(uuid.uuid4()),
            "amount": amount,
            "date": date_str,
            "category": category,
            "description": "High value unusual purchase",
            "user_id": user_id,
            "merchant": "Apple Store",
            "needs_confirmation": False,
            "original_currency": "INR",
            "original_amount": amount,
            "exchange_rate": 1.0
        }
        expenses_to_insert.append(expense_dict)
        
    await db.expenses.insert_many(expenses_to_insert)
    print(f"Successfully inserted {len(expenses_to_insert)} historical expenses (including anomalies).")

asyncio.run(seed())
