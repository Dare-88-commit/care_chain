# Only import, do not redefine get_db!
from backend.database import SessionLocal, engine, get_db
from backend import models, schemas, crud
from fastapi import FastAPI, HTTPException, Depends, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.responses import StreamingResponse
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
# Load environment variables
load_dotenv()

# Initialize app
app = FastAPI(title="CareChain API", version="1.0.0")


@app.on_event("startup")
def on_startup():
    models.Base.metadata.create_all(bind=engine)


# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://care-chain.vercel.app",
        "http://localhost:3000"  # For development
        # TODO: Restrict to deployed frontend URL in production
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 1440))
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# Password Helpers


def verify_password(plain_password: str, hashed_password: str):
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str):
    return pwd_context.hash(password, rounds=12)

# Password Validation


def validate_password(password: str):
    if len(password) < 8:
        raise HTTPException(
            status_code=400, detail="Password must be at least 8 characters long")
    if not any(c.isdigit() for c in password):
        raise HTTPException(
            status_code=400, detail="Password must contain at least one digit")
    if not any(c.isalpha() for c in password):
        raise HTTPException(
            status_code=400, detail="Password must contain at least one letter")

# JWT Token Handling


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
        exp: int = payload.get("exp")
        if datetime.utcnow().timestamp() > exp:
            raise HTTPException(status_code=401, detail="Token expired")
    except JWTError:
        raise credentials_exception

    user = crud.get_user_by_email(db, email=email)
    if not user:
        raise credentials_exception
    return user

# Role-Based Access Control


def requires_role(required_role: str):
    def decorator(route_func):
        @wraps(route_func)
        async def wrapper(*args, current_user: models.User = Depends(get_current_user), **kwargs):
            if current_user.role != required_role:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Insufficient permissions"
                )
            return await route_func(*args, current_user=current_user, **kwargs)
        return wrapper
    return decorator

# Authentication Routes


@app.post("/auth/signup", response_model=schemas.User)
def signup(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "Email already registered",
                    "code": "email_exists"}
        )

    try:
        validate_password(user.password)
        hashed_password = get_password_hash(user.password)
        created_user = crud.create_user(
            db=db, user=user, hashed_password=hashed_password)
        return created_user
    except HTTPException as e:
        raise e
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"message": "Registration failed", "code": "server_error"}
        )


@app.post("/auth/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
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

# Patient Routes


@app.post("/patients", response_model=schemas.Patient)
@requires_role("doctor")
async def create_patient(
    patient: schemas.PatientCreate,
    db: Session = Depends(get_db),  # This is correct!
    current_user: models.User = Depends(get_current_user)
):
    try:
        return crud.create_patient(db=db, patient=patient, user_id=current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/patients", response_model=List[schemas.Patient])
def read_patients(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return crud.get_patients(db, skip=skip, limit=limit)


@app.put("/patients/{patient_id}", response_model=schemas.Patient)
@requires_role("doctor")
async def update_patient(
    patient_id: int,
    patient: schemas.PatientUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return crud.update_patient(db, patient_id, patient)


@app.delete("/patients/{patient_id}", status_code=204)
@requires_role("doctor")
async def delete_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    deleted = crud.delete_patient(db, patient_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Patient not found")
    return {"detail": "Patient deleted"}

# QR Code Generation


@app.get("/patients/{patient_id}/qrcode")
def generate_qr_code(
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
        "exp": (datetime.utcnow() + timedelta(hours=1)).isoformat()
    }

    patient.qr_token = qr_token
    db.commit()

    qr = qrcode.make(json.dumps(qr_data))
    buffer = io.BytesIO()
    qr.save(buffer, format="PNG")
    buffer.seek(0)
    return StreamingResponse(buffer, media_type="image/png")

# QR Token Validation


@app.get("/patients/qr/{token}", response_model=schemas.Patient)
def read_patient_via_qr(token: str, db: Session = Depends(get_db)):
    patient = db.query(models.Patient).filter(
        models.Patient.qr_token == token).first()
    if not patient:
        raise HTTPException(
            status_code=404, detail="Invalid or expired QR token")
    return patient

# PATIENT Access Logging


@app.get("/patients/{patient_id}", response_model=schemas.Patient)
def read_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    patient = crud.get_patient(db, patient_id=patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


# Access Logging Middleware


@app.middleware("http")
async def log_requests(request: Request, call_next):
    response = await call_next(request)

    if request.url.path.startswith("/patients/") and request.method in ["GET", "POST", "PUT", "DELETE"]:
        db = SessionLocal()  # Correct
        # db = get_db()      # WRONG
        # db = next(get_db()) # WRONG
        try:
            auth = request.headers.get("authorization")
            if auth:
                token = auth.replace("Bearer ", "")
                payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
                user = crud.get_user_by_email(db, email=payload.get("sub"))

                if user:
                    patient_id = request.path_params.get("patient_id")
                    if patient_id:
                        log = models.AccessLog(
                            user_id=user.id,
                            patient_id=int(patient_id),
                            action=request.method.lower(),
                            ip_address=request.client.host
                        )
                        db.add(log)
                        db.commit()
        except Exception:
            pass
        finally:
            db.close()

    return response

# Health Check & Root


@app.get("/health")
def health_check():
    return {"status": "OK", "timestamp": datetime.utcnow()}


@app.get("/")
def root():
    return {
        "message": "CareChain API",
        "docs": "/docs",
        "version": "1.0.0"
    }

# Token Verification


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
