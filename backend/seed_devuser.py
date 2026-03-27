import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import uuid
import random
from datetime import datetime, timedelta

async def seed():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["rupeeflow"]
    
    user_id = "dev-user"
    print(f"Seeding expenses for {user_id}")
    
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
    
    today = datetime.now()
    
    # Over 45 days, generate ~75 expenses perfectly for the forecast
    for _ in range(75):
        days_ago = random.randint(1, 45)
        expense_date = today - timedelta(days=days_ago)
        date_str = expense_date.strftime("%Y-%m-%d")
        
        category = random.choices(
            population=categories,
            weights=[0.3, 0.15, 0.15, 0.1, 0.1, 0.15, 0.05],
            k=1
        )[0]
        
        merchant = random.choice(merchants[category])
        base_amount = random.uniform(200, 1500)
        
        if category == 'Shopping':
            base_amount *= random.uniform(1.2, 4.0)
        if category == 'Bills & Utilities':
            base_amount *= random.uniform(0.8, 1.5)
            
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
        
    # Anomaly
    for _ in range(2):
        days_ago = random.randint(1, 5)
        date_str = (today - timedelta(days=days_ago)).strftime("%Y-%m-%d")
        amount = round(random.uniform(25000, 35000), 2)
        expense_dict = {
            "id": str(uuid.uuid4()),
            "amount": amount,
            "date": date_str,
            "category": "Shopping",
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
    print(f"Successfully inserted {len(expenses_to_insert)} historical expenses to dev-user.")

asyncio.run(seed())
