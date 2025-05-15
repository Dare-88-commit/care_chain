from passlib.context import CryptContext
from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Text, DateTime
from sqlalchemy.orm import relationship
from .database import Base
from datetime import datetime

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


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

    # Relationships
    patients = relationship("Patient", back_populates="creator")
    appointments = relationship("Appointment", back_populates="doctor")

    def verify_password(self, plain_password: str):
        return pwd_context.verify(plain_password, self.hashed_password)


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    fullName = Column(String(100), nullable=False)
    age = Column(Integer, nullable=False)
    gender = Column(String(10))
    blood_type = Column(String(5))
    condition = Column(Text, nullable=False)
    allergies = Column(Text)  # Critical field for allergies
    qr_code = Column(String(255))
    last_sync = Column(DateTime)  # For offline sync tracking
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow,
                        onupdate=datetime.utcnow)

    # Foreign key relationship
    creator_id = Column(Integer, ForeignKey("users.id"))
    creator = relationship("User", back_populates="patients")

    records = relationship("MedicalRecord", back_populates="patient")
    appointments = relationship("Appointment", back_populates="patient")


class MedicalRecord(Base):
    __tablename__ = "medical_records"

    id = Column(Integer, primary_key=True, index=True)
    diagnosis = Column(Text, nullable=False)
    treatment = Column(Text)
    notes = Column(Text)
    symptoms = Column(Text)
    severity = Column(String(20))  # critical, urgent, normal, etc.
    # Critical flag for medical records
    is_critical = Column(Boolean, default=False)
    symptom_flags = Column(String(100))  # Stores risk warnings
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow,
                        onupdate=datetime.utcnow)

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

    patient_id = Column(Integer, ForeignKey("patients.id"))
    patient = relationship("Patient", back_populates="appointments")

    doctor_id = Column(Integer, ForeignKey("users.id"))
    doctor = relationship("User", back_populates="appointments")
