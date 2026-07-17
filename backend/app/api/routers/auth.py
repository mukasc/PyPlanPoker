import os
import uuid
import logging
from fastapi import APIRouter, Request, HTTPException, Response
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from app.models.domain import AuthGoogle, GuestAuth
from app.core.config import settings
from app.core.security import create_access_token, limiter
from app.db.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Auth"])

@router.post("/google")
@limiter.limit("5/minute")
async def auth_google(request: Request, input: AuthGoogle, response: Response):
    try:
        idinfo = id_token.verify_oauth2_token(input.credential, google_requests.Request(), settings.GOOGLE_CLIENT_ID)
        userid = idinfo['sub']
        email = idinfo.get('email', '')
        name = idinfo.get('name', '')
        picture = idinfo.get('picture', '')

        db = get_db()
        if db is not None:
             await db.global_users.update_one(
                 {"id": userid},
                 {"$set": {"email": email, "name": name, "picture": picture}},
                 upsert=True
             )
        
        token = create_access_token(data={"sub": userid})
        
        response.set_cookie(
            key="access_token",
            value=token,
            httponly=True,
            max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            samesite="lax",
            secure=False
        )
        
        return {
            "id": userid,
            "email": email,
            "name": name,
            "picture": picture,
            "access_token": token,
            "token_type": "bearer"
        }
    except ValueError as e:
        logger.error(f"Google auth error: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")

@router.post("/guest")
@limiter.limit("100/minute")
async def auth_guest(request: Request, input: GuestAuth, response: Response):
    guest_id = f"guest-{str(uuid.uuid4())[:12]}"
    token = create_access_token(data={"sub": guest_id, "is_guest": True})
    
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="lax",
        secure=False
    )
    
    return {
        "id": guest_id,
        "name": input.name,
        "access_token": token,
        "token_type": "bearer",
        "is_guest": True
    }

@router.post("/logout")
async def auth_logout(response: Response):
    response.delete_cookie(key="access_token", samesite="lax")
    return {"status": "success"}
