import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["rupeeflow"]
    
    expenses = await db.expenses.find({"user_id": "dev-user"}).to_list(1000)
    total = sum([e.get("amount", 0) for e in expenses])
    print(f"dev-user has {len(expenses)} expenses. Total: {total}")

asyncio.run(check())
