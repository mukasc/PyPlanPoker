import asyncio
import httpx
import socketio
import uuid
import logging
from typing import List, Dict

# Config
BASE_URL = "http://localhost:5001/api"
SOCKET_URL = "http://localhost:5001"

logging.basicConfig(level=logging.INFO, format="%(asctime)s - [%(levelname)s] %(message)s")
logger = logging.getLogger("Simulation")

class UserClient:
    def __init__(self, name: str, is_spectator: bool = False):
        self.name = name
        self.is_spectator = is_spectator
        self.user_id: str = ""
        self.token: str = ""
        self.room_id: str = ""
        self.ip = f"192.168.1.{uuid.uuid4().int % 250 + 1}"
        self.client = httpx.AsyncClient(base_url=BASE_URL, headers={"X-Forwarded-For": self.ip})
        self.sio = socketio.AsyncClient(logger=False, engineio_logger=False)
        self.state = {}
        self.setup_socket()

    def setup_socket(self):
        @self.sio.on("state_update")
        async def on_state_update(data):
            self.state = data

        @self.sio.on("reveal_votes")
        async def on_reveal_votes(data):
            self.state = data
            logger.info(f"🃏 [{self.name}] Cards revealed!")

    async def authenticate(self):
        logger.info(f"[{self.name}] Authenticating as guest...")
        res = await self.client.post("/auth/guest", json={"name": self.name})
        res.raise_for_status()
        data = res.json()
        self.user_id = data["id"]
        self.token = data["access_token"]
        self.client.headers.update({"Authorization": f"Bearer {self.token}"})

    async def join_room(self, room_id: str):
        self.room_id = room_id
        logger.info(f"[{self.name}] Joining room {room_id} (Spectator: {self.is_spectator})...")
        payload = {
            "room_id": room_id,
            "user_id": self.user_id,
            "name": self.name,
            "is_spectator": self.is_spectator
        }
        res = await self.client.post(
            f"/rooms/{room_id}/join",
            json=payload
        )
        res.raise_for_status()
        
        # Connect to socket
        await self.sio.connect(SOCKET_URL, socketio_path='/api/socket.io', transports=['websocket', 'polling'])
        await self.sio.emit("join_room", {"room_id": room_id, "user_id": self.user_id})

    async def create_task(self, title: str):
        logger.info(f"[{self.name}] Creating task: {title}")
        res = await self.client.post("/tasks", json={
            "room_id": self.room_id,
            "title": title,
            "description": f"Description for {title}"
        })
        res.raise_for_status()
        return res.json()

    async def set_active_task(self, task_id: str):
        logger.info(f"[{self.name}] Activating task: {task_id}")
        res = await self.client.post("/active-task", json={
            "room_id": self.room_id,
            "user_id": self.user_id,
            "task_id": task_id
        })
        res.raise_for_status()

    async def vote(self, task_id: str, value: str):
        logger.info(f"[{self.name}] Voting {value} for task {task_id}")
        res = await self.client.post("/vote", json={
            "room_id": self.room_id,
            "task_id": task_id,
            "user_id": self.user_id,
            "value": value
        })
        res.raise_for_status()

    async def reveal(self):
        logger.info(f"[{self.name}] Forcing reveal")
        res = await self.client.post("/reveal", json={
            "room_id": self.room_id,
            "user_id": self.user_id
        })
        res.raise_for_status()

    async def complete_task(self, task_id: str, final_score: str):
        logger.info(f"[{self.name}] Completing task {task_id} with score {final_score}")
        res = await self.client.post("/complete", json={
            "room_id": self.room_id,
            "user_id": self.user_id,
            "task_id": task_id,
            "final_score": final_score
        })
        res.raise_for_status()

    async def disconnect(self):
        await self.sio.disconnect()
        await self.client.aclose()


