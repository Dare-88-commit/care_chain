from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from . import models, schemas
from typing import Optional, List, Dict
import logging
from passlib.context import CryptContext
from fastapi import HTTPException, status
import re

# Configure logging
logger = logging.getLogger(__name__)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# --------------------------
# User CRUD Operations
# --------------------------


def get_user(db: Session, user_id: int) -> Optional[models.User]:
    """Get a single user by ID with error handling."""
    try:
        return db.query(models.User).filter(models.User.id == user_id).first()
    except Exception as e:
        logger.error(f"Error fetching user by ID {user_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred"
        )


def get_user_by_email(db: Session, email: str) -> Optional[models.User]:
    """Get a single user by email with validation."""
    try:
        if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
            raise ValueError("Invalid email format")
        return db.query(models.User).filter(models.User.email == email.lower()).first()
    except Exception as e:
        logger.error(f"Error fetching user by email {email}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


def create_user(db: Session, user: schemas.UserCreate, hashed_password: str) -> models.User:
    """Create a new user with transaction safety and validation."""
    try:
        if get_user_by_email(db, user.email):
            raise ValueError("Email already registered")

        db_user = models.User(
            email=user.email.lower(),
            name=user.name,
            hashed_password=hashed_password,
            role=user.role if hasattr(user, 'role') else models.UserRole.NURSE,
            is_active=True,
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
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


def authenticate_user(db: Session, email: str, password: str) -> Optional[models.User]:
    """Authenticate user credentials securely with rate limiting."""
    try:
        user = get_user_by_email(db, email=email)
        if not user or not user.is_active:
            return None

        # Check if account is locked
        if user.account_locked_until and user.account_locked_until > datetime.utcnow():
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail="Account temporarily locked"
            )

        if not pwd_context.verify(password, user.hashed_password):
            # Increment failed attempts
            user.failed_login_attempts += 1
            if user.failed_login_attempts >= 5:
                user.account_locked_until = datetime.utcnow() + timedelta(minutes=30)
            db.commit()
            return None

        # Reset failed attempts on successful login
        user.failed_login_attempts = 0
        user.last_login = datetime.utcnow()
        db.commit()
        return user
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Authentication error for {email}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication failed"
        )

# --------------------------
# Patient CRUD Operations
# --------------------------


def create_patient(db: Session, patient: schemas.PatientCreate, user_id: int) -> models.Patient:
    """Create a new patient record with validation."""
    try:
        # Convert warnings list to string if needed
        warnings = ", ".join(patient.warnings) if isinstance(
            patient.warnings, list) else patient.warnings or ""

        # Create patient with all fields
        db_patient = models.Patient(
            full_name=patient.full_name,
            age=patient.age,
            gender=patient.gender,
            blood_type=patient.blood_type,
            condition=patient.condition,
            severity=patient.severity,
            warnings=warnings,
            allergies=patient.allergies or "",
            symptoms=patient.symptoms or "",
            emergency_contact=getattr(patient, 'emergency_contact', ""),
            insurance_info=getattr(patient, 'insurance_info', ""),
            creator_id=user_id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

        # Risk assessment
        risk_data = check_patient_risks({
            "age": patient.age,
            "symptoms": patient.symptoms or "",
            "condition": patient.condition,
            "allergies": patient.allergies or ""
        })
        if risk_data["is_risky"]:
            db_patient.is_critical = risk_data["severity"] in [
                "high", "critical"]
            db_patient.warnings = ", ".join(risk_data["warnings"])

        db.add(db_patient)
        db.commit()
        db.refresh(db_patient)
        return db_patient
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to create patient: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create patient: {str(e)}"
        )


def get_patients(db: Session, skip: int = 0, limit: int = 100, filters: Dict = None) -> List[models.Patient]:
    """Get patients with pagination and filtering."""
    try:
        query = db.query(models.Patient).filter(
            models.Patient.is_active == True)

        # Apply filters if provided
        if filters:
            if 'name' in filters:
                query = query.filter(
                    models.Patient.full_name.ilike(f"%{filters['name']}%"))
            if 'condition' in filters:
                query = query.filter(models.Patient.condition.ilike(
                    f"%{filters['condition']}%"))
            if 'severity' in filters:
                query = query.filter(
                    models.Patient.severity == filters['severity'])

        return query.offset(skip).limit(min(limit, 1000)).all()
    except Exception as e:
        logger.error(f"Error fetching patients: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch patients"
        )


