import logging
from fastapi import APIRouter, HTTPException, Depends, Request

from app.models.domain import Task, TaskCreate
from app.core.security import get_current_user, limiter
from app.db.database import get_db
from app.services.socket import broadcast_room_state

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/tasks", tags=["Tasks"])

@router.post("", response_model=Task)
async def create_task(input: TaskCreate, current_user_id: str = Depends(get_current_user)):
    input.room_id = input.room_id.upper()
    db = get_db()
    if db is None: raise HTTPException(500, "DB Error")
    
    user = await db.users.find_one({"id": current_user_id, "room_id": input.room_id})
    if not user or not user.get("is_admin"):
        raise HTTPException(403, "Only admins can add tasks")

    last_task = await db.tasks.find_one({"room_id": input.room_id}, sort=[("position", -1)])
    next_position = (last_task.get("position", 0) + 1) if last_task else 0
    
    task = Task(room_id=input.room_id, title=input.title, description=input.description or "", position=next_position)
    await db.tasks.insert_one(task.model_dump())
    await broadcast_room_state(input.room_id)
    return task

@router.get("/rooms/{room_id}/tasks")
@limiter.limit("60/minute")
async def get_tasks(request: Request, room_id: str, current_user_id: str = Depends(get_current_user)):
    room_id = room_id.upper()
    db = get_db()
    if db is None: return []
    
    user = await db.users.find_one({"id": current_user_id, "room_id": room_id})
    if not user:
        raise HTTPException(status_code=403, detail="You are not a member of this room")
        
    return await db.tasks.find({"room_id": room_id}, {"_id": 0}).sort("position", 1).to_list(100)
