import socketio
import logging
from typing import Optional, Dict, Any
from app.db.database import get_db
from app.models.domain import FIBONACCI_VALUES

logger = logging.getLogger(__name__)

sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*', logger=True, engineio_logger=True, allow_eio3=True)
socket_users = {}

async def get_room_state(room_id: str, include_votes: bool = False, requesting_user_id: Optional[str] = None) -> Dict[str, Any]:
    room_id = room_id.upper()
    db = get_db()
    if db is None: return {}
    
    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    if not room: return {}
    
    users = await db.users.find({"room_id": room_id, "is_online": {"$ne": False}}, {"_id": 0}).to_list(100)
    tasks = await db.tasks.find({"room_id": room_id}, {"_id": 0}).sort("position", 1).to_list(100)
    
    active_task = None
    if room.get("active_task_id"):
        active_task = await db.tasks.find_one({"id": room["active_task_id"]}, {"_id": 0})
    
    votes = []
    if active_task:
        raw_votes = await db.votes.find({"task_id": active_task["id"]}, {"_id": 0}).to_list(100)
        if room.get("cards_revealed") or include_votes:
            votes = raw_votes
        else:
            votes = []
            for v in raw_votes:
                if requesting_user_id and v["user_id"] == requesting_user_id:
                    votes.append({"user_id": v["user_id"], "value": v["value"], "has_voted": True})
                else:
                    votes.append({"user_id": v["user_id"], "has_voted": True})
        voted_ids = {v["user_id"] for v in raw_votes}
        for user in users: user["has_voted"] = user["id"] in voted_ids
    
    if "deck_type" not in room: room["deck_type"] = "FIBONACCI"
    if "deck_values" not in room: room["deck_values"] = [str(v) for v in FIBONACCI_VALUES]
    if "timer_end" not in room: room["timer_end"] = None
    
    return {"room": room, "users": users, "tasks": tasks, "votes": votes, "active_task": active_task}

async def broadcast_room_state(room_id: str):
    db = get_db()
    if db is None: return
    room_id = room_id.upper()
    state = await get_room_state(room_id)
    logger.info(f"📢 BROADCAST: Enviando update para sala {room_id}")
    await sio.emit('state_update', state, room=room_id)

async def check_all_voted(room_id: str, task_id: str) -> bool:
    db = get_db()
    if db is None: return False
    room_id = room_id.upper()
    voters = await db.users.find({"room_id": room_id, "is_spectator": False, "is_online": {"$ne": False}}).to_list(100)
    votes = await db.votes.find({"task_id": task_id}).to_list(100)
    if not voters: return False
    return all(user["id"] in {v["user_id"] for v in votes} for user in voters)


@sio.event
async def connect(sid, environ): return True

@sio.event
async def disconnect(sid):
    user_info = socket_users.get(sid)
    if user_info:
        user_id = user_info["user_id"]
        room_id = user_info["room_id"]
        logger.info(f"🔌 Socket Disconnect: User {user_id} from Room {room_id}")
        del socket_users[sid]
        
        db = get_db()
        if db is not None:
            await db.users.update_one({"id": user_id, "room_id": room_id}, {"$set": {"is_online": False}})
            
            room = await db.rooms.find_one({"id": room_id})
            if room and room.get("active_task_id") and not room.get("cards_revealed"):
                if await check_all_voted(room_id, room["active_task_id"]):
                    await db.rooms.update_one({"id": room_id}, {"$set": {"cards_revealed": True}})
                    state = await get_room_state(room_id, include_votes=True)
                    await sio.emit('reveal_votes', state, room=room_id)
                    return
            await broadcast_room_state(room_id)

@sio.event
async def join_room(sid, data):
    room_id = data.get("room_id").upper()
    user_id = data.get("user_id")
    logger.info(f"🔌 Socket Join: Room {room_id}")
    await sio.enter_room(sid, room_id)
    socket_users[sid] = {"room_id": room_id, "user_id": user_id}
    
    db = get_db()
    if db is not None:
        await db.users.update_one({"id": user_id, "room_id": room_id}, {"$set": {"is_online": True}})
        await broadcast_room_state(room_id)
