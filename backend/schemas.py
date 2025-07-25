from pydantic import BaseModel, Field, validator, EmailStr, conint, constr
from typing import Optional, List, Literal
from datetime import datetime
from enum import Enum
from .models import Gender
import re

# --------------------------
# Password Validation Helper
# --------------------------


def validate_password(password: str) -> str:
    """Enhanced password validation with regex"""
    if len(password) < 10:
        raise ValueError("Password must be at least 10 characters")
    if not re.search(r"[A-Z]", password):
        raise ValueError("Password must contain at least one uppercase letter")
    if not re.search(r"[a-z]", password):
        raise ValueError("Password must contain at least one lowercase letter")
    if not re.search(r"\d", password):
        raise ValueError("Password must contain at least one digit")
    if not re.search(r"[@$!%*?&#]", password):
        raise ValueError(
            "Password must contain at least one special character (@$!%*?&#)")
    if re.search(r"(.)\1{2,}", password):
        raise ValueError(
            "Password cannot contain repeating characters (aaa, 111 etc.)")
    return password

# --------------------------
# Enums for Type Safety
# --------------------------


class UserRole(str, Enum):
    ADMIN = "admin"
    DOCTOR = "doctor"
    NURSE = "nurse"
    STAFF = "staff"


class BloodType(str, Enum):
    A_POS = "A+"
    A_NEG = "A-"
    B_POS = "B+"
    B_NEG = "B-"
    AB_POS = "AB+"
    AB_NEG = "AB-"
    O_POS = "O+"
    O_NEG = "O-"
    UNKNOWN = "unknown"


class SeverityLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"
    EMERGENCY = "emergency"


class AppointmentStatus(str, Enum):
    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    RESCHEDULED = "rescheduled"
    NO_SHOW = "no_show"

# --------------------------
# Authentication Schemas
# --------------------------


class Token(BaseModel):
    access_token: str
    token_type: str
    expires_in: int


class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None


class UserBase(BaseModel):
    email: EmailStr = Field(..., example="user@carechain.org", max_length=255)
    role: UserRole = Field(default=UserRole.NURSE)


class UserCreate(UserBase):
    name: constr(strip_whitespace=True, min_length=2,
                 max_length=50) = Field(..., example="Dr. Jane Doe")
    password: str = Field(..., min_length=10,
                          max_length=128, example="SecurePass123!#")
    confirm_password: str = Field(..., example="SecurePass123!#")

    @validator('name')
    def validate_name(cls, v):
        if not re.match(r"^[a-zA-Z\s\-'.]+$", v):
            raise ValueError(
                "Name must contain only letters, spaces, hyphens, apostrophes and periods")
        return v.strip().title()

    @validator('password')
    def validate_password_complexity(cls, v):
        return validate_password(v)

    @validator('confirm_password')
    def passwords_match(cls, v, values):
        if 'password' in values and v != values['password']:
            raise ValueError("Passwords do not match")
        return v


class UserLogin(BaseModel):
    email: EmailStr = Field(..., example="user@carechain.org")
    password: str = Field(..., example="SecurePass123!#")


class UserResponse(UserBase):
    id: int
    name: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    last_login: Optional[datetime]

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": 1,
                "email": "doctor@carechain.org",
                "name": "Dr. Smith",
                "role": "doctor",
                "is_active": True,
                "created_at": "2023-01-01T00:00:00",
                "updated_at": "2023-01-01T00:00:00"
            }
        }


User = UserResponse

# --------------------------
# Patient Management Schemas
# --------------------------


class PatientBase(BaseModel):
    full_name: constr(strip_whitespace=True, min_length=2,
                      max_length=100) = Field(..., example="John Smith")
    age: conint(gt=0, lt=120) = Field(..., example=35)
    gender: Gender = Field(..., example="male")  # Changed here
    blood_type: Optional[BloodType] = Field(None, example="A+")
    condition: constr(min_length=3, max_length=500) = Field(...,
                                                            example="Hypertension")
    severity: SeverityLevel = Field(default=SeverityLevel.MEDIUM)
    warnings: List[constr(max_length=100)] = Field(
        [], example=["Allergy to penicillin"])


class PatientCreate(PatientBase):
    allergies: Optional[constr(max_length=500)] = None
    symptoms: Optional[constr(max_length=1000)] = None
    emergency_contact: Optional[constr(max_length=100)] = None
    insurance_info: Optional[constr(max_length=100)] = None

    @validator('full_name')
    def validate_full_name(cls, v):
        if any(char.isdigit() for char in v):
            raise ValueError("Name cannot contain numbers")
        if not re.match(r"^[a-zA-Z\s\-'.]+$", v):
            raise ValueError("Name contains invalid characters")
        return v.strip().title()

    @validator('warnings')
    def validate_warnings(cls, v):
        return [w.strip() for w in v if w.strip()]


