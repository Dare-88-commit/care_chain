from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Text, DateTime, Enum, JSON
from sqlalchemy.orm import relationship, validates
from datetime import datetime
from .database import Base
import enum
import re
from uuid import uuid4

# Enums


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    DOCTOR = "doctor"
    NURSE = "nurse"
    STAFF = "staff"


class BloodType(str, enum.Enum):
    A_POS = "A+"
    A_NEG = "A-"
    B_POS = "B+"
    B_NEG = "B-"
    AB_POS = "AB+"
    AB_NEG = "AB-"
    O_POS = "O+"
    O_NEG = "O-"
    UNKNOWN = "unknown"


class SeverityLevel(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"
    EMERGENCY = "emergency"


class AppointmentStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    RESCHEDULED = "rescheduled"
    NO_SHOW = "no_show"


class Gender(str, enum.Enum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"
    UNKNOWN = "unknown"

# Models


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole, native_enum=False, length=20),
                  default=UserRole.NURSE, nullable=False)
    is_active = Column(Boolean, default=True)
    last_login = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow,
                        onupdate=datetime.utcnow)
    failed_login_attempts = Column(Integer, default=0)
    account_locked_until = Column(DateTime, nullable=True)

    # Relationships
    patients = relationship("Patient", back_populates="creator")
    appointments = relationship("Appointment", back_populates="doctor")
    access_logs = relationship("AccessLog", back_populates="user")
    records_created = relationship("MedicalRecord", back_populates="doctor")

    @validates('email')
    def validate_email(self, key, email):
        if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
            raise ValueError("Invalid email format")
        return email.lower()

    @validates('name')
    def validate_name(self, key, name):
        if len(name) < 2 or len(name) > 100:
            raise ValueError("Name must be between 2-100 characters")
        if not re.match(r"^[a-zA-Z\s\-'.]+$", name):
            raise ValueError("Name contains invalid characters")
        return name.strip().title()


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(100), nullable=False)
    age = Column(Integer, nullable=False)
    gender = Column(Enum(Gender, native_enum=False, length=10),
                    default=Gender.UNKNOWN)
    blood_type = Column(Enum(BloodType, native_enum=False, length=7),
                        nullable=True)
    condition = Column(Text, nullable=False)
    severity = Column(Enum(SeverityLevel, native_enum=False, length=20),
                      default=SeverityLevel.MEDIUM)
    warnings = Column(JSON)  # Store as JSON array
    allergies = Column(Text)
    symptoms = Column(Text)
    emergency_contact = Column(String(100))
    insurance_info = Column(String(100))
    is_critical = Column(Boolean, default=False)
    qr_token = Column(String(36), unique=True)  # UUID
    qr_token_expires = Column(DateTime)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow,
                        onupdate=datetime.utcnow)

    # Foreign keys
    creator_id = Column(Integer, ForeignKey(
        "users.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    creator = relationship("User", back_populates="patients")
    records = relationship("MedicalRecord", back_populates="patient",
                           cascade="all, delete-orphan")
    appointments = relationship("Appointment", back_populates="patient",
                                cascade="all, delete-orphan")
    access_logs = relationship("AccessLog", back_populates="patient",
                               cascade="all, delete-orphan")

    @validates('full_name')
    def validate_full_name(self, key, full_name):
        if len(full_name) < 2 or len(full_name) > 100:
            raise ValueError("Full name must be between 2-100 characters")
        if any(char.isdigit() for char in full_name):
            raise ValueError("Name cannot contain numbers")
        return full_name.strip().title()

    @validates('age')
    def validate_age(self, key, age):
        if age < 0 or age > 120:
            raise ValueError("Age must be between 0-120")
        return age

    def generate_qr_token(self):
        self.qr_token = str(uuid4())
        self.qr_token_expires = datetime.utcnow() + timedelta(minutes=15)


class MedicalRecord(Base):
    __tablename__ = "medical_records"

    id = Column(Integer, primary_key=True, index=True)
    diagnosis = Column(Text, nullable=False)
    treatment = Column(Text)
    notes = Column(Text)
    symptoms = Column(Text)
    severity = Column(Enum(SeverityLevel, native_enum=False, length=20),
                      default=SeverityLevel.MEDIUM)
    prescription = Column(Text)
    is_critical = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow,
                        onupdate=datetime.utcnow)

    # Foreign keys
    patient_id = Column(Integer, ForeignKey(
        "patients.id", ondelete="CASCADE"), nullable=False)
    doctor_id = Column(Integer, ForeignKey(
        "users.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    patient = relationship("Patient", back_populates="records")
    doctor = relationship("User", back_populates="records_created")

    @validates('diagnosis')
    def validate_diagnosis(self, key, diagnosis):
        if len(diagnosis) < 3:
            raise ValueError("Diagnosis must be at least 3 characters")
        return diagnosis


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    date_time = Column(DateTime, nullable=False)
    purpose = Column(String(500))
    status = Column(Enum(AppointmentStatus, native_enum=False, length=20),
                    default=AppointmentStatus.SCHEDULED)
    notes = Column(Text)
    duration_minutes = Column(Integer, default=30)  # in minutes
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow,
                        onupdate=datetime.utcnow)

    # Foreign keys
    patient_id = Column(Integer, ForeignKey(
        "patients.id", ondelete="CASCADE"), nullable=False)
    doctor_id = Column(Integer, ForeignKey(
        "users.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    patient = relationship("Patient", back_populates="appointments")
    doctor = relationship("User", back_populates="appointments")

    @validates('date_time')
    def validate_date_time(self, key, date_time):
        if date_time < datetime.utcnow():
            raise ValueError("Appointment cannot be in the past")
        return date_time

    @validates('duration_minutes')
    def validate_duration(self, key, duration):
        if duration < 5 or duration > 240:
            raise ValueError("Duration must be between 5-240 minutes")
        return duration


class AccessLog(Base):
    __tablename__ = "access_logs"

    id = Column(Integer, primary_key=True, index=True)
    # "GET", "POST", "PUT", "DELETE"
    action = Column(String(10), nullable=False)
    endpoint = Column(String(100))
    ip_address = Column(String(45))  # IPv6 max length
    user_agent = Column(Text)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    # Foreign keys
    user_id = Column(Integer, ForeignKey(
        "users.id", ondelete="CASCADE"), nullable=False)
    patient_id = Column(Integer, ForeignKey(
        "patients.id", ondelete="CASCADE"), nullable=False)

    # Relationships
    user = relationship("User", back_populates="access_logs")
    patient = relationship("Patient", back_populates="access_logs")

    @validates('action')
    def validate_action(self, key, action):
        valid_actions = ["GET", "POST", "PUT", "DELETE", "PATCH"]
        if action.upper() not in valid_actions:
            raise ValueError(f"Invalid action. Must be one of {valid_actions}")
        return action.upper()
