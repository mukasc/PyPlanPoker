import sys
import os
import pytest
from unittest.mock import AsyncMock, MagicMock

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import server

@pytest.mark.asyncio
async def test_get_admin_users():
    mock_db = MagicMock()
    
    # Mock users aggregation cursor
    mock_cursor = AsyncMock()
    mock_cursor.to_list.return_value = [
        {"_id": "guest-1", "name": "Guest 1", "picture": None, "rooms": ["ROOM_1"], "is_online": True},
        {"_id": "google-1", "name": "Google 1", "picture": None, "rooms": ["ROOM_1", "ROOM_2"], "is_online": False}
    ]
    mock_db.users.aggregate.return_value = mock_cursor
    
    # Mock global_users
    mock_global_cursor = AsyncMock()
    mock_global_cursor.to_list.return_value = [
        {"id": "google-1", "name": "Google 1", "email": "g1@test.com", "picture": None}
    ]
    mock_db.global_users.find.return_value = mock_global_cursor
    
    # Mock document counts
    mock_db.rooms.count_documents = AsyncMock(side_effect=lambda q: 1 if q.get("owner_id") == "google-1" else 0)
    mock_db.votes.count_documents = AsyncMock(side_effect=lambda q: 3 if q.get("user_id") == "guest-1" else 1)
    
    server.db = mock_db
    
    res = await server.get_admin_users()
    
    assert len(res) == 2
    
    # Google user should be first because of sorting key
    assert res[0]["id"] == "google-1"
    assert res[0]["type"] == "Google"
    assert res[0]["email"] == "g1@test.com"
    assert res[0]["rooms_owned"] == 1
    assert res[0]["votes_cast"] == 1
    assert res[0]["rooms_participated"] == 2
    
    assert res[1]["id"] == "guest-1"
    assert res[1]["type"] == "Guest"
    assert res[1]["rooms_owned"] == 0
    assert res[1]["votes_cast"] == 3
    assert res[1]["rooms_participated"] == 1

@pytest.mark.asyncio
async def test_check_user_relations():
    mock_db = MagicMock()
    mock_db.rooms.count_documents = AsyncMock(return_value=2)
    mock_db.votes.count_documents = AsyncMock(return_value=5)
    mock_db.users.count_documents = AsyncMock(return_value=3)
    
    server.db = mock_db
    
    res = await server.check_user_relations("test-user-id")
    
    assert res["owned_rooms"] == 2
    assert res["votes"] == 5
    assert res["memberships"] == 3
    assert res["has_relations"] is True

@pytest.mark.asyncio
async def test_delete_user_cascade():
    mock_db = MagicMock()
    
    # User owns one room
    mock_rooms_cursor = AsyncMock()
    mock_rooms_cursor.to_list.return_value = [{"id": "ROOM_123"}]
    mock_db.rooms.find.return_value = mock_rooms_cursor
    
    # Check returns relations
    mock_db.votes.count_documents = AsyncMock(return_value=2)
    
    # Memberships
    mock_memberships_cursor = AsyncMock()
    mock_memberships_cursor.to_list.return_value = [{"room_id": "ROOM_123"}, {"room_id": "ROOM_OTHER"}]
    mock_db.users.find.return_value = mock_memberships_cursor
    
    # Tasks in owned room
    mock_tasks_cursor = AsyncMock()
    mock_tasks_cursor.to_list.return_value = [{"id": "TASK_1"}]
    mock_db.tasks.find.return_value = mock_tasks_cursor
    
    # Async Mocks for delete
    mock_db.votes.delete_many = AsyncMock()
    mock_db.tasks.delete_many = AsyncMock()
    mock_db.users.delete_many = AsyncMock()
    mock_db.rooms.delete_one = AsyncMock()
    mock_db.global_users.delete_one = AsyncMock()
    
    server.db = mock_db
    server.sio.emit = AsyncMock()
    server.broadcast_room_state = AsyncMock()
    
    # Call delete
    res = await server.delete_user("user-1", confirm=True)
    
    assert res["status"] == "success"
    
    # Deletes votes for tasks in owned rooms
    mock_db.votes.delete_many.assert_any_call({"task_id": {"$in": ["TASK_1"]}})
    
    # Deletes tasks, users, and room
    mock_db.tasks.delete_many.assert_any_call({"room_id": "ROOM_123"})
    mock_db.users.delete_many.assert_any_call({"room_id": "ROOM_123"})
    mock_db.rooms.delete_one.assert_called_with({"id": "ROOM_123"})
    
    # Deletes user direct votes and memberships
    mock_db.votes.delete_many.assert_any_call({"user_id": "user-1"})
    mock_db.users.delete_many.assert_any_call({"id": "user-1"})
    mock_db.global_users.delete_one.assert_called_with({"id": "user-1"})
    
    # Emitted socket event for room deleted
    server.sio.emit.assert_any_call('room_deleted', {"room_id": "ROOM_123"}, room="ROOM_123")
    
    # Broadcast to other affected rooms
    server.broadcast_room_state.assert_called_with("ROOM_OTHER")

