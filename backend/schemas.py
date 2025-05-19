from pydantic import BaseModel, Field, validator, EmailStr, conint
from typing import Optional, List, Literal
from datetime import datetime
from enum import Enum

# --------------------------
# Password Validation Helper
# --------------------------


def validate_password(password: str) -> str:
    """Manual password validation"""
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters")
    if not any(c.isupper() for c in password):
        raise ValueError("Password must contain at least one uppercase letter")
    if not any(c.islower() for c in password):
        raise ValueError("Password must contain at least one lowercase letter")
    if not any(c.isdigit() for c in password):
        raise ValueError("Password must contain at least one digit")
    if not any(c in "@$!%*?&" for c in password):
        raise ValueError(
            "Password must contain at least one special character (@$!%*?&)")
    return password

# --------------------------
# Enums for Type Safety
# --------------------------


class UserRole(str, Enum):
    ADMIN = "admin"
    DOCTOR = "doctor"
    NURSE = "nurse"


class BloodType(str, Enum):
    A_POS = "A+"
    A_NEG = "A-"
    B_POS = "B+"
    B_NEG = "B-"
    AB_POS = "AB+"
    AB_NEG = "AB-"
    O_POS = "O+"
    O_NEG = "O-"


class SeverityLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AppointmentStatus(str, Enum):
    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

# --------------------------
# Authentication Schemas
# --------------------------


class UserBase(BaseModel):
    email: EmailStr = Field(..., example="user@carechain.org")
    role: UserRole = Field(default=UserRole.NURSE)


class UserCreate(UserBase):
    name: str = Field(..., min_length=2, max_length=50, example="Dr. Jane Doe")
    password: str = Field(..., min_length=8, max_length=64,
                          example="SecurePass123!")
    confirm_password: str = Field(..., example="SecurePass123!")

    @validator('name')
    def validate_name(cls, v):
        if not v.replace(" ", "").isalpha():
            raise ValueError("Name must contain only letters and spaces")
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
    password: str = Field(..., example="SecurePass123!")


class UserResponse(UserBase):
    id: int
    name: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": 1,
                "email": "user@carechain.org",
                "name": "Dr. Jane Doe",
                "role": "doctor",
                "is_active": True,
                "created_at": "2023-01-01T00:00:00",
                "updated_at": "2023-01-01T00:00:00"
            }
        }


# Alias for backward compatibility
User = UserResponse

# --------------------------
# Patient Management Schemas
# --------------------------


class PatientBase(BaseModel):
    full_name: str = Field(..., min_length=2,
                           max_length=100, example="John Smith")
    age: conint(gt=0, lt=120) = Field(..., example=35)
    gender: Literal["male", "female"] = Field(..., example="male")
    blood_type: Optional[BloodType] = Field(None, example="A+")
    condition: str = Field(..., min_length=3,
                           max_length=500, example="Hypertension")
    severity: SeverityLevel = Field(default=SeverityLevel.MEDIUM)
    warnings: List[str] = Field([], example=["Allergy to penicillin"])


class PatientCreate(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    age: int = Field(..., gt=0, lt=120)
    gender: Literal["male", "female", "other"] = "male"
    condition: str = Field(..., min_length=3)
    severity: Literal["low", "medium", "high", "critical"] = "medium"
    warnings: List[str] = Field([])
    allergies: Optional[str] = None
    symptoms: Optional[str] = None


class PatientUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=100)
    age: Optional[conint(gt=0, lt=120)]
    gender: Optional[Literal["male", "female", "other"]]
    blood_type: Optional[BloodType]
    condition: Optional[str] = Field(None, min_length=3, max_length=500)
    severity: Optional[SeverityLevel]
    warnings: Optional[List[str]]
    allergies: Optional[str] = Field(None, max_length=500)
    symptoms: Optional[str] = Field(None, max_length=1000)


class PatientResponse(PatientBase):
    id: int
    creator_id: int
    symptom_flags: Optional[str]
    is_critical: bool
    created_at: datetime
    updated_at: datetime
    @validator("warnings", pre=True)
    def parse_warnings(cls, v):
        if isinstance(v, str):
            if v.strip() == "":
                return []
            return [w.strip() for w in v.split(",")]
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
                "symptom_flags": "High blood pressure",
                "is_critical": False,
                "created_at": "2023-01-01T00:00:00",
                "updated_at": "2023-01-01T00:00:00"
            }
        }


# Alias for backward compatibility
Patient = PatientResponse

# --------------------------
# Medical Records Schemas
# --------------------------


class RecordBase(BaseModel):
    diagnosis: str = Field(..., min_length=3, max_length=500,
                           example="Stage 2 Hypertension")
    treatment: Optional[str] = Field(
        None, max_length=1000, example="Lisinopril 10mg daily")
    notes: Optional[str] = Field(
        None, max_length=2000, example="Patient reports occasional dizziness")
    symptoms: Optional[str] = Field(
        None, max_length=1000, example="Headache, Fatigue")
    severity: SeverityLevel = Field(default=SeverityLevel.MEDIUM)


class RecordCreate(RecordBase):
    patient_id: int = Field(..., example=1)


class RecordResponse(RecordBase):
    id: int
    patient_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# --------------------------
# Appointment Schemas
# --------------------------


class AppointmentBase(BaseModel):
    date_time: datetime = Field(..., example="2023-06-15T14:30:00")
    purpose: Optional[str] = Field(None, max_length=500, example="Follow-up")
    status: AppointmentStatus = Field(default=AppointmentStatus.SCHEDULED)
    notes: Optional[str] = Field(None, max_length=2000)


class AppointmentCreate(AppointmentBase):
    patient_id: int = Field(..., example=1)
    doctor_id: int = Field(..., example=2)


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


class PatientSync(BaseModel):
    id: Optional[int]
    full_name: str
    age: int
    gender: Optional[str]
    condition: str
    allergies: Optional[str]
    symptoms: Optional[str]
    updated_at: datetime

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


class SuccessResponse(BaseModel):
    message: str = Field(..., example="Operation successful")


class PatientCreate(BaseModel):
    full_name: str = Field(..., min_length=2,
                           max_length=100, example="John Smith")
    age: conint(gt=0, lt=120) = Field(..., example=35)
    gender: Literal["male", "female", "other"] = Field(..., example="male")
    condition: str = Field(..., min_length=3, max_length=500, example="Fever")
    severity: Literal["low", "medium", "high"] = Field(
        "medium", example="medium")
    warnings: List[str] = Field([], example=["None"])

    @validator('full_name')
    def validate_full_name(cls, v):
        if any(char.isdigit() for char in v):
            raise ValueError("Name cannot contain numbers")
        return v.strip().title()
