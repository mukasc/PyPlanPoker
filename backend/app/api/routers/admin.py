import logging
from typing import Dict, Any
from fastapi import APIRouter, HTTPException

from app.models.domain import BatchDeleteRequest, BatchDeleteRoomsRequest
from app.db.database import get_db
from app.services.socket import sio, broadcast_room_state

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["Admin"])

@router.get("/users")
async def get_admin_users():
    db = get_db()
    if db is None: return []
    
    pipeline = [
        {"$group": {
            "_id": "$id",
            "name": {"$first": "$name"},
            "picture": {"$first": "$picture"},
            "rooms": {"$addToSet": "$room_id"},
            "is_online": {"$max": "$is_online"}
        }}
    ]
    users_cursor = db.users.aggregate(pipeline)
    room_users = await users_cursor.to_list(None)
    
    all_users = {}
    
    google_users = await db.global_users.find().to_list(None)
    for u in google_users:
        uid = u["id"]
        all_users[uid] = {
            "id": uid,
            "name": u.get("name", "Unknown"),
            "email": u.get("email", ""),
            "picture": u.get("picture"),
            "type": "Google",
            "rooms_participated": 0,
            "is_online": False
        }
        
    for ru in room_users:
        uid = ru["_id"]
        if uid in all_users:
            all_users[uid]["rooms_participated"] = len(ru.get("rooms", []))
            all_users[uid]["is_online"] = bool(ru.get("is_online", False))
            if ru.get("name") and all_users[uid]["name"] == "Unknown":
                all_users[uid]["name"] = ru["name"]
            if ru.get("picture") and not all_users[uid]["picture"]:
                all_users[uid]["picture"] = ru["picture"]
        else:
            all_users[uid] = {
                "id": uid,
                "name": ru.get("name", "Guest"),
                "email": "",
                "picture": ru.get("picture"),
                "type": "Guest",
                "rooms_participated": len(ru.get("rooms", [])),
                "is_online": bool(ru.get("is_online", False))
            }
            
    result = []
    for uid, user_data in all_users.items():
        user_data["rooms_owned"] = await db.rooms.count_documents({"owner_id": uid})
        user_data["votes_cast"] = await db.votes.count_documents({"user_id": uid})
        result.append(user_data)
        
    result.sort(key=lambda x: (x["type"] != "Google", x["name"].lower()))
    return result

@router.get("/users/{user_id}/check")
async def check_user_relations(user_id: str):
    db = get_db()
    if db is None:
        return {"owned_rooms": 0, "votes": 0, "memberships": 0, "has_relations": False}
        
    owned_rooms_count = await db.rooms.count_documents({"owner_id": user_id})
    votes_count = await db.votes.count_documents({"user_id": user_id})
    memberships_count = await db.users.count_documents({"id": user_id})
    
    return {
        "owned_rooms": owned_rooms_count,
        "votes": votes_count,
        "memberships": memberships_count,
        "has_relations": (owned_rooms_count > 0 or votes_count > 0 or memberships_count > 0)
    }

@router.delete("/users/{user_id}")
async def delete_user(user_id: str, confirm: bool = False):
    db = get_db()
    if db is None: raise HTTPException(500, "Database connection not available")
        
    owned_rooms = await db.rooms.find({"owner_id": user_id}).to_list(None)
    votes_count = await db.votes.count_documents({"user_id": user_id})
    memberships = await db.users.find({"id": user_id}).to_list(None)
    
    has_relations = (len(owned_rooms) > 0 or votes_count > 0 or len(memberships) > 0)
    
    if has_relations and not confirm:
        raise HTTPException(
            status_code=400, 
            detail="User has active rooms, votes, or room memberships. Confirmation required."
        )
        
    affected_rooms = set()
    for mem in memberships: affected_rooms.add(mem["room_id"])
        
    room_ids_to_delete = [r["id"] for r in owned_rooms]
    for r_id in room_ids_to_delete:
        tasks = await db.tasks.find({"room_id": r_id}).to_list(None)
        task_ids = [t["id"] for t in tasks]
        if task_ids:
            await db.votes.delete_many({"task_id": {"$in": task_ids}})
        await db.tasks.delete_many({"room_id": r_id})
        await db.users.delete_many({"room_id": r_id})
        await db.rooms.delete_one({"id": r_id})
        await sio.emit('room_deleted', {"room_id": r_id}, room=r_id)
        
    await db.votes.delete_many({"user_id": user_id})
    await db.users.delete_many({"id": user_id})
    await db.global_users.delete_one({"id": user_id})
    
    for r_id in affected_rooms:
        if r_id not in room_ids_to_delete:
            await broadcast_room_state(r_id)
            
    return {"status": "success"}

@router.post("/users/merge")
async def merge_users(data: Dict[str, Any]):
    db = get_db()
    if db is None: raise HTTPException(500, "Database connection not available")
        
    target_id = data.get("target_id")
    source_ids = data.get("source_ids", [])
    
    if not target_id or not source_ids:
        raise HTTPException(400, "target_id and source_ids are required")
        
    for src_id in source_ids:
        if src_id == target_id: continue
            
        await db.rooms.update_many({"owner_id": src_id}, {"$set": {"owner_id": target_id}})
        
        src_votes = await db.votes.find({"user_id": src_id}).to_list(None)
        for vote in src_votes:
            exists = await db.votes.find_one({"task_id": vote["task_id"], "user_id": target_id})
            if exists:
                await db.votes.delete_one({"_id": vote["_id"]})
            else:
                await db.votes.update_one({"_id": vote["_id"]}, {"$set": {"user_id": target_id}})
                
        src_memberships = await db.users.find({"id": src_id}).to_list(None)
        affected_rooms = set()
        for mem in src_memberships:
            room_id = mem["room_id"]
            affected_rooms.add(room_id)
            
            exists = await db.users.find_one({"id": target_id, "room_id": room_id})
            if exists:
                await db.users.delete_one({"id": src_id, "room_id": room_id})
            else:
                await db.users.update_one(
                    {"id": src_id, "room_id": room_id},
                    {"$set": {"id": target_id}}
                )
                
        await db.global_users.delete_one({"id": src_id})
        
        for r_id in affected_rooms:
            await broadcast_room_state(r_id)
            
    return {"status": "success", "merged_count": len(source_ids)}