@pytest.mark.asyncio
async def test_merge_users():
    mock_db = MagicMock()
    
    mock_db.rooms.update_many = AsyncMock()
    mock_db.votes.find = MagicMock()
    mock_votes_cursor = AsyncMock()
    mock_votes_cursor.to_list.return_value = [
        {"_id": "v1", "task_id": "TASK_1", "user_id": "guest-1", "value": "5"},
        {"_id": "v2", "task_id": "TASK_2", "user_id": "guest-1", "value": "8"}
    ]
    mock_db.votes.find.return_value = mock_votes_cursor
    
    # mock find_one for vote collision check
    mock_db.votes.find_one = AsyncMock(side_effect=lambda q: {"_id": "target-v1"} if q.get("task_id") == "TASK_1" else None)
    
    mock_db.votes.delete_one = AsyncMock()
    mock_db.votes.update_one = AsyncMock()
    
    # User memberships
    mock_db.users.find = MagicMock()
    mock_users_cursor = AsyncMock()
    mock_users_cursor.to_list.return_value = [
        {"room_id": "ROOM_A"},
        {"room_id": "ROOM_B"}
    ]
    mock_db.users.find.return_value = mock_users_cursor
    
    # mock find_one for membership collision check
    mock_db.users.find_one = AsyncMock(side_effect=lambda q: {"id": "google-1"} if q.get("room_id") == "ROOM_A" else None)
    
    mock_db.users.delete_one = AsyncMock()
    mock_db.users.update_one = AsyncMock()
    mock_db.global_users.delete_one = AsyncMock()
    
    server.db = mock_db
    server.broadcast_room_state = AsyncMock()
    
    data = {
        "target_id": "google-1",
        "source_ids": ["guest-1"]
    }
    
    res = await server.merge_users(data)
    
    assert res["status"] == "success"
    assert res["merged_count"] == 1
    
    # Transferred rooms owned
    mock_db.rooms.update_many.assert_called_with({"owner_id": "guest-1"}, {"$set": {"owner_id": "google-1"}})
    
    # Vote collision handling: deleted v1, updated v2
    mock_db.votes.delete_one.assert_called_with({"_id": "v1"})
    mock_db.votes.update_one.assert_called_with({"_id": "v2"}, {"$set": {"user_id": "google-1"}})
    
    # Membership collision handling: deleted guest-1 in ROOM_A, updated guest-1 in ROOM_B
    mock_db.users.delete_one.assert_called_with({"id": "guest-1", "room_id": "ROOM_A"})
    mock_db.users.update_one.assert_called_with(
        {"id": "guest-1", "room_id": "ROOM_B"},
        {"$set": {"id": "google-1"}}
    )
    
    # Deleted from global_users
    mock_db.global_users.delete_one.assert_called_with({"id": "guest-1"})
    
    # Broadcast to affected rooms
    server.broadcast_room_state.assert_any_call("ROOM_A")
    server.broadcast_room_state.assert_any_call("ROOM_B")
