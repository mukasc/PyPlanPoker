import os
import logging
from datetime import datetime, timezone
import socketio

from fastapi import FastAPI, Request
from starlette.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

from app.core.config import settings
from app.core.security import limiter
from app.db.database import db_instance
from app.services.socket import sio
from app.api.routers import auth, rooms, tasks, actions, admin, users
from app.models.domain import FIBONACCI_VALUES

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

fastapi_app = FastAPI()
fastapi_app.state.limiter = limiter
fastapi_app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

logger.info(f"🔒 Allowed CORS Origins: {settings.ALLOWED_ORIGINS}")
fastapi_app.add_middleware(
    CORSMiddleware, 
    allow_origins=settings.ALLOWED_ORIGINS, 
    allow_credentials=True, 
    allow_methods=["*"], 
    allow_headers=["*"]
)

@fastapi_app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    
    ancestors = " ".join(settings.ALLOWED_FRAME_ANCESTORS)
    csp = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline'; " 
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "font-src 'self' https: data:; "
        "connect-src 'self' ws: wss: http: https:; "
        f"frame-ancestors 'self' {ancestors};"
    )
    response.headers["Content-Security-Policy"] = csp
    return response

@fastapi_app.on_event("startup")
async def startup_event():
    await db_instance.connect()

@fastapi_app.on_event("shutdown")
async def shutdown_event():
    await db_instance.disconnect()

# Include routers
fastapi_app.include_router(auth.router, prefix="/api")
fastapi_app.include_router(rooms.router, prefix="/api")
fastapi_app.include_router(tasks.router, prefix="/api")
fastapi_app.include_router(actions.router, prefix="/api")
fastapi_app.include_router(admin.router, prefix="/api")
fastapi_app.include_router(users.router, prefix="/api")

@fastapi_app.get("/api/fibonacci")
async def get_fibonacci():
    return {"values": FIBONACCI_VALUES}

@fastapi_app.get("/")
async def root():
    return {
        "status": "online",
        "message": "PyPlanPoker Backend is running (Refactored)",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@fastapi_app.get("/api/health")
async def health():
    db_status = "offline"
    if db_instance.db is not None:
        try:
            await db_instance.db.command("ping")
            db_status = "online"
        except Exception as e:
            logger.error(f"❌ Erro ao verificar DB no health check: {e}")
            db_status = "connecting"
    
    return {
        "status": "online" if db_status == "online" else "booting",
        "database": db_status
    }

app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app, socketio_path='/api/socket.io')

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 5000))
    logger.info(f"🚀 Iniciando servidor na porta {port}")
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)
