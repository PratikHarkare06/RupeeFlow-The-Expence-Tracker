import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["rupeeflow"]
    
    users = await db.users.find({}).to_list(10)
    for u in users:
        count = await db.expenses.count_documents({"user_id": u["id"]})
        print(f"User: {u.get('username', 'N/A')} (ID: {u['id']}) - Expenses: {count}")

asyncio.run(check())
