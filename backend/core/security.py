from slowapi.util import get_remote_address
from slowapi import Limiter
import os
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

# --- Configuration --- #


class SecurityConfig(BaseModel):
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "")
    JWT_REFRESH_SECRET_KEY: str = os.getenv("JWT_REFRESH_SECRET_KEY", "")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    TOKEN_BLACKLIST: set = set()

    @classmethod
    def validate(cls):
        if not cls.JWT_SECRET_KEY or len(cls.JWT_SECRET_KEY) < 32:
            raise ValueError("JWT_SECRET_KEY must be at least 32 chars long")
        if not cls.JWT_REFRESH_SECRET_KEY:
            raise ValueError("Missing JWT_REFRESH_SECRET_KEY")


config = SecurityConfig()
config.validate()

# --- Password Hashing --- #
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Securely verify passwords against stored hashes"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Generate bcrypt hash with automatic salting"""
    return pwd_context.hash(password)

# --- JWT Tokens --- #


class TokenPayload(BaseModel):
    sub: str  # user_id/email
    exp: datetime
    jti: str  # Unique token ID for revocation


def create_token(
    subject: str,
    expires_delta: timedelta,
    secret_key: str,
    token_type: str = "access"
) -> str:
    """Generic token creation with jti (JWT ID) for revocation"""
    expire = datetime.utcnow() + expires_delta
    jti = os.urandom(16).hex()
    payload = {
        "sub": subject,
        "exp": expire,
        "jti": jti,
        "type": token_type
    }
    return jwt.encode(payload, secret_key, algorithm=config.ALGORITHM)


def create_access_token(subject: str) -> str:
    return create_token(
        subject=subject,
        expires_delta=timedelta(minutes=config.ACCESS_TOKEN_EXPIRE_MINUTES),
        secret_key=config.JWT_SECRET_KEY
    )


def create_refresh_token(subject: str) -> str:
    return create_token(
        subject=subject,
        expires_delta=timedelta(days=config.REFRESH_TOKEN_EXPIRE_DAYS),
        secret_key=config.JWT_REFRESH_SECRET_KEY,
        token_type="refresh"
    )


def decode_token(token: str, secret_key: str) -> TokenPayload:
    try:
        payload = jwt.decode(token, secret_key, algorithms=[config.ALGORITHM])
        return TokenPayload(**payload)
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}"
        )

# --- Token Revocation --- #


def revoke_token(token: str):
    """Add token to blacklist (call on logout)"""
    try:
        payload = decode_token(token, config.JWT_SECRET_KEY)
        config.TOKEN_BLACKLIST.add(payload.jti)
    except JWTError:
        pass  # Token already invalid


def is_token_revoked(decoded_token: TokenPayload) -> bool:
    """Check if token was revoked"""
    return decoded_token.jti in config.TOKEN_BLACKLIST

# --- FastAPI Dependencies --- #


class JWTBearer(HTTPBearer):
    """Automatically checks for revoked tokens"""

    async def __call__(self, request: Request) -> Optional[HTTPAuthorizationCredentials]:
        credentials = await super().__call__(request)
        if credentials:
            token = credentials.credentials
            payload = decode_token(token, config.JWT_SECRET_KEY)
            if is_token_revoked(payload):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token revoked"
                )
        return credentials


# --- Rate Limiting --- #

limiter = Limiter(
    key_func=lambda: get_remote_address(Request()),
    default_limits=["100/hour"]
)

# --- Usage Example in Routes --- #
"""
@app.post("/auth/login")
@limiter.limit("5/minute")
async def login(request: Request):
    # Your login logic
    return {
        "access_token": create_access_token(user.email),
        "refresh_token": create_refresh_token(user.email)
    }

@app.post("/auth/refresh")
async def refresh_token(refresh_token: str):
    payload = decode_token(refresh_token, config.JWT_REFRESH_SECRET_KEY)
    if payload.type != "refresh":
        raise HTTPException(status_code=400, detail="Invalid token type")
    return {"access_token": create_access_token(payload.sub)}
"""
