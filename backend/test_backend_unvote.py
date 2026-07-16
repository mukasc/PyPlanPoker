import sys
import os
import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi import HTTPException

# Add backend dir to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))


from app.main import fastapi_app
from app.db.database import db_instance
from app.services import socket
from app.api.routers import auth, rooms, users, tasks, actions, admin
from app.models import domain


@pytest.mark.asyncio
async def test_unvote_success():
    """Verify that unvote route successfully deletes vote and broadcasts state."""
    mock_db = MagicMock()
    mock_users = MagicMock()
    mock_users.find_one = AsyncMock(return_value={"id": "user-1", "is_spectator": False})
    mock_db.users = mock_users
    
    mock_votes = MagicMock()
    mock_votes.delete_one = AsyncMock()
    mock_db.votes = mock_votes
    
    db_instance.db = mock_db
    mock_broadcast = AsyncMock()
    socket.broadcast_room_state = actions.broadcast_room_state = rooms.broadcast_room_state = admin.broadcast_room_state = users.broadcast_room_state = mock_broadcast
    
    action = domain.ActionUnvote(
        room_id="ROOM_XYZ",
        user_id="user-1",
        task_id="task-1"
    )
    
    response = await actions.retract_vote_http(action, current_user_id="user-1")
    assert response == {"status": "success"}
    mock_votes.delete_one.assert_called_once_with({"task_id": "task-1", "user_id": "user-1"})
    mock_broadcast.assert_called_once_with("ROOM_XYZ")

@pytest.mark.asyncio
async def test_unvote_user_mismatch():
    """Verify that unvote route raises 403 on user ID mismatch."""
    action = domain.ActionUnvote(
        room_id="ROOM_XYZ",
        user_id="user-1",
        task_id="task-1"
    )
    
    with pytest.raises(HTTPException) as exc_info:
        await actions.retract_vote_http(action, current_user_id="user-2")
    assert exc_info.value.status_code == 403

@pytest.mark.asyncio
async def test_get_room_state_exposes_own_vote():
    """Verify that get_room_state exposes own vote value but masks others when cards are hidden."""
    mock_db = MagicMock()
    
    # Mock room with hidden cards
    mock_rooms = MagicMock()
    mock_rooms.find_one = AsyncMock(return_value={"id": "ROOM_XYZ", "cards_revealed": False, "active_task_id": "task-1"})
    mock_db.rooms = mock_rooms
    
    # Mock users
    users = [
        {"id": "user-1", "name": "User 1", "is_spectator": False},
        {"id": "user-2", "name": "User 2", "is_spectator": False}
    ]
    mock_users = MagicMock()
    mock_users.find.return_value.to_list = AsyncMock(return_value=users)
    mock_db.users = mock_users
    
    # Mock active task
    mock_db.tasks.find_one = AsyncMock(return_value={"id": "task-1"})
    mock_db.tasks.find.return_value.sort.return_value.to_list = AsyncMock(return_value=[])
    
    # Mock votes in DB
    votes = [
        {"user_id": "user-1", "value": "5", "task_id": "task-1"},
        {"user_id": "user-2", "value": "8", "task_id": "task-1"}
    ]
    mock_votes = MagicMock()
    mock_votes.find.return_value.to_list = AsyncMock(return_value=votes)
    mock_db.votes = mock_votes
    
    db_instance.db = mock_db
    
    # Call get_room_state for user-1
    state = await socket.get_room_state("ROOM_XYZ", requesting_user_id="user-1")
    
    # Assertions
    returned_votes = state["votes"]
    assert len(returned_votes) == 2
    
    # Find vote for user-1: should have value "5"
    vote_1 = next(v for v in returned_votes if v["user_id"] == "user-1")
    assert vote_1.get("value") == "5"
    assert vote_1.get("has_voted") is True
    
    # Find vote for user-2: should not have value
    vote_2 = next(v for v in returned_votes if v["user_id"] == "user-2")
    assert "value" not in vote_2
    assert vote_2.get("has_voted") is True
