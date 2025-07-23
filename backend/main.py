from backend.database import SessionLocal, engine, get_db
from backend import models, schemas, crud
from fastapi import FastAPI, HTTPException, Depends, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.responses import StreamingResponse
from fastapi import BackgroundTasks
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
import qrcode
import io
from uuid import uuid4
from typing import Optional, List
import os
from dotenv import load_dotenv
from functools import wraps
import json
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Initialize app
app = FastAPI(title="CareChain API", version="1.0.0")


@app.on_event("startup")
async def startup_event():
    try:
        models.Base.metadata.create_all(bind=engine)
        logger.info("Database tables initialized successfully")
    except Exception as e:
        logger.error(f"Database initialization failed: {str(e)}")
        raise


@app.on_event("shutdown")
async def shutdown_event():
    try:
        SessionLocal.remove()
        engine.dispose()
        logger.info("Database connections closed successfully")
    except Exception as e:
        logger.error(f"Error closing database connections: {str(e)}")

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://care-chain.vercel.app",
        "http://localhost:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security Configuration
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY or len(SECRET_KEY) < 20:
    raise ValueError("SECRET_KEY must be at least 20 characters long")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30))
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def verify_password(plain_password: str, hashed_password: str):
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str):
    return pwd_context.hash(password)


def validate_password(password: str):
    if len(password) < 10:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 10 characters long"
        )
    if not any(c.isdigit() for c in password):
        raise HTTPException(
            status_code=400,
            detail="Password must contain at least one digit"
        )
    if not any(c.isupper() for c in password):
        raise HTTPException(
            status_code=400,
            detail="Password must contain at least one uppercase letter"
        )
    if not any(c in "@$!%*?&" for c in password):
        raise HTTPException(
            status_code=400,
            detail="Password must contain at least one special character (@$!%*?&)"
        )


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if not email:
            raise credentials_exception
        if datetime.utcnow() > datetime.fromtimestamp(payload.get("exp")):
            raise HTTPException(status_code=401, detail="Token expired")
    except JWTError:
        raise credentials_exception

    user = crud.get_user_by_email(db, email=email)
    if not user or not user.is_active:
        raise credentials_exception
    return user


def requires_role(required_roles: list):
    def decorator(route_func):
        @wraps(route_func)
        async def wrapper(*args, current_user: models.User = Depends(get_current_user), **kwargs):
            if current_user.role not in required_roles:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Insufficient permissions"
                )
            return await route_func(*args, current_user=current_user, **kwargs)
        return wrapper
    return decorator


@app.post("/auth/signup", response_model=schemas.User)
async def signup(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "Email already registered",
                    "code": "email_exists"}
        )

    validate_password(user.password)
    hashed_password = get_password_hash(user.password)
    created_user = crud.create_user(
        db=db,
        user=user,
        hashed_password=hashed_password
    )
    return created_user


@app.post("/auth/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = crud.authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"}
        )

    access_token = create_access_token(
        data={"sub": user.email, "role": user.role},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "email": user.email,
            "name": user.name,
            "role": user.role
        }
    }


@app.post("/auth/forgot-password")
async def forgot_password(email: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    user = crud.get_user_by_email(db, email=email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    reset_token = create_access_token(
        data={"sub": user.email},
        expires_delta=timedelta(minutes=15)
    )

    # Example: send_email is your async function or background task to email the reset link
    reset_link = f"https://care-chain.vercel.app/reset-password?token={reset_token}"
    background_tasks.add_task(send_email, user.email, reset_link)

    return {"message": "Password reset instructions sent to your email"}


async def send_email(to_email: str, reset_link: str):
    # Implement your email sending logic here (SendGrid, SMTP, Mailgun, etc.)
    logger.info(
        f"Sending password reset email to {to_email} with link: {reset_link}")


@app.post("/patients", response_model=schemas.Patient)
@requires_role(["doctor", "admin"])
async def create_patient(
    patient: schemas.PatientCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    try:
        return crud.create_patient(db=db, patient=patient, user_id=current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating patient: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/patients", response_model=List[schemas.Patient])
@requires_role(["doctor", "nurse", "admin"])
async def read_patients(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if limit > 100:
        limit = 100
    return crud.get_patients(db, skip=skip, limit=limit)


@app.get("/patients/{patient_id}/qrcode")
@requires_role(["doctor", "nurse"])
async def generate_qr_code(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    patient = crud.get_patient(db, patient_id=patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    qr_token = str(uuid4())
    qr_data = {
        "patient_id": patient.id,
        "token": qr_token,
        "exp": (datetime.utcnow() + timedelta(minutes=15)).isoformat()
    }

    patient.qr_token = qr_token
    db.commit()

    qr = qrcode.make(json.dumps(qr_data))
    buffer = io.BytesIO()
    qr.save(buffer, format="PNG")
    buffer.seek(0)
    return StreamingResponse(buffer, media_type="image/png")


@app.get("/patients/qr/{token}", response_model=schemas.Patient)
async def read_patient_via_qr(token: str, db: Session = Depends(get_db)):
    patient = db.query(models.Patient).filter(
        models.Patient.qr_token == token).first()
    if not patient:
        raise HTTPException(
            status_code=404, detail="Invalid or expired QR token")

    qr_data = json.loads(qrcode.decode(patient.qr_token))
    if datetime.fromisoformat(qr_data["exp"]) < datetime.utcnow():
        raise HTTPException(status_code=410, detail="QR code expired")

    return patient


@app.get("/patients/{patient_id}", response_model=schemas.Patient)
@requires_role(["doctor", "nurse", "admin"])
async def read_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    patient = crud.get_patient(db, patient_id=patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


@app.middleware("http")
async def log_requests(request: Request, call_next):
    response = await call_next(request)

    if request.url.path.startswith("/patients/") and request.method in ["GET", "POST", "PUT", "DELETE"]:
        db_gen = get_db()
        db = next(db_gen)
        try:
            auth = request.headers.get("authorization")
            if auth and auth.startswith("Bearer "):
                token = auth[7:]
                try:
                    payload = jwt.decode(
                        token, SECRET_KEY, algorithms=[ALGORITHM])
                    user = crud.get_user_by_email(db, email=payload.get("sub"))

                    if user:
                        patient_id = request.path_params.get("patient_id")
                        if patient_id:
                            log = models.AccessLog(
                                user_id=user.id,
                                patient_id=int(patient_id),
                                action=request.method,
                                ip_address=request.client.host,
                                user_agent=request.headers.get(
                                    "user-agent", ""),
                                endpoint=request.url.path
                            )
                            db.add(log)
                            db.commit()
                except JWTError:
                    pass
        except Exception as e:
            logger.error(f"Failed to log access: {str(e)}")
        finally:
            db_gen.close()

    return response


@app.get("/health")
async def health_check():
    return {"status": "OK", "timestamp": datetime.utcnow()}


@app.get("/")
async def root():
    return {
        "message": "CareChain API",
        "docs": "/docs",
        "version": "1.0.0"
    }


@app.get("/auth/verify")
async def verify_token(current_user: models.User = Depends(get_current_user)):
    return {
        "status": "valid",
        "user": {
            "email": current_user.email,
            "name": current_user.name,
            "role": current_user.role
        }
    }


@app.get("/auth/me", response_model=schemas.User)
async def get_current_user_data(current_user: models.User = Depends(get_current_user)):
    return current_user
