import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["rupeeflow"]
    
    users = await db.users.find({}).to_list(100)
    for u in users:
        expenses = await db.expenses.find({"user_id": u["id"]}).to_list(1000)
        total = sum([e.get("amount", 0) for e in expenses])
        if len(expenses) > 0:
            print(f"User: {u.get('email', 'N/A')} (ID: {u['id']}) - Expenses Count: {len(expenses)} - Total: {total}")

asyncio.run(check())
