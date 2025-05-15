from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime

# --------------------------
# Authentication Schemas
# --------------------------


class UserBase(BaseModel):
    email: str


class UserCreate(UserBase):
    name: str
    password: str


class UserLogin(BaseModel):
    email: str
    password: str


class UserResponse(UserBase):
    id: int
    name: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True  # For Pydantic v2
        # orm_mode = True  # Uncomment if using Pydantic v1


# Alias for backward compatibility
User = UserResponse


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    email: Optional[str] = None

# --------------------------
# Patient Management Schemas
# --------------------------


class PatientBase(BaseModel):
    full_name: str  # Renamed to match snake_case naming convention
    age: int
    gender: Optional[str] = None
    blood_type: Optional[str] = None
    condition: str


class PatientCreate(PatientBase):
    allergies: Optional[str] = None

    @validator('condition')
    def check_condition(cls, v):
        if len(v) < 3:
            raise ValueError("Condition too short")
        return v.title()

    @validator('full_name')
    def validate_full_name(cls, v):
        if len(v) < 2:
            raise ValueError("Full name must be at least 2 characters")
        return v.title()


class PatientResponse(PatientBase):
    id: int
    qr_code: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    creator_id: int

    class Config:
        from_attributes = True


# Alias for compatibility
Patient = PatientResponse

# --------------------------
# Medical Records Schemas
# --------------------------


class RecordBase(BaseModel):
    diagnosis: str
    treatment: Optional[str] = None
    notes: Optional[str] = None
    symptoms: Optional[str] = None
    severity: Optional[str] = "normal"


class RecordCreate(RecordBase):
    patient_id: int


class RecordResponse(RecordBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


Record = RecordResponse

# --------------------------
# Appointment Schemas
# --------------------------


class AppointmentBase(BaseModel):
    date_time: datetime
    purpose: Optional[str] = None
    status: Optional[str] = "scheduled"
    notes: Optional[str] = None


class AppointmentCreate(AppointmentBase):
    patient_id: int
    doctor_id: int


class AppointmentResponse(AppointmentBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


Appointment = AppointmentResponse

# --------------------------
# Combined Response Schemas
# --------------------------


class PatientWithRecords(PatientResponse):
    records: List[RecordResponse] = []
    appointments: List[AppointmentResponse] = []


class UserWithPatients(UserResponse):
    patients: List[PatientResponse] = []

# --------------------------
# New RiskCheckResponse Schema
# --------------------------


class RiskCheckResponse(BaseModel):
    is_risky: bool
    warnings: List[str]
    severity: str = "normal"  # Added default severity

    @validator('severity')
    def validate_severity(cls, v):
        allowed_severities = ["normal", "urgent", "critical"]
        if v not in allowed_severities:
            raise ValueError(
                f"Severity must be one of {', '.join(allowed_severities)}")
        return v
