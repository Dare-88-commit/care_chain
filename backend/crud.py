from sqlalchemy.orm import Session
from . import models, schemas
from passlib.context import CryptContext
from datetime import datetime

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# --------------------------
# User CRUD Operations
# --------------------------


def get_user_by_email(db: Session, email: str):
    """Get a single user by email"""
    return db.query(models.User).filter(models.User.email == email).first()


def create_user(db: Session, user: schemas.UserCreate):
    """Create a new user with hashed password"""
    hashed_password = pwd_context.hash(user.password)
    db_user = models.User(
        email=user.email,
        name=user.name,
        hashed_password=hashed_password,
        is_active=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def authenticate_user(db: Session, email: str, password: str):
    """Authenticate a user with email and password"""
    user = get_user_by_email(db, email=email)
    if not user:
        return False
    if not pwd_context.verify(password, user.hashed_password):
        return False
    return user

# --------------------------
# Patient CRUD Operations
# --------------------------


def create_patient(db: Session, patient: schemas.PatientCreate, creator_id: int):
    """Create a new patient record"""
    db_patient = models.Patient(
        **patient.dict(),
        creator_id=creator_id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(db_patient)
    db.commit()
    db.refresh(db_patient)
    return db_patient


def get_patients(db: Session, skip: int = 0, limit: int = 100):
    """Get multiple patients with pagination"""
    return db.query(models.Patient).offset(skip).limit(limit).all()


def get_patient(db: Session, patient_id: int):
    """Get a single patient by ID"""
    return db.query(models.Patient).filter(models.Patient.id == patient_id).first()


def update_patient(db: Session, patient_id: int, patient: schemas.PatientCreate):
    """Update an existing patient record"""
    db_patient = db.query(models.Patient).filter(
        models.Patient.id == patient_id).first()
    if db_patient:
        for key, value in patient.dict().items():
            setattr(db_patient, key, value)
        db_patient.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(db_patient)
    return db_patient


def delete_patient(db: Session, patient_id: int):
    """Delete a patient record"""
    db_patient = db.query(models.Patient).filter(
        models.Patient.id == patient_id).first()
    if db_patient:
        db.delete(db_patient)
        db.commit()
    return db_patient

# --------------------------
# Medical Record Operations
# --------------------------


def create_patient_record(db: Session, record: schemas.RecordCreate, patient_id: int):
    """Create a new medical record for a patient"""
    db_record = models.MedicalRecord(
        **record.dict(),
        patient_id=patient_id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    return db_record


def get_patient_records(db: Session, patient_id: int):
    """Get all medical records for a specific patient"""
    return db.query(models.MedicalRecord).filter(
        models.MedicalRecord.patient_id == patient_id).all()
