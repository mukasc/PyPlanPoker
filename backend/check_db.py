import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
import json

ROOT_DIR = Path(r"c:\\Users\\mukas\\.gemini\\antigravity\\scratch\\PyPlanPoker\\backend")
load_dotenv(ROOT_DIR / '.env')

async def main():
    mongo_url = os.environ.get('MONGO_URL')
    db_name = os.environ.get('DB_NAME', 'pyplanpoker')
    
    if not mongo_url:
        print("No DB URL")
        return
        
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    rooms = await db.rooms.find().sort("created_at", -1).limit(3).to_list(10)
    for r in rooms:
        r['_id'] = str(r['_id'])
        print(f"Room ID: {r.get('id')} | Name:  {r.get('name')} | Deck Type:  {r.get('deck_type')}")
        print(f"Deck Values: {r.get('deck_values')}\n")

if __name__ == "__main__":
    asyncio.run(main())
