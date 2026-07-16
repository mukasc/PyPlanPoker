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
async def test_get_recent_rooms_auth():
    """Verify that get_recent_rooms raises 403 if current_user_id doesn't match user_id."""
    with pytest.raises(HTTPException) as exc_info:
        await users.get_recent_rooms("user-1", current_user_id="user-2")
    assert exc_info.value.status_code == 403

@pytest.mark.asyncio
async def test_get_recent_rooms_db_not_connected():
    """Verify that get_recent_rooms returns empty list if db is not connected."""
    db_instance.db = None
    rooms = await users.get_recent_rooms("user-1", current_user_id="user-1")
    assert rooms == []

@pytest.mark.asyncio
async def test_get_recent_rooms_no_memberships():
    """Verify that get_recent_rooms returns empty list if user has no room memberships."""
    mock_db = MagicMock()
    mock_users = MagicMock()
    # No memberships
    mock_users.find.return_value.to_list = AsyncMock(return_value=[])
    mock_db.users = mock_users
    db_instance.db = mock_db
    
    rooms = await users.get_recent_rooms("user-1", current_user_id="user-1")
    assert rooms == []

@pytest.mark.asyncio
async def test_get_recent_rooms_success():
    """Verify that get_recent_rooms fetches correct rooms, excluding owned ones, sorted by joined_at."""
    mock_db = MagicMock()
    
    # Mock memberships (joined room A then room B)
    memberships = [
        {"id": "user-1", "room_id": "ROOM_A", "joined_at": "2026-07-15T01:00:00Z"},
        {"id": "user-1", "room_id": "ROOM_B", "joined_at": "2026-07-15T02:00:00Z"},
        {"id": "user-1", "room_id": "ROOM_C", "joined_at": "2026-07-15T00:30:00Z"}
    ]
    mock_users = MagicMock()
    mock_users.find.return_value.to_list = AsyncMock(return_value=memberships)
    mock_db.users = mock_users
    
    # Mock rooms:
    # ROOM_A: owned by user-2 (not owned by user-1)
    # ROOM_B: owned by user-3 (not owned by user-1)
    # ROOM_C: owned by user-1 (owned, so it should be excluded)
    rooms = [
        {"id": "ROOM_A", "name": "Room A", "owner_id": "user-2"},
        {"id": "ROOM_B", "name": "Room B", "owner_id": "user-3"}
    ]
    mock_rooms = MagicMock()
    mock_rooms.find.return_value.to_list = AsyncMock(return_value=rooms)
    mock_db.rooms = mock_rooms
    
    db_instance.db = mock_db
    
    result = await users.get_recent_rooms("user-1", current_user_id="user-1")
    
    # Assert find called with correct filter excluding owner_id="user-1"
    mock_db.rooms.find.assert_called_once()
    find_args = mock_db.rooms.find.call_args[0][0]
    assert find_args["id"]["$in"] == ["ROOM_A", "ROOM_B", "ROOM_C"]
    assert find_args["owner_id"] == {"$ne": "user-1"}
    
    # Assert result is sorted by joined_at descending: ROOM_B (02:00) then ROOM_A (01:00)
    assert len(result) == 2
    assert result[0]["id"] == "ROOM_B"
    assert result[1]["id"] == "ROOM_A"

@pytest.mark.asyncio
async def test_join_room_sets_joined_at():
    """Verify that join_room_http stores the joined_at timestamp in user_data."""
    mock_db = MagicMock()
    
    # Mock room exists
    mock_db.rooms.find_one = AsyncMock(return_value={"id": "ROOM_XYZ", "owner_id": "user-other"})
    mock_db.users.count_documents = AsyncMock(return_value=1)
    mock_db.users.update_one = AsyncMock()
    mock_db.users.find_one = AsyncMock(return_value={"id": "user-1", "room_id": "ROOM_XYZ", "name": "Test User"})
    
    db_instance.db = mock_db
    
    from fastapi import Request
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/rooms/ROOM_XYZ/join",
        "headers": [],
        "app": fastapi_app,
        "client": ("127.0.0.1", 12345)
    }
    mock_request = Request(scope)
    
    user_join = domain.UserJoin(
        room_id="ROOM_XYZ",
        name="Test User",
        user_id="user-1",
        picture=None,
        is_spectator=False
    )
    
    await rooms.join_room_http(mock_request, "ROOM_XYZ", user_join)
    
    # Assert update_one was called and set joined_at
    mock_db.users.update_one.assert_called_once()
    set_dict = mock_db.users.update_one.call_args[0][1]["$set"]
    assert "joined_at" in set_dict
    assert set_dict["id"] == "user-1"
    assert set_dict["room_id"] == "ROOM_XYZ"
