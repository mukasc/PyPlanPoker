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
class RoomCreate(BaseModel): name: str
class UserJoin(BaseModel): room_id: str; name: str; is_spectator: bool = False
class TaskCreate(BaseModel): room_id: str; title: str; description: Optional[str] = ""

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

class Room(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8].upper())
    name: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    cards_revealed: bool = False
    active_task_id: Optional[str] = None

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    room_id: str
    name: str
    is_admin: bool = False
    is_spectator: bool = False
    has_voted: bool = False

class Task(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    room_id: str
    title: str
    description: str = ""
    status: TaskStatus = TaskStatus.PENDING
    final_score: Optional[str] = None

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
    
    users = await db.users.find({"room_id": room_id}, {"_id": 0}).to_list(100)
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
    voters = await db.users.find({"room_id": room_id, "is_spectator": False}).to_list(100)
    votes = await db.votes.find({"task_id": task_id}).to_list(100)
    if not voters: return False
    return all(user["id"] in {v["user_id"] for v in votes} for user in voters)

# --- ROTAS HTTP ---
@fastapi_app.get("/api/health")
async def health(): return {"status": "online"}

@api_router.post("/rooms", response_model=Room)
async def create_room(input: RoomCreate):
    room = Room(name=input.name)
    await db.rooms.insert_one(room.model_dump())
    return room

@api_router.post("/rooms/{room_id}/join")
async def join_room_http(room_id: str, input: UserJoin):
    room_id = room_id.upper()
    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    if not room: raise HTTPException(404, "Room not found")
    is_admin = (await db.users.count_documents({"room_id": room_id})) == 0
    user = User(room_id=room_id, name=input.name, is_admin=is_admin, is_spectator=input.is_spectator)
    await db.users.insert_one(user.model_dump())
    return {"user": user.model_dump(), "room": room}

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
    await db.tasks.update_one({"id": action.task_id}, {"$set": {"status": TaskStatus.COMPLETED, "final_score": str(action.final_score)}})
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

# --- SOCKET EVENTS ---
@sio.event
async def connect(sid, environ): return True

@sio.event
async def join_room(sid, data):
    # FORCE UPPERCASE
    room_id = data.get("room_id").upper()
    user_id = data.get("user_id")
    logger.info(f"🔌 Socket Join: Room {room_id}")
    sio.enter_room(sid, room_id)

fastapi_app.include_router(api_router)
app = socket_app

# --- INICIALIZAÇÃO PARA RENDER/LOCAL ---
if __name__ == "__main__":
    import uvicorn
    # Pega a porta do ambiente (Render injeta a variável PORT) ou usa 5000 localmente
    port = int(os.environ.get("PORT", 5000))
    logger.info(f"🚀 Iniciando servidor na porta {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)