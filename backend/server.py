import socketio
import os
import logging
import uuid
from pathlib import Path
from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict, field_validator
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

# --- CONFIGURAÇÃO ---
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

mongo_url = os.environ.get('MONGO_URL')
db_name = os.environ.get('DB_NAME', 'pyplanpoker')
client = None
db = None

if mongo_url:
    try:
        client = AsyncIOMotorClient(mongo_url)
        db = client[db_name]
        logger.info(f"✅ MongoDB Conectado: {db_name}")
    except Exception as e:
        logger.error(f"❌ Erro MongoDB: {e}")

FIBONACCI_VALUES = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, "?"]

class TaskStatus(str, Enum):
    PENDING = "PENDING"
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED" # <--- Novo

# --- MODELOS COM VALIDAÇÃO DE UPPERCASE ---
class RoomCreate(BaseModel):
    name: str
    owner_id: Optional[str] = None
    deck_type: str = "FIBONACCI"
    custom_deck: Optional[str] = None

class UserJoin(BaseModel): room_id: str; name: str; user_id: Optional[str] = None; picture: Optional[str] = None; is_spectator: bool = False
class TaskCreate(BaseModel): room_id: str; title: str; description: Optional[str] = ""

class AuthGoogle(BaseModel): credential: str

class ActionBase(BaseModel):
    room_id: str
    user_id: str
    # Validador automático para forçar UPPERCASE no room_id
    @field_validator('room_id')
    def uppercase_room_id(cls, v): return v.upper()

class ActionActiveTask(ActionBase): task_id: str
class ActionVote(ActionBase): task_id: str; value: str
class ActionReveal(ActionBase): pass
class ActionReset(ActionBase): task_id: Optional[str] = None
class ActionComplete(ActionBase): task_id: str; final_score: str
class ActionDelete(ActionBase): task_id: str
class ActionKick(ActionBase): target_user_id: str
class ActionTimer(ActionBase): duration_seconds: int

class Room(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8].upper())
    name: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    owner_id: Optional[str] = None
    cards_revealed: bool = False
    active_task_id: Optional[str] = None
    deck_type: str = "FIBONACCI"
    deck_values: List[str] = [str(v) for v in FIBONACCI_VALUES]
    timer_end: Optional[str] = None

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    room_id: str
    name: str
    picture: Optional[str] = None
    is_admin: bool = False
    is_spectator: bool = False
    has_voted: bool = False
    is_online: bool = True

class Task(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    room_id: str
    title: str
    description: str = ""
    status: TaskStatus = TaskStatus.PENDING
    final_score: Optional[str] = None
    votes_summary: List[Dict[str, Any]] = []

def get_deck_values(deck_type: str, custom_deck: Optional[str] = None) -> List[str]:
    if deck_type == "T_SHIRT":
        return ["XS", "S", "M", "L", "XL", "XXL", "?"]
    elif deck_type == "SEQUENTIAL":
        return ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "?"]
    elif deck_type == "CUSTOM" and custom_deck:
        return [v.strip() for v in custom_deck.split(",") if v.strip()]
    return [str(v) for v in FIBONACCI_VALUES]


class Vote(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    task_id: str
    user_id: str
    value: str

# --- SOCKET SETUP ---
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*', logger=True, engineio_logger=True, allow_eio3=True)
fastapi_app = FastAPI()
api_router = APIRouter(prefix="/api")
socket_app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app, socketio_path='/api/socket.io')

fastapi_app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
socket_users = {}

# --- HELPER FUNCTIONS ---
async def get_room_state(room_id: str, include_votes: bool = False) -> Dict[str, Any]:
    room_id = room_id.upper() # Garantia Extra
    if db is None: return {}
    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    if not room: return {}
    
    users = await db.users.find({"room_id": room_id, "is_online": {"$ne": False}}, {"_id": 0}).to_list(100)
    tasks = await db.tasks.find({"room_id": room_id}, {"_id": 0}).to_list(100)
    
    active_task = None
    if room.get("active_task_id"):
        active_task = await db.tasks.find_one({"id": room["active_task_id"]}, {"_id": 0})
    
    votes = []
    if active_task:
        raw_votes = await db.votes.find({"task_id": active_task["id"]}, {"_id": 0}).to_list(100)
        votes = raw_votes if (room.get("cards_revealed") or include_votes) else [{"user_id": v["user_id"], "has_voted": True} for v in raw_votes]
        voted_ids = {v["user_id"] for v in raw_votes}
        for user in users: user["has_voted"] = user["id"] in voted_ids
    
    # Defensive defaults for deck
    if "deck_type" not in room: room["deck_type"] = "FIBONACCI"
    if "deck_values" not in room: room["deck_values"] = [str(v) for v in FIBONACCI_VALUES]
    if "timer_end" not in room: room["timer_end"] = None
    
    return {"room": room, "users": users, "tasks": tasks, "votes": votes, "active_task": active_task}

