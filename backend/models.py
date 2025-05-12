from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Text, DateTime
from sqlalchemy.orm import relationship
from .database import Base
from datetime import datetime


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow,
                        onupdate=datetime.utcnow)

    # Relationship to patients (if users can have associated patients)
    patients = relationship("Patient", back_populates="creator")


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    # Changed from 'name' to match frontend
    fullName = Column(String(100), nullable=False)
    age = Column(Integer, nullable=False)
    gender = Column(String(10))  # Added gender field
    blood_type = Column(String(5))  # Added blood type
    condition = Column(Text, nullable=False)
    qr_code = Column(String(255))  # For storing QR code data
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow,
                        onupdate=datetime.utcnow)

    # Relationship to user who created this patient
    creator_id = Column(Integer, ForeignKey("users.id"))
    creator = relationship("User", back_populates="patients")

    # Relationship to medical records
    records = relationship("MedicalRecord", back_populates="patient")


class MedicalRecord(Base):
    __tablename__ = "medical_records"

    id = Column(Integer, primary_key=True, index=True)
    diagnosis = Column(Text, nullable=False)
    treatment = Column(Text)
    notes = Column(Text)
    symptoms = Column(Text)  # For AI symptom analysis
    severity = Column(String(20))  # critical, urgent, normal, etc.
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow,
                        onupdate=datetime.utcnow)

    # Relationship to patient
    patient_id = Column(Integer, ForeignKey("patients.id"))
    patient = relationship("Patient", back_populates="records")


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    date_time = Column(DateTime, nullable=False)
    purpose = Column(Text)
    # scheduled, completed, cancelled
    status = Column(String(20), default="scheduled")
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow,
                        onupdate=datetime.utcnow)

    # Relationships
    patient_id = Column(Integer, ForeignKey("patients.id"))
    patient = relationship("Patient")

    doctor_id = Column(Integer, ForeignKey("users.id"))
    doctor = relationship("User")
