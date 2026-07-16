import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent.parent.parent
load_dotenv(ROOT_DIR / '.env')

class Settings:
    MONGO_URL: str = os.environ.get('MONGO_URL', '')
    DB_NAME: str = os.environ.get('DB_NAME', 'pyplanpoker')
    JWT_SECRET: str = os.environ.get("JWT_SECRET", "super-secret-key-change-it-in-prod")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7 # 1 week
    GOOGLE_CLIENT_ID: str = os.environ.get('GOOGLE_CLIENT_ID', '')
    
    # CORS
    raw_origins: str = os.environ.get("CORS_ORIGINS", os.environ.get("ALLOWED_ORIGINS", "*"))
    clean_origins: str = raw_origins.strip('"').strip("'")
    ALLOWED_ORIGINS: list[str] = [o.strip() for o in clean_origins.split(",") if o.strip()]
    
    # CSP
    ALLOWED_FRAME_ANCESTORS: list[str] = os.environ.get(
        "ALLOWED_FRAME_ANCESTORS", 
        "http://localhost:3000 http://localhost:3001 http://127.0.0.1:3001 http://localhost:5173"
    ).split(",")

settings = Settings()
