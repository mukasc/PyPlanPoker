import httpx
import json

async def test_create_room():
    url = "http://localhost:5000/api/rooms"
    payload = {
        "name": "Validation Room",
        "deck_type": "T_SHIRT"
    }
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, json=payload)
            print(f"Status: {response.status_code}")
            print(f"Response: {json.dumps(response.json(), indent=2)}")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_create_room())
