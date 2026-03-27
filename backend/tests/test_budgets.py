import pytest
from httpx import AsyncClient
import sys
import os
from pathlib import Path

# Add backend to path
sys.path.append(str(Path(__file__).parent.parent))

from server import app

@pytest.fixture
async def auth_header():
    # Helper to get auth header for tests
    async with AsyncClient(app=app, base_url="http://test") as ac:
        user_email = "budget_tester@example.com"
        # Register if not exists
        await ac.post("/api/auth/register", json={
            "email": user_email,
            "password": "password121",
            "full_name": "Budget Tester"
        })
        # Login
        response = await ac.post("/api/auth/login", data={
            "username": user_email,
            "password": "password121"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

@pytest.mark.asyncio
async def test_create_budget(auth_header):
    async with AsyncClient(app=app, base_url="http://test") as ac:
        # Action: create budget
        response = await ac.post("/api/budgets", json={
            "category": "Food",
            "amount": 5000,
            "period": "monthly"
        }, headers=auth_header)
        
    assert response.status_code == 200
    assert response.json()["category"] == "Food"
    assert response.json()["amount"] == 5000

@pytest.mark.asyncio
async def test_get_budgets_with_spending(auth_header):
    async with AsyncClient(app=app, base_url="http://test") as ac:
        # Setup: create budget & expense
        await ac.post("/api/budgets", json={
            "category": "Travel",
            "amount": 2000
        }, headers=auth_header)
        
        await ac.post("/api/expenses", json={
            "title": "Bus ticket",
            "amount": 500,
            "category": "Travel",
            "date": "2026-03-26"
        }, headers=auth_header)
        
        # Action: get budgets
        response = await ac.get("/api/budgets", headers=auth_header)
        
    assert response.status_code == 200
    budgets = response.json()
    travel_budget = next(b for b in budgets if b["category"] == "Travel")
    assert travel_budget["spent"] == 500
    assert travel_budget["remaining"] == 1500
    assert travel_budget["percentage"] == 25.0
