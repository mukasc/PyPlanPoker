import os
import glob

imports = """
from app.main import fastapi_app
from app.db.database import db_instance
from app.services import socket
from app.api.routers import auth, rooms, users, tasks, actions, admin
from app.models import domain
"""

for filepath in glob.glob("test_backend_*.py"):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Imports
    content = content.replace("import server\n", imports + "\n")
    content = content.replace("import server", imports)

    # 2. Database
    content = content.replace("server.db", "db_instance.db")

    # 3. Models
    for model in ["ActionUnvote", "ActionVote", "UserJoin", "BatchDeleteRequest", "BatchDeleteRoomsRequest", "TaskStatus"]:
        content = content.replace(f"server.{model}", f"domain.{model}")

    # 4. Socket and broadcast
    content = content.replace("server.sio.enter_room", "socket.sio.enter_room")
    content = content.replace("server.sio.emit", "socket.sio.emit")
    content = content.replace("server.socket_users", "socket.socket_users")
    content = content.replace("server.disconnect", "socket.disconnect")
    content = content.replace("server.join_room(", "socket.join_room(")
    
    # 5. Routers
    content = content.replace("server.cast_vote_http", "actions.cast_vote_http")
    content = content.replace("server.retract_vote_http", "actions.retract_vote_http")
    content = content.replace("server.join_room_http", "rooms.join_room_http")
    content = content.replace("server.get_recent_rooms", "users.get_recent_rooms")
    content = content.replace("server.get_admin_users", "admin.get_admin_users")
    content = content.replace("server.check_user_relations", "admin.check_user_relations")
    content = content.replace("server.delete_user", "admin.delete_user")
    content = content.replace("server.merge_users", "admin.merge_users")
    content = content.replace("server.batch_delete_users", "admin.batch_delete_users")
    content = content.replace("server.batch_delete_rooms", "admin.batch_delete_rooms")
    content = content.replace("server.get_room_state", "socket.get_room_state")
    
    # 6. Mocking broadcast_room_state and sio.emit which are used across multiple modules
    content = content.replace(
        "server.broadcast_room_state = AsyncMock()",
        "mock_broadcast = AsyncMock()\n    socket.broadcast_room_state = actions.broadcast_room_state = rooms.broadcast_room_state = admin.broadcast_room_state = users.broadcast_room_state = mock_broadcast"
    )
    content = content.replace("server.broadcast_room_state.assert", "mock_broadcast.assert")
    content = content.replace("server.broadcast_room_state", "mock_broadcast")
    
    content = content.replace("server.fastapi_app", "fastapi_app")

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
