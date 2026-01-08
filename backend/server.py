from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import socketio
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Fibonacci sequence for voting
FIBONACCI_VALUES = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, "?"]

# Enums
class TaskStatus(str, Enum):
    PENDING = "PENDING"
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"

# Pydantic Models
class RoomCreate(BaseModel):
    name: str

class Room(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8].upper())
    name: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    cards_revealed: bool = False
    active_task_id: Optional[str] = None

class UserJoin(BaseModel):
    room_id: str
    name: str
    is_spectator: bool = False

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    room_id: str
    name: str
    is_admin: bool = False
    is_spectator: bool = False
    has_voted: bool = False

class TaskCreate(BaseModel):
    room_id: str
    title: str
    description: Optional[str] = ""

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

class RoomState(BaseModel):
    room: Optional[Dict[str, Any]] = None
    users: List[Dict[str, Any]] = []
    tasks: List[Dict[str, Any]] = []
    votes: List[Dict[str, Any]] = []
    active_task: Optional[Dict[str, Any]] = None

# Create Socket.IO server
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=True,
    engineio_logger=False
)

# Create FastAPI app
fastapi_app = FastAPI()
api_router = APIRouter(prefix="/api")

# Create ASGI app combining FastAPI and Socket.IO
socket_app = socketio.ASGIApp(sio, fastapi_app)

# In-memory mapping of socket IDs to user data
socket_users: Dict[str, Dict[str, str]] = {}

# Helper functions
async def get_room_state(room_id: str, include_votes: bool = False) -> Dict[str, Any]:
    """Get the full state of a room"""
    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    if not room:
        return {}
    
    users = await db.users.find({"room_id": room_id}, {"_id": 0}).to_list(100)
    tasks = await db.tasks.find({"room_id": room_id}, {"_id": 0}).to_list(100)
    
    # Get active task
    active_task = None
    if room.get("active_task_id"):
        active_task = await db.tasks.find_one({"id": room["active_task_id"]}, {"_id": 0})
    
    # Get votes for active task
    votes = []
    if active_task:
        raw_votes = await db.votes.find({"task_id": active_task["id"]}, {"_id": 0}).to_list(100)
        
        # Mask votes if not revealed
        if room.get("cards_revealed") or include_votes:
            votes = raw_votes
        else:
            # Only show who has voted, not the values
            votes = [{"user_id": v["user_id"], "has_voted": True} for v in raw_votes]
        
        # Update has_voted status for users
        voted_user_ids = {v["user_id"] for v in raw_votes}
        for user in users:
            user["has_voted"] = user["id"] in voted_user_ids
    
    return {
        "room": room,
        "users": users,
        "tasks": tasks,
        "votes": votes,
        "active_task": active_task
    }

async def check_all_voted(room_id: str, task_id: str) -> bool:
    """Check if all non-spectator users have voted"""
    voters = await db.users.find(
        {"room_id": room_id, "is_spectator": False},
        {"_id": 0}
    ).to_list(100)
    
    votes = await db.votes.find({"task_id": task_id}, {"_id": 0}).to_list(100)
    voted_user_ids = {v["user_id"] for v in votes}
    
    return all(user["id"] in voted_user_ids for user in voters)

async def broadcast_room_state(room_id: str):
    """Broadcast room state to all users in the room"""
    state = await get_room_state(room_id)
    await sio.emit('state_update', state, room=room_id)

# REST API Routes
@api_router.get("/")
async def root():
    return {"message": "PyPlanPoker API"}

@api_router.post("/rooms", response_model=Room)
async def create_room(input: RoomCreate):
    room = Room(name=input.name)
    doc = room.model_dump()
    await db.rooms.insert_one(doc)
    return room

@api_router.get("/rooms/{room_id}")
async def get_room(room_id: str):
    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return room