class PatientUpdate(BaseModel):
    full_name: Optional[constr(
        strip_whitespace=True, min_length=2, max_length=100)] = None
    age: Optional[conint(gt=0, lt=120)] = None
    gender: Optional[Literal["male", "female", "other", "unknown"]] = None
    blood_type: Optional[BloodType] = None
    condition: Optional[constr(min_length=3, max_length=500)] = None
    severity: Optional[SeverityLevel] = None
    warnings: Optional[List[constr(max_length=100)]] = None
    allergies: Optional[constr(max_length=500)] = None
    symptoms: Optional[constr(max_length=1000)] = None
    emergency_contact: Optional[constr(max_length=100)] = None
    insurance_info: Optional[constr(max_length=100)] = None


class PatientResponse(PatientBase):
    id: int
    creator_id: int
    is_critical: bool
    created_at: datetime
    updated_at: datetime
    allergies: Optional[str]
    symptoms: Optional[str]
    emergency_contact: Optional[str]
    insurance_info: Optional[str]

    @validator("warnings", pre=True)
    def parse_warnings(cls, v):
        if isinstance(v, str):
            if v.strip() == "":
                return []
            return [w.strip() for w in v.split(",") if w.strip()]
        return v

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": 1,
                "full_name": "John Smith",
                "age": 35,
                "gender": "male",
                "blood_type": "A+",
                "condition": "Hypertension",
                "severity": "medium",
                "warnings": ["Allergy to penicillin"],
                "is_critical": False,
                "created_at": "2023-01-01T00:00:00",
                "updated_at": "2023-01-01T00:00:00"
            }
        }


Patient = PatientResponse

# --------------------------
# Medical Records Schemas
# --------------------------


class RecordBase(BaseModel):
    diagnosis: constr(min_length=3, max_length=500) = Field(...,
                                                            example="Stage 2 Hypertension")
    treatment: Optional[constr(max_length=1000)] = Field(
        None, example="Lisinopril 10mg daily")
    notes: Optional[constr(max_length=2000)] = Field(
        None, example="Patient reports occasional dizziness")
    symptoms: Optional[constr(max_length=1000)] = Field(
        None, example="Headache, Fatigue")
    severity: SeverityLevel = Field(default=SeverityLevel.MEDIUM)
    prescription: Optional[constr(max_length=1000)] = None


class RecordCreate(RecordBase):
    patient_id: int = Field(..., example=1)


class RecordUpdate(BaseModel):
    diagnosis: Optional[constr(min_length=3, max_length=500)] = None
    treatment: Optional[constr(max_length=1000)] = None
    notes: Optional[constr(max_length=2000)] = None
    symptoms: Optional[constr(max_length=1000)] = None
    severity: Optional[SeverityLevel] = None
    prescription: Optional[constr(max_length=1000)] = None


class RecordResponse(RecordBase):
    id: int
    patient_id: int
    doctor_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# --------------------------
# Appointment Schemas
# --------------------------


class AppointmentBase(BaseModel):
    date_time: datetime = Field(..., example="2023-06-15T14:30:00")
    purpose: Optional[constr(max_length=500)] = Field(
        None, example="Follow-up")
    status: AppointmentStatus = Field(default=AppointmentStatus.SCHEDULED)
    notes: Optional[constr(max_length=2000)] = None
    duration_minutes: conint(gt=0, le=240) = Field(30, example=30)


class AppointmentCreate(AppointmentBase):
    patient_id: int = Field(..., example=1)
    doctor_id: int = Field(..., example=2)


class AppointmentUpdate(BaseModel):
    date_time: Optional[datetime] = None
    purpose: Optional[constr(max_length=500)] = None
    status: Optional[AppointmentStatus] = None
    notes: Optional[constr(max_length=2000)] = None
    duration_minutes: Optional[conint(gt=0, le=240)] = None


class AppointmentResponse(AppointmentBase):
    id: int
    patient_id: int
    doctor_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# --------------------------
# QR Code & Sync Schemas
# --------------------------


class QRCodeData(BaseModel):
    patient_id: int
    token: str
    exp: datetime
    access_level: Literal["read", "write"] = "read"


class PatientSync(BaseModel):
    id: Optional[int]
    full_name: str
    age: int
    gender: Optional[str]
    condition: str
    allergies: Optional[str]
    symptoms: Optional[str]
    updated_at: datetime
    sync_token: str

# --------------------------
# Response Wrappers
# --------------------------


class PatientWithRecords(PatientResponse):
    records: List[RecordResponse] = []
    appointments: List[AppointmentResponse] = []


class UserWithPatients(UserResponse):
    patients: List[PatientResponse] = []


class ErrorResponse(BaseModel):
    detail: str = Field(..., example="Error message")
    code: Optional[str] = Field(None, example="invalid_input")
    field: Optional[str] = Field(None, example="password")


class SuccessResponse(BaseModel):
    message: str = Field(..., example="Operation successful")
    data: Optional[dict] = None


class PaginatedResponse(BaseModel):
    items: List
    total: int
    page: int
    pages: int

# --------------------------
# System Health Schemas
# --------------------------


class HealthCheck(BaseModel):
    status: str
    database: bool
    cache: bool
    storage: bool
    version: str
    timestamp: datetime
