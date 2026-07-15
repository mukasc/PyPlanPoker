import sys
import os
import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock

# Add backend dir to path so we can import server
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import server

@pytest.mark.asyncio
async def test_join_room_scoping():
    """Verify that join_room socket handler scopes database user updates to the specific room."""
    # Mock database
    mock_db = MagicMock()
    mock_users = MagicMock()
    mock_users.update_one = AsyncMock()
    mock_db.users = mock_users
    
    server.db = mock_db
    
    # Mock socketio operations
    server.sio.enter_room = AsyncMock()
    server.broadcast_room_state = AsyncMock()
    
    sid = "test-sid-1"
    data = {"room_id": "ROOM_123", "user_id": "user-google-1"}
    
    await server.join_room(sid, data)
    
    # Assert update_one was called with the correct room scope
    mock_db.users.update_one.assert_called_with(
        {"id": "user-google-1", "room_id": "ROOM_123"},
        {"$set": {"is_online": True}}
    )

@pytest.mark.asyncio
async def test_disconnect_scoping():
    """Verify that disconnect socket handler scopes database user status update to the current room."""
    # Mock database
    mock_db = MagicMock()
    mock_users = MagicMock()
    mock_users.update_one = AsyncMock()
    mock_db.users = mock_users
    
    mock_db.rooms = MagicMock()
    mock_db.rooms.find_one = AsyncMock(return_value=None)
    
    server.db = mock_db
    
    sid = "test-sid-1"
    server.socket_users[sid] = {"room_id": "ROOM_123", "user_id": "user-google-1"}
    
    await server.disconnect(sid)
    
    # Assert update_one was called with the correct room scope
    mock_db.users.update_one.assert_called_with(
        {"id": "user-google-1", "room_id": "ROOM_123"},
        {"$set": {"is_online": False}}
    )

@pytest.mark.asyncio
async def test_cast_vote_scoping():
    """Verify that cast_vote_http endpoint scopes spectator check to the specific room."""
    # Mock database
    mock_db = MagicMock()
    mock_users = MagicMock()
    mock_find = MagicMock()
    mock_find.to_list = AsyncMock(return_value=[])
    mock_users.find.return_value = mock_find
    mock_users.find_one = AsyncMock(return_value={"id": "user-google-1", "is_spectator": False})
    mock_users.update_one = AsyncMock()
    mock_db.users = mock_users
    
    mock_db.rooms = MagicMock()
    mock_db.rooms.find_one = AsyncMock(return_value={"id": "ROOM_123"})
    mock_db.rooms.update_one = AsyncMock()
    
    mock_db.votes = MagicMock()
    mock_db.votes.delete_one = AsyncMock()
    mock_db.votes.insert_one = AsyncMock()
    mock_db.votes.find = MagicMock()
    mock_db.votes.find.return_value.to_list = AsyncMock(return_value=[])
    
    server.db = mock_db
    
    action = server.ActionVote(
        room_id="ROOM_123",
        user_id="user-google-1",
        task_id="task-abc",
        value="8"
    )
    
    # Call cast_vote_http
    await server.cast_vote_http(action, current_user_id="user-google-1")
    
    # Assert find_one was called with the correct room scope
    mock_db.users.find_one.assert_called_with(
        {"id": "user-google-1", "room_id": "ROOM_123"}
    )