@api_router.post("/rooms/{room_id}/join")
async def join_room(room_id: str, input: UserJoin):
    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Check if this is the first user (admin)
    user_count = await db.users.count_documents({"room_id": room_id})
    is_admin = user_count == 0
    
    user = User(
        room_id=room_id,
        name=input.name,
        is_admin=is_admin,
        is_spectator=input.is_spectator
    )
    doc = user.model_dump()
    await db.users.insert_one(doc)
    
    return {
        "user": user.model_dump(),
        "room": room
    }

@api_router.post("/tasks", response_model=Task)
async def create_task(input: TaskCreate):
    room = await db.rooms.find_one({"id": input.room_id}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    task = Task(
        room_id=input.room_id,
        title=input.title,
        description=input.description or ""
    )
    doc = task.model_dump()
    await db.tasks.insert_one(doc)
    
    return task

@api_router.get("/rooms/{room_id}/tasks")
async def get_tasks(room_id: str):
    tasks = await db.tasks.find({"room_id": room_id}, {"_id": 0}).to_list(100)
    return tasks

@api_router.get("/rooms/{room_id}/state")
async def get_state(room_id: str):
    state = await get_room_state(room_id)
    if not state:
        raise HTTPException(status_code=404, detail="Room not found")
    return state

@api_router.get("/fibonacci")
async def get_fibonacci():
    return {"values": FIBONACCI_VALUES}

# Socket.IO Events
@sio.event
async def connect(sid, environ):
    logger.info(f"Client connected: {sid}")

@sio.event
async def disconnect(sid):
    logger.info(f"Client disconnected: {sid}")
    
    # Remove user from room
    if sid in socket_users:
        user_data = socket_users[sid]
        room_id = user_data.get("room_id")
        user_id = user_data.get("user_id")
        
        if user_id:
            await db.users.delete_one({"id": user_id})
            
        if room_id:
            sio.leave_room(sid, room_id)
            await broadcast_room_state(room_id)
            
            # Check if room is empty and clean up
            remaining = await db.users.count_documents({"room_id": room_id})
            if remaining == 0:
                await db.rooms.delete_one({"id": room_id})
                await db.tasks.delete_many({"room_id": room_id})
                await db.votes.delete_many({"task_id": {"$in": []}})
        
        del socket_users[sid]

@sio.event
async def join_room(sid, data):
    """User joins a room via socket"""
    room_id = data.get("room_id")
    user_id = data.get("user_id")
    
    logger.info(f"User {user_id} joining room {room_id}")
    
    # Store mapping
    socket_users[sid] = {"room_id": room_id, "user_id": user_id}
    
    # Join socket room
    sio.enter_room(sid, room_id)
    
    # Broadcast updated state
    await broadcast_room_state(room_id)

@sio.event
async def cast_vote(sid, data):
    """User casts a vote"""
    user_id = data.get("user_id")
    task_id = data.get("task_id")
    value = data.get("value")
    
    logger.info(f"User {user_id} voting {value} on task {task_id}")
    
    # Check if user exists and is not spectator
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user or user.get("is_spectator"):
        return
    
    # Check if task exists and get room
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        return
    
    room_id = task["room_id"]
    
    # Check if cards are already revealed
    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    if room and room.get("cards_revealed"):
        return
    
    # Remove existing vote and add new one
    await db.votes.delete_one({"task_id": task_id, "user_id": user_id})
    
    vote = Vote(task_id=task_id, user_id=user_id, value=str(value))
    await db.votes.insert_one(vote.model_dump())
    
    # Check if all users have voted
    all_voted = await check_all_voted(room_id, task_id)
    
    if all_voted:
        # Auto-reveal cards
        await db.rooms.update_one({"id": room_id}, {"$set": {"cards_revealed": True}})
        state = await get_room_state(room_id, include_votes=True)
        await sio.emit('reveal_votes', state, room=room_id)
    else:
        await broadcast_room_state(room_id)

@sio.event
async def set_active_task(sid, data):
    """Admin sets the active task"""
    room_id = data.get("room_id")
    task_id = data.get("task_id")
    user_id = data.get("user_id")
    
    logger.info(f"Setting active task {task_id} in room {room_id}")
    
    # Check if user is admin
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user or not user.get("is_admin"):
        return
    
    # Update all tasks status
    await db.tasks.update_many(
        {"room_id": room_id, "status": TaskStatus.ACTIVE},
        {"$set": {"status": TaskStatus.PENDING}}
    )
    
    # Set new active task
    await db.tasks.update_one(
        {"id": task_id},
        {"$set": {"status": TaskStatus.ACTIVE}}
    )
    
    # Update room
    await db.rooms.update_one(
        {"id": room_id},
        {"$set": {"active_task_id": task_id, "cards_revealed": False}}
    )
    
    # Clear votes for this task
    await db.votes.delete_many({"task_id": task_id})
    
    await broadcast_room_state(room_id)

@sio.event
async def reveal_cards(sid, data):
    """Admin reveals all cards"""
    room_id = data.get("room_id")
    user_id = data.get("user_id")
    
    logger.info(f"Revealing cards in room {room_id}")
    
    # Check if user is admin
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user or not user.get("is_admin"):
        return
    
    # Update room
    await db.rooms.update_one(
        {"id": room_id},
        {"$set": {"cards_revealed": True}}
    )
    
    # Send reveal event with actual votes
    state = await get_room_state(room_id, include_votes=True)
    await sio.emit('reveal_votes', state, room=room_id)

@sio.event
async def reset_votes(sid, data):
    """Admin resets votes for current task"""
    room_id = data.get("room_id")
    user_id = data.get("user_id")
    task_id = data.get("task_id")
    
    logger.info(f"Resetting votes in room {room_id} for task {task_id}")
    
    # Check if user is admin
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user or not user.get("is_admin"):
        return
    
    # Clear votes for the task
    if task_id:
        await db.votes.delete_many({"task_id": task_id})
    
    # Reset cards_revealed
    await db.rooms.update_one(
        {"id": room_id},
        {"$set": {"cards_revealed": False}}
    )
    
    await broadcast_room_state(room_id)

@sio.event
async def complete_task(sid, data):
    """Admin completes a task with final score"""
    room_id = data.get("room_id")
    user_id = data.get("user_id")
    task_id = data.get("task_id")
    final_score = data.get("final_score")
    
    logger.info(f"Completing task {task_id} with score {final_score}")
    
    # Check if user is admin
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user or not user.get("is_admin"):
        return
    
    # Update task
    await db.tasks.update_one(
        {"id": task_id},
        {"$set": {"status": TaskStatus.COMPLETED, "final_score": str(final_score)}}
    )
    
    # Clear active task
    await db.rooms.update_one(
        {"id": room_id},
        {"$set": {"active_task_id": None, "cards_revealed": False}}
    )
    
    await broadcast_room_state(room_id)

@sio.event
async def add_task(sid, data):
    """Add a new task to the room"""
    room_id = data.get("room_id")
    title = data.get("title")
    description = data.get("description", "")
    
    logger.info(f"Adding task '{title}' to room {room_id}")
    
    task = Task(
        room_id=room_id,
        title=title,
        description=description
    )
    await db.tasks.insert_one(task.model_dump())
    
    await broadcast_room_state(room_id)

@sio.event
async def delete_task(sid, data):
    """Admin deletes a task"""
    room_id = data.get("room_id")
    user_id = data.get("user_id")
    task_id = data.get("task_id")
    
    # Check if user is admin
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user or not user.get("is_admin"):
        return
    
    # Check if this is the active task
    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    if room and room.get("active_task_id") == task_id:
        await db.rooms.update_one(
            {"id": room_id},
            {"$set": {"active_task_id": None, "cards_revealed": False}}
        )
    
    # Delete task and its votes
    await db.tasks.delete_one({"id": task_id})
    await db.votes.delete_many({"task_id": task_id})
    
    await broadcast_room_state(room_id)

# Include the router
app.include_router(api_router)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# Export socket_app as app for uvicorn
app = socket_app
