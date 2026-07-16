import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends

from app.models.domain import (
    ActionActiveTask, ActionVote, ActionUnvote, ActionReveal, ActionReset, 
    ActionComplete, ActionDelete, ActionKick, ActionTimer, ActionReorder,
    TaskStatus, Vote, ActionBase
)
from app.core.security import get_current_user
from app.db.database import get_db
from app.services.socket import broadcast_room_state, check_all_voted, get_room_state, sio

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Actions"])

@router.post("/active-task")
async def set_active_task_http(action: ActionActiveTask, current_user_id: str = Depends(get_current_user)):
    db = get_db()
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

@router.post("/vote")
async def cast_vote_http(action: ActionVote, current_user_id: str = Depends(get_current_user)):
    if action.user_id != current_user_id:
        raise HTTPException(403, "User ID mismatch")
    db = get_db()
    user = await db.users.find_one({"id": action.user_id, "room_id": action.room_id})
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

@router.post("/unvote")
async def retract_vote_http(action: ActionUnvote, current_user_id: str = Depends(get_current_user)):
    if action.user_id != current_user_id:
        raise HTTPException(403, "User ID mismatch")
    db = get_db()
    user = await db.users.find_one({"id": action.user_id, "room_id": action.room_id})
    if not user or user.get("is_spectator"): raise HTTPException(403, "Cannot vote")
    
    await db.votes.delete_one({"task_id": action.task_id, "user_id": action.user_id})
    await broadcast_room_state(action.room_id)
    return {"status": "success"}

@router.post("/reveal")
async def reveal_cards_http(action: ActionReveal, current_user_id: str = Depends(get_current_user)):
    db = get_db()
    user = await db.users.find_one({"id": current_user_id, "room_id": action.room_id})
    if not user or not user.get("is_admin"): raise HTTPException(403, "Admin only")
    await db.rooms.update_one({"id": action.room_id}, {"$set": {"cards_revealed": True}})
    state = await get_room_state(action.room_id, include_votes=True)
    await sio.emit('reveal_votes', state, room=action.room_id)
    return {"status": "success"}

@router.post("/reset")
async def reset_votes_http(action: ActionReset, current_user_id: str = Depends(get_current_user)):
    db = get_db()
    user = await db.users.find_one({"id": current_user_id, "room_id": action.room_id})
    if not user or not user.get("is_admin"): raise HTTPException(403, "Admin only")
    if action.task_id: await db.votes.delete_many({"task_id": action.task_id})
    await db.rooms.update_one({"id": action.room_id}, {"$set": {"cards_revealed": False}})
    await broadcast_room_state(action.room_id)
    return {"status": "success"}

@router.post("/complete")
async def complete_task_http(action: ActionComplete, current_user_id: str = Depends(get_current_user)):
    db = get_db()
    user = await db.users.find_one({"id": current_user_id, "room_id": action.room_id})
    if not user or not user.get("is_admin"): raise HTTPException(403, "Admin only")
    
    votes = await db.votes.find({"task_id": action.task_id}).to_list(100)
    votes_summary = []
    for v in votes:
        v_user = await db.users.find_one({"id": v["user_id"], "room_id": action.room_id})
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

@router.post("/delete-task")
async def delete_task_http(action: ActionDelete, current_user_id: str = Depends(get_current_user)):
    db = get_db()
    user = await db.users.find_one({"id": current_user_id, "room_id": action.room_id})
    if not user or not user.get("is_admin"): raise HTTPException(403, "Admin only")
    room = await db.rooms.find_one({"id": action.room_id})
    if room and room.get("active_task_id") == action.task_id:
        await db.rooms.update_one({"id": action.room_id}, {"$set": {"active_task_id": None, "cards_revealed": False}})
    await db.tasks.delete_one({"id": action.task_id})
    await db.votes.delete_many({"task_id": action.task_id})
    await broadcast_room_state(action.room_id)
    return {"status": "success"}

@router.post("/cancel-task")
async def cancel_task_http(action: ActionDelete, current_user_id: str = Depends(get_current_user)): 
    db = get_db()
    user = await db.users.find_one({"id": current_user_id, "room_id": action.room_id})
    if not user or not user.get("is_admin"): raise HTTPException(403, "Admin only")
    
    room = await db.rooms.find_one({"id": action.room_id})
    if room and room.get("active_task_id") == action.task_id:
        await db.rooms.update_one({"id": action.room_id}, {"$set": {"active_task_id": None, "cards_revealed": False}})
    
    await db.tasks.update_one({"id": action.task_id}, {"$set": {"status": TaskStatus.CANCELLED}})
    await broadcast_room_state(action.room_id)
    return {"status": "success"}

@router.post("/kick")
async def kick_user_http(action: ActionKick, current_user_id: str = Depends(get_current_user)):
    db = get_db()
    user = await db.users.find_one({"id": current_user_id, "room_id": action.room_id})
    if not user or not user.get("is_admin"): raise HTTPException(403, "Admin only")
    
    await db.users.delete_one({"id": action.target_user_id, "room_id": action.room_id})
    await db.votes.delete_many({"user_id": action.target_user_id, "room_id": action.room_id})
    await sio.emit('kicked', {"target_user_id": action.target_user_id}, room=action.room_id)
    await broadcast_room_state(action.room_id)
    return {"status": "success"}

@router.post("/start-timer")
async def start_timer_http(action: ActionTimer, current_user_id: str = Depends(get_current_user)):
    db = get_db()
    user = await db.users.find_one({"id": current_user_id, "room_id": action.room_id})
    if not user or not user.get("is_admin"): raise HTTPException(403, "Admin only")
    
    timer_end = (datetime.now(timezone.utc).timestamp() + action.duration_seconds)
    timer_end_iso = datetime.fromtimestamp(timer_end, tz=timezone.utc).isoformat()
    
    await db.rooms.update_one({"id": action.room_id}, {"$set": {"timer_end": timer_end_iso}})
    await broadcast_room_state(action.room_id)
    return {"status": "success", "timer_end": timer_end_iso}

@router.post("/stop-timer")
async def stop_timer_http(action: ActionBase, current_user_id: str = Depends(get_current_user)):
    db = get_db()
    user = await db.users.find_one({"id": current_user_id, "room_id": action.room_id})
    if not user or not user.get("is_admin"): raise HTTPException(403, "Admin only")
    
    await db.rooms.update_one({"id": action.room_id}, {"$set": {"timer_end": None}})
    await broadcast_room_state(action.room_id)
    return {"status": "success"}

@router.post("/reorder-tasks")
async def reorder_tasks_http(action: ActionReorder, current_user_id: str = Depends(get_current_user)):
    db = get_db()
    user = await db.users.find_one({"id": current_user_id, "room_id": action.room_id})
    if not user or not user.get("is_admin"): raise HTTPException(403, "Admin only")
    
    for index, task_id in enumerate(action.task_ids):
        await db.tasks.update_one(
            {"id": task_id, "room_id": action.room_id},
            {"$set": {"position": index}}
        )
    
    await broadcast_room_state(action.room_id)
    return {"status": "success"}