async def broadcast_room_state(room_id: str):
    if db is None: return
    room_id = room_id.upper() # Garantia Extra
    state = await get_room_state(room_id)
    # Debug no log para sabermos que enviou
    logger.info(f"📢 BROADCAST: Enviando update para sala {room_id}")
    await sio.emit('state_update', state, room=room_id)

async def check_all_voted(room_id: str, task_id: str) -> bool:
    if db is None: return False
    room_id = room_id.upper()
    voters = await db.users.find({"room_id": room_id, "is_spectator": False, "is_online": {"$ne": False}}).to_list(100)
    votes = await db.votes.find({"task_id": task_id}).to_list(100)
    if not voters: return False
    return all(user["id"] in {v["user_id"] for v in votes} for user in voters)

# --- ROTAS HTTP ---
@fastapi_app.get("/api/health")
async def health(): return {"status": "online"}

@api_router.post("/auth/google")
async def auth_google(input: AuthGoogle):
    try:
        client_id = os.environ.get('GOOGLE_CLIENT_ID')
        # If client_id is None, it won't check audience, useful for local testing
        idinfo = id_token.verify_oauth2_token(input.credential, google_requests.Request(), client_id)
        
        userid = idinfo['sub']
        email = idinfo.get('email', '')
        name = idinfo.get('name', '')
        picture = idinfo.get('picture', '')

        if db is not None:
             await db.global_users.update_one(
                 {"id": userid},
                 {"$set": {"email": email, "name": name, "picture": picture}},
                 upsert=True
             )
        
        return {
            "id": userid,
            "email": email,
            "name": name,
            "picture": picture
        }
    except ValueError as e:
        logger.error(f"Google auth error: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")

@api_router.post("/rooms", response_model=Room)
async def create_room(input: RoomCreate):
    values = get_deck_values(input.deck_type, input.custom_deck)
    logger.info(f"🆕 Criando sala: {input.name} | Deck: {input.deck_type} | Valores: {values}")
    room = Room(
        name=input.name, 
        owner_id=input.owner_id,
        deck_type=input.deck_type,
        deck_values=values
    )
    await db.rooms.insert_one(room.model_dump())
    return room

@api_router.post("/rooms/{room_id}/join")
async def join_room_http(room_id: str, input: UserJoin):
    room_id = room_id.upper()
    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    if not room: raise HTTPException(404, "Room not found")
    
    # Defensive defaults for deck
    if "deck_type" not in room: room["deck_type"] = "FIBONACCI"
    if "deck_values" not in room: room["deck_values"] = [str(v) for v in FIBONACCI_VALUES]
    
    # Check if this user is the owner
    is_owner = input.user_id and room.get("owner_id") == input.user_id
    logger.info(f"🔍 Join Check: user_id={input.user_id}, owner_id={room.get('owner_id')}, is_owner={is_owner}")
    
    # Grant admin if it's the first user OR if it's the owner re-joining
    is_admin = False
    if is_owner:
        is_admin = True
    else:
        existing_count = await db.users.count_documents({"room_id": room_id, "id": {"$ne": input.user_id} if input.user_id else {}})
        is_admin = (existing_count == 0)
        logger.info(f"🔍 Admin Check: existing_count={existing_count}, is_admin={is_admin}")
        
    user_id = input.user_id or str(uuid.uuid4())
    user_data = {
        "id": user_id,
        "room_id": room_id,
        "name": input.name,
        "picture": input.picture,
        "is_admin": is_admin,
        "is_spectator": input.is_spectator,
        "is_online": True
    }
    
    await db.users.update_one(
        {"id": user_id, "room_id": room_id},
        {"$set": user_data},
        upsert=True
    )
    
    # Refresh to get the latest state from DB (including any defaults)
    final_user_doc = await db.users.find_one({"id": user_id, "room_id": room_id}, {"_id": 0})
    return {"user": final_user_doc, "room": room}

