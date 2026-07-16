import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict, field_validator

FIBONACCI_VALUES = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, "?"]

class TaskStatus(str, Enum):
    PENDING = "PENDING"
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

class RoomCreate(BaseModel):
    name: str
    owner_id: Optional[str] = None
    deck_type: str = "FIBONACCI"
    custom_deck: Optional[str] = None

class UserJoin(BaseModel):
    room_id: str
    name: str
    user_id: Optional[str] = None
    picture: Optional[str] = None
    is_spectator: bool = False

class TaskCreate(BaseModel):
    room_id: str
    title: str
    description: Optional[str] = ""

class AuthGoogle(BaseModel): 
    credential: str

class GuestAuth(BaseModel): 
    name: str

class ActionBase(BaseModel):
    room_id: str
    user_id: str
    
    @field_validator('room_id')
    def uppercase_room_id(cls, v): return v.upper()

class ActionActiveTask(ActionBase): task_id: str
class ActionVote(ActionBase): task_id: str; value: str
class ActionUnvote(ActionBase): task_id: str
class ActionReveal(ActionBase): pass
class ActionReset(ActionBase): task_id: Optional[str] = None
class ActionComplete(ActionBase): task_id: str; final_score: str
class ActionDelete(ActionBase): task_id: str
class ActionKick(ActionBase): target_user_id: str
class ActionTimer(ActionBase): duration_seconds: int
class ActionReorder(ActionBase): task_ids: List[str]

class BatchDeleteRequest(BaseModel):
    ids: List[str]
    confirm: bool = False

class BatchDeleteRoomsRequest(BaseModel):
    ids: List[str]

class Room(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:8].upper())
    name: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    owner_id: Optional[str] = None
    cards_revealed: bool = False
    active_task_id: Optional[str] = None
    deck_type: str = "FIBONACCI"
    deck_values: List[str] = [str(v) for v in FIBONACCI_VALUES]
    timer_end: Optional[str] = None

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    room_id: str
    name: str
    picture: Optional[str] = None
    is_admin: bool = False
    is_spectator: bool = False
    has_voted: bool = False
    is_online: bool = True
    joined_at: Optional[str] = None

class Task(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    room_id: str
    title: str
    description: str = ""
    status: TaskStatus = TaskStatus.PENDING
    final_score: Optional[str] = None
    votes_summary: List[Dict[str, Any]] = []
    position: int = 0

class Vote(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    task_id: str
    user_id: str
    value: str

def get_deck_values(deck_type: str, custom_deck: Optional[str] = None) -> List[str]:
    if deck_type == "T_SHIRT":
        return ["XS", "S", "M", "L", "XL", "XXL", "?"]
    elif deck_type == "SEQUENTIAL":
        return ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "?"]
    elif deck_type == "CUSTOM" and custom_deck:
        return [v.strip() for v in custom_deck.split(",") if v.strip()]
    return [str(v) for v in FIBONACCI_VALUES]
