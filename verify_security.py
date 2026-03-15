import requests
import time

BASE_URL = "http://localhost:5000/api"

def test_security():
    print("--- Verifying Security Layers ---")
    
    # 1. Test Protected Endpoint without Token
    print("\n1. Testing /tasks without token...")
    try:
        r = requests.post(f"{BASE_URL}/tasks", json={"room_id": "TEST", "title": "Fail Task"})
        print(f"Status: {r.status_code} (Expected 401)")
    except Exception as e:
        print(f"Error: {e}")

    # 2. Test Rate Limiting on Health/Auth (Auth is hard to test without real credential, so we test a public but limited one)
    print("\n2. Testing Rate Limiting (10 requests to /rooms/TEST/join)...")
    for i in range(25):
        r = requests.post(f"{BASE_URL}/rooms/NONEXISTENT/join", json={"room_id": "NONEXISTENT", "name": "Spammer"})
        if r.status_code == 429:
            print(f"Request {i+1}: Rate limited! (429) - OK")
            break
        elif r.status_code == 404:
            # OK, but didn't hit rate limit yet
            pass
        else:
            print(f"Request {i+1}: Status {r.status_code}")
    else:
        print("Rate limit NOT triggered (Failed)")

    # 3. Test Guest Auth
    print("\n3. Testing Guest Auth /auth/guest...")
    r = requests.post(f"{BASE_URL}/auth/guest", json={"name": "TestGuest"})
    if r.status_code == 200 and "access_token" in r.json():
        print("Guest Auth: OK (Token received)")
        res_json = r.json()
        token = res_json["access_token"]
        guest_id = res_json["id"]
        
        # Test using the guest token for a protected endpoint
        print("4. Testing /tasks with Guest Token...")
        headers = {"Authorization": f"Bearer {token}"}
        # We need a room where this guest is admin.
        # But we can just check if it DOES NOT return 401 anymore for the auth itself.
        # It might return 403 (Forbidden) if not admin, but not 401.
        r = requests.post(f"{BASE_URL}/tasks", json={"room_id": "TEST", "title": "Guest Task"}, headers=headers)
        if r.status_code != 401:
            print(f"Status: {r.status_code} (Not 401, so JWT is valid!) - OK")
        else:
            print(f"Status: {r.status_code} (Failed, still 401)")
            
        # 5. Test /my-rooms with Guest Token
        print("\n5. Testing /my-rooms/{user_id} with JWT...")
        r = requests.get(f"{BASE_URL}/my-rooms/{guest_id}", headers=headers)
        if r.status_code == 200:
            print(f"Status: {r.status_code} (Access granted with token) - OK")
        else:
            print(f"Status: {r.status_code} (Failed)")

        # 6. Test /vote with Guest Token
        print("\n6. Testing /vote with JWT...")
        r = requests.post(f"{BASE_URL}/vote", json={"room_id": "TEST", "user_id": guest_id, "task_id": "MOCK", "value": "5"}, headers=headers)
        # Might return 403 because task/room doesn't exist, but NOT 401
        if r.status_code != 401:
            print(f"Status: {r.status_code} (Not 401, JWT accepted) - OK")
        else:
            print(f"Status: {r.status_code} (Failed to accept JWT)")
            
    else:
        print(f"Guest Auth: Failed (Status {r.status_code})")

if __name__ == "__main__":
    test_security()
