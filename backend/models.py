from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Text, DateTime, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base
import enum

# Enums


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    DOCTOR = "doctor"
    NURSE = "nurse"


class SeverityLevel(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AppointmentStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

# Models


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.NURSE)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow,
                        onupdate=datetime.utcnow)

    # Relationships
    patients = relationship("Patient", back_populates="creator")
    appointments = relationship("Appointment", back_populates="doctor")
    access_logs = relationship("AccessLog", back_populates="user")


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(100), nullable=False)
    age = Column(Integer, nullable=False)
    gender = Column(String(10))
    blood_type = Column(String(5))
    condition = Column(Text, nullable=False)
    allergies = Column(Text)
    symptoms = Column(Text)
    symptom_flags = Column(String(200))
    is_critical = Column(Boolean, default=False)
    qr_token = Column(String(36))  # UUID
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow,
                        onupdate=datetime.utcnow)

    # Foreign keys
    creator_id = Column(Integer, ForeignKey("users.id"))

    # Relationships
    creator = relationship("User", back_populates="patients")
    records = relationship(
        "MedicalRecord", back_populates="patient", cascade="all, delete-orphan")
    appointments = relationship(
        "Appointment", back_populates="patient", cascade="all, delete-orphan")
    access_logs = relationship(
        "AccessLog", back_populates="patient", cascade="all, delete-orphan")


class MedicalRecord(Base):
    __tablename__ = "medical_records"

    id = Column(Integer, primary_key=True, index=True)
    diagnosis = Column(Text, nullable=False)
    treatment = Column(Text)
    notes = Column(Text)
    symptoms = Column(Text)
    severity = Column(Enum(SeverityLevel), default=SeverityLevel.LOW)
    is_critical = Column(Boolean, default=False)
    symptom_flags = Column(String(200))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow,
                        onupdate=datetime.utcnow)

    # Foreign keys
    patient_id = Column(Integer, ForeignKey("patients.id"))

    # Relationships
    patient = relationship("Patient", back_populates="records")


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    date_time = Column(DateTime, nullable=False)
    purpose = Column(Text)
    status = Column(Enum(AppointmentStatus),
                    default=AppointmentStatus.SCHEDULED)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow,
                        onupdate=datetime.utcnow)

    # Foreign keys
    patient_id = Column(Integer, ForeignKey("patients.id"))
    doctor_id = Column(Integer, ForeignKey("users.id"))

    # Relationships
    patient = relationship("Patient", back_populates="appointments")
    doctor = relationship("User", back_populates="appointments")


class AccessLog(Base):
    __tablename__ = "access_logs"

    id = Column(Integer, primary_key=True, index=True)
    action = Column(String(10), nullable=False)  # "view", "edit", "delete"
    ip_address = Column(String(45))  # IPv6 max length
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    # Foreign keys
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)

    # Relationships
    user = relationship("User", back_populates="access_logs")
    patient = relationship("Patient", back_populates="access_logs")
