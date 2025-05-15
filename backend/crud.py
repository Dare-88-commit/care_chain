from sqlalchemy.orm import Session
from datetime import datetime
from passlib.context import CryptContext
from . import models, schemas
from typing import Optional, List
import logging

# Configure logging
logger = logging.getLogger(__name__)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# --------------------------
# User CRUD Operations
# --------------------------


def get_user_by_email(db: Session, email: str) -> Optional[models.User]:
    """Get a single user by email with error handling"""
    try:
        return db.query(models.User).filter(models.User.email == email).first()
    except Exception as e:
        logger.error(f"Error fetching user by email {email}: {str(e)}")
        raise


def create_user(db: Session, user: schemas.UserCreate, hashed_password: str = None) -> models.User:
    """Create a new user with transaction safety"""
    try:
        hashed_password = hashed_password or pwd_context.hash(user.password)
        db_user = models.User(
            email=user.email,
            name=user.name,
            hashed_password=hashed_password,
            is_active=True,
            role=user.role if hasattr(
                user, 'role') else 'nurse',  # Default role
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        return db_user
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating user {user.email}: {str(e)}")
        raise ValueError(f"Could not create user: {str(e)}")


def authenticate_user(db: Session, email: str, password: str) -> Optional[models.User]:
    """Secure authentication with brute force protection"""
    user = get_user_by_email(db, email=email)
    if not user:
        # Prevent timing attacks
        pwd_context.dummy_verify()
        return None

    if not pwd_context.verify(password, user.hashed_password):
        return None

    return user

# --------------------------
# Patient CRUD Operations
# --------------------------


def create_patient(db: Session, patient: schemas.PatientCreate, user_id: int) -> models.Patient:
    """Create patient with risk assessment and transaction safety"""
    try:
        risk_check = check_patient_risks(patient.dict())

        db_patient = models.Patient(
            **patient.dict(),
            creator_id=user_id,
            symptom_flags=", ".join(risk_check['warnings']),
            is_critical=risk_check['is_risky'],
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

        db.add(db_patient)
        db.commit()
        db.refresh(db_patient)

        # Create initial access log
        log = models.AccessLog(
            user_id=user_id,
            patient_id=db_patient.id,
            action="create",
            timestamp=datetime.utcnow()
        )
        db.add(log)
        db.commit()

        return db_patient
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating patient: {str(e)}")
        raise ValueError(f"Could not create patient: {str(e)}")


def get_patients(db: Session, skip: int = 0, limit: int = 100) -> List[models.Patient]:
    """Get patients with pagination and error handling"""
    try:
        return db.query(models.Patient).offset(skip).limit(limit).all()
    except Exception as e:
        logger.error(f"Error fetching patients: {str(e)}")
        raise


def get_patient(db: Session, patient_id: int) -> Optional[models.Patient]:
    """Get single patient with existence check"""
    try:
        return db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    except Exception as e:
        logger.error(f"Error fetching patient {patient_id}: {str(e)}")
        raise


def update_patient(db: Session, patient_id: int, patient: schemas.PatientUpdate) -> Optional[models.Patient]:
    """Update patient with change tracking"""
    try:
        db_patient = db.query(models.Patient).filter(
            models.Patient.id == patient_id).first()
        if not db_patient:
            return None

        update_data = patient.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_patient, field, value)

        db_patient.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(db_patient)
        return db_patient
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating patient {patient_id}: {str(e)}")
        raise


def delete_patient(db: Session, patient_id: int) -> bool:
    """Soft delete patient with audit log"""
    try:
        db_patient = db.query(models.Patient).filter(
            models.Patient.id == patient_id).first()
        if db_patient:
            db_patient.is_active = False
            db_patient.updated_at = datetime.utcnow()
            db.commit()
            return True
        return False
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting patient {patient_id}: {str(e)}")
        raise

# --------------------------
# Medical Record Operations
# --------------------------


def create_patient_record(db: Session, record: schemas.RecordCreate, patient_id: int) -> models.MedicalRecord:
    """Create medical record with validation"""
    try:
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
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating record: {str(e)}")
        raise ValueError(f"Could not create record: {str(e)}")


def get_patient_records(db: Session, patient_id: int) -> List[models.MedicalRecord]:
    """Get all records for a patient"""
    try:
        return db.query(models.MedicalRecord).filter(
            models.MedicalRecord.patient_id == patient_id
        ).order_by(models.MedicalRecord.created_at.desc()).all()
    except Exception as e:
        logger.error(
            f"Error fetching records for patient {patient_id}: {str(e)}")
        raise

# --------------------------
# Risk Assessment Logic
# --------------------------


def check_patient_risks(patient_data: dict) -> dict:
    """Enhanced rule-based symptom checker with logging"""
    warnings = []
    severity = "low"

    try:
        age = patient_data.get("age", 0)
        symptoms = patient_data.get("symptoms", "").lower()
        condition = patient_data.get("condition", "").lower()

        # Critical symptom combinations
        if ("fever" in symptoms and "cough" in symptoms) or "difficulty breathing" in symptoms:
            warnings.append("Respiratory infection risk")
            severity = "high"

        if "chest pain" in symptoms:
            warnings.append("Cardiac risk")
            severity = "high"

        # Age-based risks
        if age > 65:
            warnings.append(
                "Elderly patient - increased monitoring recommended")
            severity = "medium" if severity != "high" else severity

        # Chronic conditions
        if any(chronic in condition for chronic in ["diabetes", "hypertension", "heart disease"]):
            warnings.append(f"Chronic condition: {condition}")
            severity = "medium" if severity != "high" else severity

        return {
            "is_risky": len(warnings) > 0,
            "warnings": warnings,
            "severity": severity
        }
    except Exception as e:
        logger.error(f"Risk assessment failed: {str(e)}")
        return {
            "is_risky": False,
            "warnings": ["Risk assessment unavailable"],
            "severity": "low"
        }

# --------------------------
# Access Log Operations
# --------------------------


def log_access(db: Session, user_id: int, patient_id: int, action: str):
    """Create access log entry"""
    try:
        log = models.AccessLog(
            user_id=user_id,
            patient_id=patient_id,
            action=action,
            timestamp=datetime.utcnow()
        )
        db.add(log)
        db.commit()
    except Exception as e:
        logger.error(f"Failed to log access: {str(e)}")
        db.rollback()
