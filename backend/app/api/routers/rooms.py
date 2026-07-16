import uuid
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Request, HTTPException, Depends
from jose import JWTError, jwt

from app.models.domain import Room, RoomCreate, UserJoin, get_deck_values, FIBONACCI_VALUES
from app.core.security import get_current_user, limiter, settings
from app.db.database import get_db
from app.services.socket import get_room_state

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/rooms", tags=["Rooms"])

@router.post("", response_model=Room)
@limiter.limit("10/minute")
async def create_room(request: Request, input: RoomCreate, current_user_id: str = Depends(get_current_user)):
    input.owner_id = current_user_id
    values = get_deck_values(input.deck_type, input.custom_deck)
    logger.info(f"🆕 Criando sala: {input.name} | Deck: {input.deck_type} | Valores: {values}")
    
    room = Room(
        name=input.name, 
        owner_id=input.owner_id,
        deck_type=input.deck_type,
        deck_values=values
    )
    
    db = get_db()
    if db is not None:
        await db.rooms.insert_one(room.model_dump())
    return room

@router.post("/{room_id}/join")
@limiter.limit("20/minute")
async def join_room_http(request: Request, room_id: str, input: UserJoin):
    room_id = room_id.upper()
    db = get_db()
    
    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    if not room: raise HTTPException(404, "Room not found")
    
    if "deck_type" not in room: room["deck_type"] = "FIBONACCI"
    if "deck_values" not in room: room["deck_values"] = [str(v) for v in FIBONACCI_VALUES]
    
    is_owner = input.user_id and room.get("owner_id") == input.user_id
    
    is_admin = False
    if is_owner:
        is_admin = True
    else:
        existing_count = await db.users.count_documents({"room_id": room_id, "id": {"$ne": input.user_id} if input.user_id else {}})
        is_admin = (existing_count == 0)
        
    user_id = input.user_id or str(uuid.uuid4())
    user_data = {
        "id": user_id,
        "room_id": room_id,
        "name": input.name,
        "picture": input.picture,
        "is_admin": is_admin,
        "is_spectator": input.is_spectator,
        "is_online": True,
        "joined_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.update_one(
        {"id": user_id, "room_id": room_id},
        {"$set": user_data},
        upsert=True
    )
    
    final_user_doc = await db.users.find_one({"id": user_id, "room_id": room_id}, {"_id": 0})
    return {"user": final_user_doc, "room": room}

@router.get("/{room_id}/state")
async def get_state_http(room_id: str, request: Request):
    requesting_user_id = None
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.ALGORITHM])
            requesting_user_id = payload.get("sub")
        except JWTError:
            pass
    return await get_room_state(room_id.upper(), requesting_user_id=requesting_user_id)


