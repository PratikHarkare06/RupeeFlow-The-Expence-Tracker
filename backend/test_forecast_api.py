import requests

try:
    # We will pass 'mock-token' which get_current_user auto-accepts
    headers = {"Authorization": "Bearer mock-token"}
    url = "http://localhost:8001/api/ai/forecast"
    response = requests.get(url, headers=headers)
    print("STATUS", response.status_code)
    print("JSON", response.json())
except Exception as e:
    print("FAILED", e)
