import logging
from fastapi import APIRouter, HTTPException, Depends
from app.core.security import get_current_user
from app.db.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Users"])

@router.get("/my-rooms/{user_id}")
async def get_user_rooms(user_id: str, current_user_id: str = Depends(get_current_user)):
    if user_id != current_user_id:
        raise HTTPException(403, "Access denied")
    db = get_db()
    if db is None: return []
    return await db.rooms.find({"owner_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(100)

@router.get("/recent-rooms/{user_id}")
async def get_recent_rooms(user_id: str, current_user_id: str = Depends(get_current_user)):
    if user_id != current_user_id:
        raise HTTPException(403, "Access denied")
    db = get_db()
    if db is None: return []
    
    memberships = await db.users.find({"id": user_id}).to_list(100)
    if not memberships: return []
        
    joined_at_map = {}
    for mem in memberships:
        joined_at_map[mem["room_id"]] = mem.get("joined_at", "1970-01-01T00:00:00Z")
        
    room_ids = list(joined_at_map.keys())
    
    rooms_cursor = db.rooms.find({
        "id": {"$in": room_ids},
        "owner_id": {"$ne": user_id}
    }, {"_id": 0})
    
    rooms = await rooms_cursor.to_list(100)
    rooms.sort(key=lambda r: joined_at_map.get(r["id"], ""), reverse=True)
    return rooms