async def simulate_session():
    logger.info("🚀 Starting 11-user simulation")
    
    # Create Tech Leader
    tech_leader = UserClient("Tech Leader")
    await tech_leader.authenticate()

    # Create Room
    logger.info("🏠 Tech Leader creating room...")
    res = await tech_leader.client.post("/rooms", json={
        "name": "Simulation Room 11 Users",
        "deck_type": "FIBONACCI"
    })
    res.raise_for_status()
    room_id = res.json()["id"]
    logger.info(f"✅ Room created: {room_id}")

    # Tech Leader joins the room
    await tech_leader.join_room(room_id)

    # Create Developers
    developers: List[UserClient] = []
    for i in range(1, 9):
        dev = UserClient(f"Developer {i}")
        await dev.authenticate()
        developers.append(dev)

    # Create Observers
    pm = UserClient("Project Manager", is_spectator=True)
    po = UserClient("Product Owner", is_spectator=True)
    await pm.authenticate()
    await po.authenticate()
    observers = [pm, po]

    # All join the room concurrently
    logger.info("👥 All users joining the room...")
    join_tasks = [user.join_room(room_id) for user in developers + observers]
    await asyncio.gather(*join_tasks)

    # Wait a bit for sockets to sync
    await asyncio.sleep(2)
    
    # Tech Leader creates 3 tasks
    task1 = await tech_leader.create_task("Implement login API")
    task2 = await tech_leader.create_task("Fix socket disconnection bug")
    task3 = await tech_leader.create_task("Refactor database models")
    tasks = [task1, task2, task3]

    fibonacci = ["1", "2", "3", "5", "8", "13", "21"]

    for i, t in enumerate(tasks):
        logger.info(f"\n--- 🔄 Starting Round {i+1}: {t['title']} ---")
        await tech_leader.set_active_task(t["id"])
        await asyncio.sleep(1)

        # Let's vote! Tech Leader + Developers
        vote_coros = []
        import random
        # Tech leader vote
        vote_coros.append(tech_leader.vote(t["id"], random.choice(fibonacci)))
        # Developers vote
        for dev in developers:
            vote_coros.append(dev.vote(t["id"], random.choice(fibonacci)))
        
        logger.info("🗳️ Everyone is voting concurrently...")
        await asyncio.gather(*vote_coros)
        
        # Wait a bit for the system to process all votes and auto-reveal via socket
        logger.info("⏳ Waiting for auto-reveal...")
        await asyncio.sleep(2)
        
        # Verify observer cannot vote
        logger.info("🚫 Checking observer restriction...")
        try:
            await pm.vote(t["id"], "5")
            logger.error("❌ Observer was able to vote!")
        except Exception as e:
            logger.info("✅ Observer was correctly prevented from voting.")

        # Complete task
        await tech_leader.complete_task(t["id"], "5")
        await asyncio.sleep(1)

    logger.info("\n✅ Simulation finished without critical errors!")
    
    # Verify final state using Tech Leader's socket state or HTTP
    final_res = await tech_leader.client.get(f"/rooms/{room_id}/state")
    final_res.raise_for_status()
    final_state = final_res.json()
    
    completed_tasks = [t for t in final_state["tasks"] if t["status"] == "COMPLETED"]
    logger.info(f"📊 Total completed tasks in DB: {len(completed_tasks)}/3")
    
    # Cleanup
    logger.info(f"🧹 Cleaning up room {room_id} from database...")
    cleanup_res = await tech_leader.client.delete(f"/admin/rooms/{room_id}")
    if cleanup_res.status_code == 200:
        logger.info("✅ Cleanup successful! Room, tasks, users, and votes deleted.")
    else:
        logger.error(f"❌ Cleanup failed with status {cleanup_res.status_code}")

    logger.info("\n✅ Simulation finished without critical errors!")
    
    for u in [tech_leader] + developers + observers:
        await u.sio.disconnect()
        await u.client.aclose()

    logger.info("🔌 All clients disconnected.")

if __name__ == "__main__":
    try:
        asyncio.run(simulate_session())
    except KeyboardInterrupt:
        logger.info("🛑 Simulation interrupted.")