@api_router.get("/my-rooms/{user_id}")
async def get_user_rooms(user_id: str):
    if db is None: return []
    return await db.rooms.find({"owner_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(100)

@api_router.get("/rooms/{room_id}/state")
async def get_state_http(room_id: str):
    return await get_room_state(room_id.upper())

@api_router.post("/tasks", response_model=Task)
async def create_task(input: TaskCreate):
    input.room_id = input.room_id.upper()
    task = Task(room_id=input.room_id, title=input.title, description=input.description or "")
    await db.tasks.insert_one(task.model_dump())
    await broadcast_room_state(input.room_id)
    return task

@api_router.get("/rooms/{room_id}/tasks")
async def get_tasks(room_id: str):
    return await db.tasks.find({"room_id": room_id.upper()}, {"_id": 0}).to_list(100)

@api_router.get("/fibonacci")
async def get_fibonacci(): return {"values": FIBONACCI_VALUES}

# --- AÇÕES HTTP (COM BROADCAST) ---
@api_router.post("/active-task")
async def set_active_task_http(action: ActionActiveTask):
    user = await db.users.find_one({"id": action.user_id})
    if not user or not user.get("is_admin"): raise HTTPException(403, "Admin only")
    
    await db.tasks.update_many({"room_id": action.room_id, "status": TaskStatus.ACTIVE}, {"$set": {"status": TaskStatus.PENDING}})
    await db.tasks.update_one({"id": action.task_id}, {"$set": {"status": TaskStatus.ACTIVE}})
    await db.rooms.update_one({"id": action.room_id}, {"$set": {"active_task_id": action.task_id, "cards_revealed": False}})
    await db.votes.delete_many({"task_id": action.task_id})
    await broadcast_room_state(action.room_id)
    return {"status": "success"}

@api_router.post("/vote")
async def cast_vote_http(action: ActionVote):
    user = await db.users.find_one({"id": action.user_id})
    if not user or user.get("is_spectator"): raise HTTPException(403, "Cannot vote")
    
    await db.votes.delete_one({"task_id": action.task_id, "user_id": action.user_id})
    vote = Vote(task_id=action.task_id, user_id=action.user_id, value=str(action.value))
    await db.votes.insert_one(vote.model_dump())
    
    if await check_all_voted(action.room_id, action.task_id):
        await db.rooms.update_one({"id": action.room_id}, {"$set": {"cards_revealed": True}})
        state = await get_room_state(action.room_id, include_votes=True)
        await sio.emit('reveal_votes', state, room=action.room_id)
    else:
        await broadcast_room_state(action.room_id)
    return {"status": "success"}

@api_router.post("/reveal")
async def reveal_cards_http(action: ActionReveal):
    user = await db.users.find_one({"id": action.user_id})
    if not user or not user.get("is_admin"): raise HTTPException(403, "Admin only")
    await db.rooms.update_one({"id": action.room_id}, {"$set": {"cards_revealed": True}})
    state = await get_room_state(action.room_id, include_votes=True)
    await sio.emit('reveal_votes', state, room=action.room_id)
    return {"status": "success"}

@api_router.post("/reset")
async def reset_votes_http(action: ActionReset):
    user = await db.users.find_one({"id": action.user_id})
    if not user or not user.get("is_admin"): raise HTTPException(403, "Admin only")
    if action.task_id: await db.votes.delete_many({"task_id": action.task_id})
    await db.rooms.update_one({"id": action.room_id}, {"$set": {"cards_revealed": False}})
    await broadcast_room_state(action.room_id)
    return {"status": "success"}

@api_router.post("/complete")
async def complete_task_http(action: ActionComplete):
    user = await db.users.find_one({"id": action.user_id})
    if not user or not user.get("is_admin"): raise HTTPException(403, "Admin only")
    
    # Capture current votes for history
    votes = await db.votes.find({"task_id": action.task_id}).to_list(100)
    votes_summary = []
    for v in votes:
        v_user = await db.users.find_one({"id": v["user_id"]})
        votes_summary.append({
            "name": v_user["name"] if v_user else "Unknown",
            "value": v["value"]
        })
    
    await db.tasks.update_one(
        {"id": action.task_id}, 
        {"$set": {
            "status": TaskStatus.COMPLETED, 
            "final_score": str(action.final_score),
            "votes_summary": votes_summary
        }}
    )
    await db.rooms.update_one({"id": action.room_id}, {"$set": {"active_task_id": None, "cards_revealed": False}})
    await broadcast_room_state(action.room_id)
    return {"status": "success"}

@api_router.post("/delete-task")
async def delete_task_http(action: ActionDelete):
    user = await db.users.find_one({"id": action.user_id})
    if not user or not user.get("is_admin"): raise HTTPException(403, "Admin only")
    room = await db.rooms.find_one({"id": action.room_id})
    if room and room.get("active_task_id") == action.task_id:
        await db.rooms.update_one({"id": action.room_id}, {"$set": {"active_task_id": None, "cards_revealed": False}})
    await db.tasks.delete_one({"id": action.task_id})
    await db.votes.delete_many({"task_id": action.task_id})
    await broadcast_room_state(action.room_id)
    return {"status": "success"}

@api_router.post("/cancel-task")
async def cancel_task_http(action: ActionDelete): # Reutilizamos ActionDelete pois só precisa de task_id
    user = await db.users.find_one({"id": action.user_id})
    if not user or not user.get("is_admin"): raise HTTPException(403, "Admin only")
    
    # Se a tarefa sendo cancelada for a ativa, remove ela do slot ativo da sala
    room = await db.rooms.find_one({"id": action.room_id})
    if room and room.get("active_task_id") == action.task_id:
        await db.rooms.update_one({"id": action.room_id}, {"$set": {"active_task_id": None, "cards_revealed": False}})
    
    # Atualiza status
    await db.tasks.update_one({"id": action.task_id}, {"$set": {"status": TaskStatus.CANCELLED}})
    await broadcast_room_state(action.room_id)
    return {"status": "success"}

@api_router.post("/kick")
async def kick_user_http(action: ActionKick):
    user = await db.users.find_one({"id": action.user_id})
    if not user or not user.get("is_admin"): raise HTTPException(403, "Admin only")
    
    # Remove do DB
    await db.users.delete_one({"id": action.target_user_id, "room_id": action.room_id})
    await db.votes.delete_many({"user_id": action.target_user_id, "room_id": action.room_id})
    
    # Emite evento especifico para a sala inteira (quem for o target vai se auto-remover no frontend)
    await sio.emit('kicked', {"target_user_id": action.target_user_id}, room=action.room_id)
    
    await broadcast_room_state(action.room_id)
    return {"status": "success"}

@api_router.post("/start-timer")
async def start_timer_http(action: ActionTimer):
    user = await db.users.find_one({"id": action.user_id})
    if not user or not user.get("is_admin"): raise HTTPException(403, "Admin only")
    
    timer_end = (datetime.now(timezone.utc).timestamp() + action.duration_seconds)
    # Store as ISO string or timestamp? Let's use ISO for consistency with other dates
    timer_end_iso = datetime.fromtimestamp(timer_end, tz=timezone.utc).isoformat()
    
    await db.rooms.update_one({"id": action.room_id}, {"$set": {"timer_end": timer_end_iso}})
    await broadcast_room_state(action.room_id)
    return {"status": "success", "timer_end": timer_end_iso}

@api_router.post("/stop-timer")
async def stop_timer_http(action: ActionBase):
    user = await db.users.find_one({"id": action.user_id})
    if not user or not user.get("is_admin"): raise HTTPException(403, "Admin only")
    
    await db.rooms.update_one({"id": action.room_id}, {"$set": {"timer_end": None}})
    await broadcast_room_state(action.room_id)
    return {"status": "success"}

# --- SOCKET EVENTS ---
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
        
        if db is not None:
            await db.users.update_one({"id": user_id}, {"$set": {"is_online": False}})
            
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
    # FORCE UPPERCASE
    room_id = data.get("room_id").upper()
    user_id = data.get("user_id")
    logger.info(f"🔌 Socket Join: Room {room_id}")
    await sio.enter_room(sid, room_id)
    socket_users[sid] = {"room_id": room_id, "user_id": user_id}
    if db is not None:
        await db.users.update_one({"id": user_id}, {"$set": {"is_online": True}})
        await broadcast_room_state(room_id)

fastapi_app.include_router(api_router)
app = socket_app

# --- INICIALIZAÇÃO PARA RENDER/LOCAL ---
if __name__ == "__main__":
    import uvicorn
    # Pega a porta do ambiente (Render injeta a variável PORT) ou usa 5000 localmente
    port = int(os.environ.get("PORT", 5000))
    logger.info(f"🚀 Iniciando servidor na porta {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)