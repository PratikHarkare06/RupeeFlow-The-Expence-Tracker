import pytest
from fastapi.testclient import TestClient
from motor.motor_asyncio import AsyncIOMotorClient
import sys
import os
from pathlib import Path

# Add backend to path
sys.path.append(str(Path(__file__).parent.parent))

from server import app, db, client

@pytest.fixture(scope="session")
def test_client():
    client = TestClient(app)
    return client

@pytest.fixture(scope="function", autouse=True)
async def clean_db():
    # Use a test database for all tests
    test_db_name = "rupeeflow_test"
    db_test = client[test_db_name]
    
    # Clean before test
    await db_test.users.delete_many({})
    await db_test.expenses.delete_many({})
    await db_test.budgets.delete_many({})
    await db_test.recurring.delete_many({})
    
    # Inject it into server
    import server
    original_db = server.db
    server.db = db_test
    
    yield
    
    # Cleanup after test
    await db_test.users.delete_many({})
    await db_test.expenses.delete_many({})
    await db_test.budgets.delete_many({})
    await db_test.recurring.delete_many({})
    
    # Restore original db
    server.db = original_db
