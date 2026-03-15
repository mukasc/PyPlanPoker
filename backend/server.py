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
from jose import JWTError, jwt
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

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

# --- SECURITY CONFIG ---
SECRET_KEY = os.environ.get("JWT_SECRET", "super-secret-key-change-it-in-prod")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 1 week

limiter = Limiter(key_func=get_remote_address)
security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except JWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc).timestamp() + (ACCESS_TOKEN_EXPIRE_MINUTES * 60)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

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
class GuestAuth(BaseModel): name: str

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
class ActionReorder(ActionBase): task_ids: List[str]

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
    position: int = 0

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
fastapi_app.state.limiter = limiter
fastapi_app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

api_router = APIRouter(prefix="/api")
socket_app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app, socketio_path='/api/socket.io')

# CORS Config: In a real app, this should be restricted to known domains
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "*").split(",")
fastapi_app.add_middleware(
    CORSMiddleware, 
    allow_origins=ALLOWED_ORIGINS, 
    allow_credentials=True, 
    allow_methods=["*"], 
    allow_headers=["*"]
)

@fastapi_app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; object-src 'none';"
    return response
socket_users = {}

# --- HELPER FUNCTIONS ---
async def get_room_state(room_id: str, include_votes: bool = False) -> Dict[str, Any]:
    room_id = room_id.upper() # Garantia Extra
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
@limiter.limit("5/minute")
async def auth_google(request: Request, input: AuthGoogle):
    try:
        client_id = os.environ.get('GOOGLE_CLIENT_ID')
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
        
        token = create_access_token(data={"sub": userid})
        
        return {
            "id": userid,
            "email": email,
            "name": name,
            "picture": picture,
            "access_token": token,
            "token_type": "bearer"
        }
    except ValueError as e:
        logger.error(f"Google auth error: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")

@api_router.post("/auth/guest")
@limiter.limit("10/minute")
async def auth_guest(request: Request, input: GuestAuth):
    guest_id = f"guest-{str(uuid.uuid4())[:12]}"
    token = create_access_token(data={"sub": guest_id, "is_guest": True})
    return {
        "id": guest_id,
        "name": input.name,
        "access_token": token,
        "token_type": "bearer",
        "is_guest": True
    }

@api_router.post("/rooms", response_model=Room)
@limiter.limit("10/minute")
async def create_room(request: Request, input: RoomCreate, current_user_id: str = Depends(get_current_user)):
    # Overwrite owner_id with authenticated user ID
    input.owner_id = current_user_id
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
@limiter.limit("20/minute")
async def join_room_http(request: Request, room_id: str, input: UserJoin):
    # Join room remains public for now but could be restricted if needed. 
    # Usually users join via a link.
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
async def get_user_rooms(user_id: str, current_user_id: str = Depends(get_current_user)):
    if user_id != current_user_id:
        raise HTTPException(403, "Access denied")
    if db is None: return []
    return await db.rooms.find({"owner_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(100)

@api_router.get("/rooms/{room_id}/state")
async def get_state_http(room_id: str):
    return await get_room_state(room_id.upper())

@api_router.post("/tasks", response_model=Task)
async def create_task(input: TaskCreate, current_user_id: str = Depends(get_current_user)):
    input.room_id = input.room_id.upper()
    # verify user is admin of room (simplified for now as rooms don't strictly auth join)
    # but we check if they are owner or have an admin doc
    user = await db.users.find_one({"id": current_user_id, "room_id": input.room_id})
    if not user or not user.get("is_admin"):
        raise HTTPException(403, "Only admins can add tasks")

    # Get current max position
    last_task = await db.tasks.find_one({"room_id": input.room_id}, sort=[("position", -1)])
    next_position = (last_task.get("position", 0) + 1) if last_task else 0
    
    task = Task(room_id=input.room_id, title=input.title, description=input.description or "", position=next_position)
    await db.tasks.insert_one(task.model_dump())
    await broadcast_room_state(input.room_id)
    return task

@api_router.get("/rooms/{room_id}/tasks")
async def get_tasks(room_id: str):
    return await db.tasks.find({"room_id": room_id.upper()}, {"_id": 0}).sort("position", 1).to_list(100)

@api_router.get("/fibonacci")
async def get_fibonacci(): return {"values": FIBONACCI_VALUES}

# --- AÇÕES HTTP (COM BROADCAST) ---
@api_router.post("/active-task")
async def set_active_task_http(action: ActionActiveTask, current_user_id: str = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user_id, "room_id": action.room_id})
    if not user or not user.get("is_admin"): raise HTTPException(403, "Admin only")
    
    await db.tasks.update_many({"room_id": action.room_id, "status": TaskStatus.ACTIVE}, {"$set": {"status": TaskStatus.PENDING}})
    await db.tasks.update_one(
        {"id": action.task_id}, 
        {"$set": {
            "status": TaskStatus.ACTIVE,
            "final_score": None,
            "votes_summary": []
        }}
    )
    await db.rooms.update_one({"id": action.room_id}, {"$set": {"active_task_id": action.task_id, "cards_revealed": False}})
    await db.votes.delete_many({"task_id": action.task_id})
    await broadcast_room_state(action.room_id)
    return {"status": "success"}

@api_router.post("/vote")
async def cast_vote_http(action: ActionVote, current_user_id: str = Depends(get_current_user)):
    if action.user_id != current_user_id:
        raise HTTPException(403, "User ID mismatch")
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
async def reveal_cards_http(action: ActionReveal, current_user_id: str = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user_id, "room_id": action.room_id})
    if not user or not user.get("is_admin"): raise HTTPException(403, "Admin only")
    await db.rooms.update_one({"id": action.room_id}, {"$set": {"cards_revealed": True}})
    state = await get_room_state(action.room_id, include_votes=True)
    await sio.emit('reveal_votes', state, room=action.room_id)
    return {"status": "success"}

