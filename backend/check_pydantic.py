import os
import sys

from pydantic import BaseModel

sys.path.append(os.path.join(os.path.dirname(__file__)))
from server import Room, RoomCreate, get_deck_values

rc = RoomCreate(name="Testing", deck_type="T_SHIRT")
print(f"RoomCreate: {rc.model_dump()}")

room = Room(
    name=rc.name, 
    deck_type=rc.deck_type,
    deck_values=get_deck_values(rc.deck_type)
)

print(f"Room: {room.model_dump()}")