def get_patient(db: Session, patient_id: int) -> Optional[models.Patient]:
    """Get single patient by ID with validation."""
    try:
        patient = db.query(models.Patient).filter(
            models.Patient.id == patient_id,
            models.Patient.is_active == True
        ).first()
        if not patient:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Patient not found"
            )
        return patient
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching patient {patient_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch patient"
        )


def update_patient(db: Session, patient_id: int, patient: schemas.PatientUpdate) -> models.Patient:
    """Update patient details with validation."""
    try:
        db_patient = get_patient(db, patient_id)
        if not db_patient:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Patient not found"
            )

        update_data = patient.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_patient, field, value)

        db_patient.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(db_patient)
        return db_patient
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating patient {patient_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to update patient: {str(e)}"
        )


def delete_patient(db: Session, patient_id: int) -> bool:
    """Soft delete patient record with validation."""
    try:
        db_patient = get_patient(db, patient_id)
        if not db_patient:
            return False

        db_patient.is_active = False
        db_patient.updated_at = datetime.utcnow()
        db.commit()
        return True
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting patient {patient_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete patient: {str(e)}"
        )

# --------------------------
# Medical Record Operations
# --------------------------


def create_patient_record(db: Session, record: schemas.RecordCreate, patient_id: int, doctor_id: int) -> models.MedicalRecord:
    """Create a medical record entry with validation."""
    try:
        # Verify patient exists
        if not get_patient(db, patient_id):
            raise ValueError("Patient does not exist")

        db_record = models.MedicalRecord(
            **record.dict(),
            patient_id=patient_id,
            doctor_id=doctor_id,
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
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not create record: {str(e)}"
        )


def get_patient_records(db: Session, patient_id: int) -> List[models.MedicalRecord]:
    """Get all medical records for a patient with validation."""
    try:
        if not get_patient(db, patient_id):
            raise ValueError("Patient does not exist")

        return db.query(models.MedicalRecord).filter(
            models.MedicalRecord.patient_id == patient_id
        ).order_by(models.MedicalRecord.created_at.desc()).all()
    except Exception as e:
        logger.error(
            f"Error fetching records for patient {patient_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch records: {str(e)}"
        )

# --------------------------
# Risk Assessment Logic
# --------------------------


def check_patient_risks(patient_data: dict) -> dict:
    """Enhanced rule-based risk assessment."""
    warnings = []
    severity = "low"

    try:
        age = patient_data.get("age", 0)
        symptoms = (patient_data.get("symptoms", "") or "").lower()
        condition = (patient_data.get("condition", "") or "").lower()
        allergies = (patient_data.get("allergies", "") or "").lower()

        # Respiratory risks
        respiratory_keywords = ["fever", "cough",
                                "shortness of breath", "difficulty breathing"]
        if any(keyword in symptoms for keyword in respiratory_keywords):
            warnings.append("Respiratory infection risk")
            severity = "high" if "difficulty breathing" in symptoms else "medium"

        # Cardiac risks
        if "chest pain" in symptoms:
            warnings.append("Cardiac risk - urgent evaluation needed")
            severity = "high"

        # Allergy risks
        allergy_risks = ["penicillin", "latex", "peanuts", "shellfish"]
        if any(allergy in allergies for allergy in allergy_risks):
            warnings.append(f"Allergy risk: {allergies}")
            severity = "high" if severity != "high" else severity

        # Age-related risks
        if age > 65:
            warnings.append(
                "Elderly patient - increased monitoring recommended")
            severity = "medium" if severity != "high" else severity
        elif age < 5:
            warnings.append("Pediatric patient - special care needed")
            severity = "medium" if severity != "high" else severity

        # Chronic conditions
        chronic_conditions = ["diabetes", "hypertension",
                              "heart disease", "copd", "asthma"]
        if any(condition in condition for condition in chronic_conditions):
            warnings.append(f"Chronic condition: {condition}")
            severity = "high" if condition in [
                "heart disease", "copd"] else "medium"

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


def log_access(db: Session, user_id: int, patient_id: int, action: str, request: dict = None):
    """Create detailed access log entry."""
    try:
        log_data = {
            "user_id": user_id,
            "patient_id": patient_id,
            "action": action.upper(),
            "timestamp": datetime.utcnow()
        }

        if request:
            log_data.update({
                "ip_address": request.get("client_host", ""),
                "user_agent": request.get("headers", {}).get("user-agent", ""),
                "endpoint": request.get("path", "")
            })

        log = models.AccessLog(**log_data)
        db.add(log)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to log access: {str(e)}")
