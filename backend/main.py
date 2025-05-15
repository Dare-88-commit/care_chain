from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
import qrcode
import io
from typing import Optional, List

from backend import models, schemas, crud
from backend.database import SessionLocal, engine

# Create tables
models.Base.metadata.create_all(bind=engine)

# App init
app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
SECRET_KEY = "your-secret-key"  # Change this to environment variable
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# DB Dependency


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Auth Helpers


def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password):
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# Auth Helper to get the current user


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
    except JWTError:
        raise credentials_exception
    user = crud.get_user_by_email(db, email=email)
    if user is None:
        raise credentials_exception
    return user

# Auth Routes


@app.post("/auth/signup", response_model=schemas.User)
def signup(user: schemas.UserCreate, db: Session = Depends(get_db)):
    if crud.get_user_by_email(db, user.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    user.password = get_password_hash(user.password)
    return crud.create_user(db=db, user=user)


@app.post("/auth/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = crud.authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=401, detail="Incorrect email or password"
        )
    access_token = create_access_token(
        data={"sub": user.email},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {"access_token": access_token, "token_type": "bearer"}

# Patient Routes


@app.post("/patients", response_model=schemas.Patient)
def create_patient(
    patient: schemas.PatientCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return crud.create_patient(db=db, patient=patient, user_id=current_user.id)


@app.get("/patients", response_model=list[schemas.Patient])
def read_patients(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return crud.get_patients(db, skip=skip, limit=limit)


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


@app.put("/patients/{patient_id}", response_model=schemas.Patient)
def update_patient(
    patient_id: int,
    patient: schemas.PatientCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    updated = crud.update_patient(db, patient_id=patient_id, patient=patient)
    if not updated:
        raise HTTPException(status_code=404, detail="Patient not found")
    return updated


@app.delete("/patients/{patient_id}", response_model=schemas.Patient)
def delete_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    deleted = crud.delete_patient(db, patient_id=patient_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Patient not found")
    return deleted

# QR Code Generation


@app.get("/patients/{patient_id}/qrcode")
def generate_qr_code(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    patient = crud.get_patient(db, patient_id=patient_id)
    if not patient:
        raise HTTPException(404, "Patient not found")

    # Minimal critical data for offline use
    qr_data = {
        "id": patient.id,
        "name": patient.name,  # Assuming 'name' is the correct field in the model
        "blood_type": patient.blood_type,
        "allergies": patient.allergies
    }

    qr = qrcode.make(qr_data)
    buffer = io.BytesIO()
    qr.save(buffer, format="PNG")
    buffer.seek(0)
    return StreamingResponse(buffer, media_type="image/png")

# Patient Synchronization (Offline Sync)


@app.post("/patients/sync")
def sync_patients(
    patients: List[schemas.PatientCreate],
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """For offline sync"""
    synced = []
    for patient in patients:
        try:
            db_patient = crud.create_patient(db, patient, current_user.id)
            synced.append(db_patient)
        except Exception as e:
            raise HTTPException(
                status_code=400, detail=f"Failed to sync patient: {str(e)}")
    return {"synced": len(synced)}

# Root Endpoint


@app.get("/")
def root():
    return {"message": "Welcome to CareChain API"}
