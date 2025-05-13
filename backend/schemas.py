from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

# Authentication Schemas


class UserBase(BaseModel):
    email: str


class UserCreate(UserBase):
    name: str
    password: str


class UserLogin(BaseModel):
    email: str
    password: str

# Keep both names for compatibility


class UserResponse(UserBase):
    id: int
    name: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


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
    fullName: str
    age: int
    gender: Optional[str] = None
    blood_type: Optional[str] = None
    condition: str


class PatientCreate(PatientBase):
    pass


class PatientResponse(PatientBase):
    id: int
    qr_code: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    creator_id: int

    class Config:
        from_attributes = True

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

# --------------------------
# Combined Response Schemas
# --------------------------


class PatientWithRecords(PatientResponse):
    records: List[RecordResponse] = []
    appointments: List[AppointmentResponse] = []


class UserWithPatients(UserResponse):
    patients: List[PatientResponse] = []


# Backward compatibility aliases
Patient = PatientResponse
Record = RecordResponse
Appointment = AppointmentResponse
