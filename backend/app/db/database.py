import logging
from typing import Optional, Any
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

logger = logging.getLogger(__name__)

class Database:
    client: Optional[AsyncIOMotorClient] = None
    db: Any = None

    async def connect(self):
        if settings.MONGO_URL:
            try:
                self.client = AsyncIOMotorClient(settings.MONGO_URL)
                self.db = self.client[settings.DB_NAME]
                logger.info(f"✅ MongoDB Conectado: {settings.DB_NAME}")
            except Exception as e:
                logger.error(f"❌ Erro MongoDB: {e}")

    async def disconnect(self):
        if self.client:
            self.client.close()
            logger.info("MongoDB Desconectado")

db_instance = Database()

def get_db():
    return db_instance.db