@router.get("/rooms")
async def get_admin_rooms():
    db = get_db()
    if db is None: return []
    
    rooms = await db.rooms.find().sort("created_at", -1).to_list(None)
    result = []
    for r in rooms:
        r_id = r["id"]
        tasks_count = await db.tasks.count_documents({"room_id": r_id})
        users_count = await db.users.count_documents({"room_id": r_id, "is_online": True})
        total_users = await db.users.count_documents({"room_id": r_id})
        
        result.append({
            "id": r_id,
            "name": r.get("name"),
            "owner_id": r.get("owner_id"),
            "created_at": r.get("created_at"),
            "deck_type": r.get("deck_type"),
            "tasks_count": tasks_count,
            "active_users_count": users_count,
            "total_users_count": total_users
        })
    return result

@router.delete("/rooms/{room_id}")
async def delete_room_admin(room_id: str):
    db = get_db()
    if db is None: raise HTTPException(500, "Database connection not available")
        
    room_id = room_id.upper()
    
    tasks = await db.tasks.find({"room_id": room_id}).to_list(None)
    task_ids = [t["id"] for t in tasks]
    if task_ids:
        await db.votes.delete_many({"task_id": {"$in": task_ids}})
    await db.tasks.delete_many({"room_id": room_id})
    await db.users.delete_many({"room_id": room_id})
    await db.rooms.delete_one({"id": room_id})
    
    await sio.emit('room_deleted', {"room_id": room_id}, room=room_id)
    return {"status": "success"}

@router.post("/users/batch-delete")
async def batch_delete_users(data: BatchDeleteRequest):
    db = get_db()
    if db is None: raise HTTPException(500, "Database connection not available")
        
    user_ids = data.ids
    confirm = data.confirm
    
    if not user_ids: return {"status": "success", "deleted_count": 0}
        
    owned_rooms_count = await db.rooms.count_documents({"owner_id": {"$in": user_ids}})
    votes_count = await db.votes.count_documents({"user_id": {"$in": user_ids}})
    memberships_count = await db.users.count_documents({"id": {"$in": user_ids}})
    
    has_relations = (owned_rooms_count > 0 or votes_count > 0 or memberships_count > 0)
    if has_relations and not confirm:
        raise HTTPException(
            status_code=400, 
            detail="One or more selected users have active rooms, votes, or room memberships. Confirmation required."
        )
        
    user_memberships = await db.users.find({"id": {"$in": user_ids}}).to_list(None)
    affected_rooms = {m["room_id"] for m in user_memberships}
    
    owned_rooms = await db.rooms.find({"owner_id": {"$in": user_ids}}).to_list(None)
    room_ids_to_delete = [r["id"] for r in owned_rooms]
    
    if room_ids_to_delete:
        tasks = await db.tasks.find({"room_id": {"$in": room_ids_to_delete}}).to_list(None)
        task_ids = [t["id"] for t in tasks]
        if task_ids:
            await db.votes.delete_many({"task_id": {"$in": task_ids}})
        await db.tasks.delete_many({"room_id": {"$in": room_ids_to_delete}})
        await db.users.delete_many({"room_id": {"$in": room_ids_to_delete}})
        await db.rooms.delete_many({"id": {"$in": room_ids_to_delete}})
        
        for r_id in room_ids_to_delete:
            await sio.emit('room_deleted', {"room_id": r_id}, room=r_id)
            
    await db.votes.delete_many({"user_id": {"$in": user_ids}})
    await db.users.delete_many({"id": {"$in": user_ids}})
    await db.global_users.delete_many({"id": {"$in": user_ids}})
    
    for r_id in affected_rooms:
        if r_id not in room_ids_to_delete:
            await broadcast_room_state(r_id)
            
    return {"status": "success", "deleted_count": len(user_ids)}

@router.post("/rooms/batch-delete")
async def batch_delete_rooms(data: BatchDeleteRoomsRequest):
    db = get_db()
    if db is None: raise HTTPException(500, "Database connection not available")
        
    room_ids = [r.upper() for r in data.ids]
    if not room_ids: return {"status": "success", "deleted_count": 0}
        
    tasks = await db.tasks.find({"room_id": {"$in": room_ids}}).to_list(None)
    task_ids = [t["id"] for t in tasks]
    if task_ids:
        await db.votes.delete_many({"task_id": {"$in": task_ids}})
        
    await db.tasks.delete_many({"room_id": {"$in": room_ids}})
    await db.users.delete_many({"room_id": {"$in": room_ids}})
    await db.rooms.delete_many({"id": {"$in": room_ids}})
    
    for r_id in room_ids:
        await sio.emit('room_deleted', {"room_id": r_id}, room=r_id)
        
    return {"status": "success", "deleted_count": len(room_ids)}
