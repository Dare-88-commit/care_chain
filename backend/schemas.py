from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

# Remove all EmailStr usage to avoid email-validator dependency


class UserBase(BaseModel):
    email: str

    class Config:
        from_attributes = True  # Updated from orm_mode in Pydantic v2


class UserCreate(UserBase):
    name: str
    password: str


class UserLogin(BaseModel):
    email: str
    password: str


class User(UserBase):
    id: int
    name: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    email: Optional[str] = None


class PatientBase(BaseModel):
    fullName: str
    age: int
    gender: Optional[str] = None
    blood_type: Optional[str] = None
    condition: str


class PatientCreate(PatientBase):
    pass


class Patient(PatientBase):
    id: int
    qr_code: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    creator_id: int


class RecordBase(BaseModel):
    diagnosis: str
    treatment: Optional[str] = None
    notes: Optional[str] = None
    symptoms: Optional[str] = None
    severity: Optional[str] = "normal"


class RecordCreate(RecordBase):
    patient_id: int


class Record(RecordBase):
    id: int
    created_at: datetime
    updated_at: datetime


class AppointmentBase(BaseModel):
    date_time: datetime
    purpose: Optional[str] = None
    status: Optional[str] = "scheduled"
    notes: Optional[str] = None


class AppointmentCreate(AppointmentBase):
    patient_id: int
    doctor_id: int


class Appointment(AppointmentBase):
    id: int
    created_at: datetime
    updated_at: datetime


class PatientWithRecords(Patient):
    records: List[Record] = []
    appointments: List[Appointment] = []


class UserWithPatients(User):
    patients: List[Patient] = []
