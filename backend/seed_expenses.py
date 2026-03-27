import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import uuid
import random
from datetime import datetime, timedelta

async def seed():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client.expense_tracker
    
    user = await db.users.find_one({})
    if not user:
        print("No users found in database.")
        return
        
    user_id = user["id"]
    print(f"Seeding expenses for user {user_id}")
    
    categories = ['Food & Dining', 'Transportation', 'Home & Family', 'Entertainment', 'Shopping', 'Bills & Utilities']
    merchants = {
        'Food & Dining': ['Zomato', 'Swiggy', 'Starbucks', 'McDonalds', 'Local Cafe'],
        'Transportation': ['Uber', 'Ola', 'Petrol Pump', 'Metro', 'Indian Railways'],
        'Home & Family': ['D-Mart', 'BigBasket Instamart', 'IKEA', 'Hardware Store'],
        'Entertainment': ['Netflix', 'Amazon Prime', 'PVR Cinemas', 'BookMyShow'],
        'Shopping': ['Amazon', 'Flipkart', 'Zara', 'H&M', 'Myntra'],
        'Bills & Utilities': ['Electricity Board', 'JioFiber', 'Airtel', 'Water Bill']
    }
    
    expenses_to_insert = []
    today = datetime.now()
    
    # Generate ~60 expenses over the last 90 days
    for _ in range(60):
        days_ago = random.randint(1, 90)
        expense_date = today - timedelta(days=days_ago)
        date_str = expense_date.strftime("%Y-%m-%d")
        
        category = random.choice(categories)
        merchant = random.choice(merchants[category])
        
        # Add slight variations + heavier expenses for certain categories
        base_amount = random.uniform(50, 1500)
        if category in ['Shopping', 'Bills & Utilities']:
            base_amount *= random.uniform(1.5, 3.0)
            
        expense_dict = {
            "id": str(uuid.uuid4()),
            "amount": round(base_amount, 2),
            "date": date_str,
            "category": category,
            "description": f"Payment at {merchant}",
            "user_id": user_id,
            "merchant": merchant,
            "needs_confirmation": False,
            "original_currency": "INR",
            "original_amount": round(base_amount, 2),
            "exchange_rate": 1.0,
            "_id": None # Let Mongo generate ObjectId
        }
        del expense_dict["_id"]
        expenses_to_insert.append(expense_dict)
        
    await db.expenses.insert_many(expenses_to_insert)
    print(f"Successfully inserted {len(expenses_to_insert)} historical expenses spanning 90 days.")

asyncio.run(seed())