@api_router.post("/reset")
async def reset_votes_http(action: ActionReset, current_user_id: str = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user_id, "room_id": action.room_id})
    if not user or not user.get("is_admin"): raise HTTPException(403, "Admin only")
    if action.task_id: await db.votes.delete_many({"task_id": action.task_id})
    await db.rooms.update_one({"id": action.room_id}, {"$set": {"cards_revealed": False}})
    await broadcast_room_state(action.room_id)
    return {"status": "success"}

@api_router.post("/complete")
async def complete_task_http(action: ActionComplete, current_user_id: str = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user_id, "room_id": action.room_id})
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
async def delete_task_http(action: ActionDelete, current_user_id: str = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user_id, "room_id": action.room_id})
    if not user or not user.get("is_admin"): raise HTTPException(403, "Admin only")
    room = await db.rooms.find_one({"id": action.room_id})
    if room and room.get("active_task_id") == action.task_id:
        await db.rooms.update_one({"id": action.room_id}, {"$set": {"active_task_id": None, "cards_revealed": False}})
    await db.tasks.delete_one({"id": action.task_id})
    await db.votes.delete_many({"task_id": action.task_id})
    await broadcast_room_state(action.room_id)
    return {"status": "success"}

@api_router.post("/cancel-task")
async def cancel_task_http(action: ActionDelete, current_user_id: str = Depends(get_current_user)): 
    user = await db.users.find_one({"id": current_user_id, "room_id": action.room_id})
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
async def kick_user_http(action: ActionKick, current_user_id: str = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user_id, "room_id": action.room_id})
    if not user or not user.get("is_admin"): raise HTTPException(403, "Admin only")
    
    # Remove do DB
    await db.users.delete_one({"id": action.target_user_id, "room_id": action.room_id})
    await db.votes.delete_many({"user_id": action.target_user_id, "room_id": action.room_id})
    
    # Emite evento especifico para a sala inteira (quem for o target vai se auto-remover no frontend)
    await sio.emit('kicked', {"target_user_id": action.target_user_id}, room=action.room_id)
    
    await broadcast_room_state(action.room_id)
    return {"status": "success"}

@api_router.post("/start-timer")
async def start_timer_http(action: ActionTimer, current_user_id: str = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user_id, "room_id": action.room_id})
    if not user or not user.get("is_admin"): raise HTTPException(403, "Admin only")
    
    timer_end = (datetime.now(timezone.utc).timestamp() + action.duration_seconds)
    # Store as ISO string or timestamp? Let's use ISO for consistency with other dates
    timer_end_iso = datetime.fromtimestamp(timer_end, tz=timezone.utc).isoformat()
    
    await db.rooms.update_one({"id": action.room_id}, {"$set": {"timer_end": timer_end_iso}})
    await broadcast_room_state(action.room_id)
    return {"status": "success", "timer_end": timer_end_iso}

@api_router.post("/stop-timer")
async def stop_timer_http(action: ActionBase, current_user_id: str = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user_id, "room_id": action.room_id})
    if not user or not user.get("is_admin"): raise HTTPException(403, "Admin only")
    
    await db.rooms.update_one({"id": action.room_id}, {"$set": {"timer_end": None}})
    await broadcast_room_state(action.room_id)
    return {"status": "success"}

@api_router.post("/reorder-tasks")
async def reorder_tasks_http(action: ActionReorder, current_user_id: str = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user_id, "room_id": action.room_id})
    if not user or not user.get("is_admin"): raise HTTPException(403, "Admin only")
    
    # Update position for each task
    for index, task_id in enumerate(action.task_ids):
        await db.tasks.update_one(
            {"id": task_id, "room_id": action.room_id},
            {"$set": {"position": index}}
        )
    
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