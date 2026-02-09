"""
Pydantic schemas for Placement Drives API.
"""
from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field

from app.core.constants import (
    PlacementDriveStatus,
    ApplicationStatus,
    DifficultyLevel,
    DriveAssessmentStatus,
    DriveAssessmentStage,
    AptitudeMode,
)
from app.api.v1.aptitude.attempt_schemas import QuestionBrief, AttemptResponse


# Request Schemas
class DriveCreate(BaseModel):
    """Schema for creating a placement drive."""
    company_name: str = Field(..., min_length=2, max_length=255)
    job_title: str = Field(..., min_length=2, max_length=255)
    job_description: str = Field(..., min_length=10)
    registration_deadline: datetime
    drive_date: datetime
    company_logo_url: Optional[str] = None
    min_cgpa: Optional[float] = Field(None, ge=0, le=10)
    allowed_departments: Optional[List[str]] = None
    allowed_graduation_years: Optional[List[int]] = None
    package_lpa: Optional[float] = Field(None, ge=0)
    location: Optional[str] = None
    job_type: Optional[str] = Field(None, pattern="^(Full-time|Internship|Contract)$")
    max_applications: Optional[int] = Field(None, ge=1)
    aptitude_test_required: Optional[bool] = False
    aptitude_question_count: Optional[int] = Field(10, ge=5, le=50)
    aptitude_difficulty: Optional[DifficultyLevel] = None
    aptitude_pass_percentage: Optional[float] = Field(60.0, ge=0, le=100)
    technical_test_required: Optional[bool] = False
    technical_question_count: Optional[int] = Field(10, ge=5, le=50)
    technical_difficulty: Optional[DifficultyLevel] = None
    technical_pass_percentage: Optional[float] = Field(60.0, ge=0, le=100)


class DriveUpdate(BaseModel):
    """Schema for updating a placement drive."""
    company_name: Optional[str] = Field(None, min_length=2, max_length=255)
    job_title: Optional[str] = Field(None, min_length=2, max_length=255)
    job_description: Optional[str] = None
    registration_deadline: Optional[datetime] = None
    drive_date: Optional[datetime] = None
    company_logo_url: Optional[str] = None
    min_cgpa: Optional[float] = Field(None, ge=0, le=10)
    allowed_departments: Optional[List[str]] = None
    allowed_graduation_years: Optional[List[int]] = None
    package_lpa: Optional[float] = Field(None, ge=0)
    location: Optional[str] = None
    job_type: Optional[str] = None
    max_applications: Optional[int] = Field(None, ge=1)
    status: Optional[PlacementDriveStatus] = None
    aptitude_test_required: Optional[bool] = None
    aptitude_question_count: Optional[int] = Field(None, ge=5, le=50)
    aptitude_difficulty: Optional[DifficultyLevel] = None
    aptitude_pass_percentage: Optional[float] = Field(None, ge=0, le=100)
    technical_test_required: Optional[bool] = None
    technical_question_count: Optional[int] = Field(None, ge=5, le=50)
    technical_difficulty: Optional[DifficultyLevel] = None
    technical_pass_percentage: Optional[float] = Field(None, ge=0, le=100)


class ApplicationCreate(BaseModel):
    """Schema for applying to a drive."""
    resume_url: Optional[str] = None
    cover_letter: Optional[str] = Field(None, max_length=2000)


class ApplicationStatusUpdate(BaseModel):
    """Schema for updating application status."""
    status: ApplicationStatus
    status_notes: Optional[str] = Field(None, max_length=1000)


# Response Schemas
class DriveResponse(BaseModel):
    """Schema for drive response."""
    id: str
    company_name: str
    company_logo_url: Optional[str]
    job_title: str
    job_description: str
    min_cgpa: Optional[float]
    allowed_departments: Optional[List[str]]
    allowed_graduation_years: Optional[List[int]]
    package_lpa: Optional[float]
    location: Optional[str]
    job_type: Optional[str]
    registration_deadline: datetime
    drive_date: datetime
    status: str
    max_applications: Optional[int]
    application_count: int = 0
    created_at: datetime
    aptitude_test_required: bool = False
    aptitude_question_count: int = 10
    aptitude_difficulty: Optional[str] = None
    aptitude_pass_percentage: float = 60.0
    technical_test_required: bool = False
    technical_question_count: int = 10
    technical_difficulty: Optional[str] = None
    technical_pass_percentage: float = 60.0
    
    class Config:
        from_attributes = True
    
    @classmethod
    def from_model(cls, drive, app_count: int = 0):
        def enum_value(val):
            return val.value if hasattr(val, "value") else val

        return cls(
            id=drive.id,
            company_name=drive.company_name,
            company_logo_url=drive.company_logo_url,
            job_title=drive.job_title,
            job_description=drive.job_description,
            min_cgpa=drive.min_cgpa,
            allowed_departments=drive.allowed_departments or [],
            allowed_graduation_years=drive.allowed_graduation_years or [],
            package_lpa=drive.package_lpa,
            location=drive.location,
            job_type=drive.job_type,
            registration_deadline=drive.registration_deadline,
            drive_date=drive.drive_date,
            status=drive.status.value,
            max_applications=drive.max_applications,
            application_count=app_count if app_count else len(drive.applications) if 'applications' in drive.__dict__ else 0,
            created_at=drive.created_at,
            aptitude_test_required=bool(getattr(drive, "aptitude_test_required", False)),
            aptitude_question_count=getattr(drive, "aptitude_question_count", 10) or 10,
            aptitude_difficulty=enum_value(getattr(drive, "aptitude_difficulty", None)),
            aptitude_pass_percentage=getattr(drive, "aptitude_pass_percentage", 60.0)
            if getattr(drive, "aptitude_pass_percentage", None) is not None
            else 60.0,
            technical_test_required=bool(getattr(drive, "technical_test_required", False)),
            technical_question_count=getattr(drive, "technical_question_count", 10) or 10,
            technical_difficulty=enum_value(getattr(drive, "technical_difficulty", None)),
            technical_pass_percentage=getattr(drive, "technical_pass_percentage", 60.0)
            if getattr(drive, "technical_pass_percentage", None) is not None
            else 60.0,
        )


class DriveListResponse(BaseModel):
    """Paginated list of drives."""
    drives: List[DriveResponse]
    total: int
    page: int
    page_size: int


class ApplicantResponse(BaseModel):
    """Schema for applicant info."""
    id: str
    user_id: str
    user_name: str
    user_email: str
    user_phone: Optional[str] = None
    register_number: Optional[str] = None
    department: Optional[str] = None
    graduation_year: Optional[int] = None
    cgpa: Optional[float] = None
    resume_url: Optional[str]
    cover_letter: Optional[str]
    status: str
    status_notes: Optional[str]
    aptitude_status: Optional[str] = None
    aptitude_score: Optional[float] = None
    technical_status: Optional[str] = None
    technical_score: Optional[float] = None
    applied_at: datetime
    
    @classmethod
    def from_model(cls, app):
        profile = app.user.student_profile if app.user else None
        return cls(
            id=app.id,
            user_id=app.user_id,
            user_name=f"{app.user.first_name} {app.user.last_name}" if app.user else "Unknown",
            user_email=app.user.email if app.user else "",
            user_phone=app.user.phone if app.user else None,
            register_number=profile.register_number if profile else None,
            department=profile.department if profile else None,
            graduation_year=profile.graduation_year if profile else None,
            cgpa=profile.cgpa if profile else None,
            resume_url=app.resume_url,
            cover_letter=app.cover_letter,
            status=app.status.value,
            status_notes=app.status_notes,
            aptitude_status=app.aptitude_status.value if app.aptitude_status else DriveAssessmentStatus.NOT_STARTED.value,
            aptitude_score=app.aptitude_score,
            technical_status=app.technical_status.value if app.technical_status else DriveAssessmentStatus.NOT_STARTED.value,
            technical_score=app.technical_score,
            applied_at=app.applied_at,
        )


class MyApplicationResponse(BaseModel):
    """Schema for user's own application."""
    id: str
    drive_id: str
    company_name: str
    job_title: str
    status: str
    status_notes: Optional[str]
    applied_at: datetime
    drive_date: datetime
    aptitude_status: Optional[str] = None
    aptitude_score: Optional[float] = None
    technical_status: Optional[str] = None
    technical_score: Optional[float] = None
    aptitude_test_required: bool = False
    aptitude_question_count: int = 10
    aptitude_difficulty: Optional[str] = None
    aptitude_pass_percentage: float = 60.0
    technical_test_required: bool = False
    technical_question_count: int = 10
    technical_difficulty: Optional[str] = None
    technical_pass_percentage: float = 60.0
    
    @classmethod
    def from_model(cls, app):
        def enum_value(val):
            return val.value if hasattr(val, "value") else val

        return cls(
            id=app.id,
            drive_id=app.drive_id,
            company_name=app.drive.company_name if app.drive else "",
            job_title=app.drive.job_title if app.drive else "",
            status=app.status.value,
            status_notes=app.status_notes,
            applied_at=app.applied_at,
            drive_date=app.drive.drive_date if app.drive else app.applied_at,
            aptitude_status=app.aptitude_status.value if app.aptitude_status else DriveAssessmentStatus.NOT_STARTED.value,
            aptitude_score=app.aptitude_score,
            technical_status=app.technical_status.value if app.technical_status else DriveAssessmentStatus.NOT_STARTED.value,
            technical_score=app.technical_score,
            aptitude_test_required=getattr(app.drive, "aptitude_test_required", False) if app.drive else False,
            aptitude_question_count=getattr(app.drive, "aptitude_question_count", 10) if app.drive else 10,
            aptitude_difficulty=enum_value(getattr(app.drive, "aptitude_difficulty", None)) if app.drive else None,
            aptitude_pass_percentage=getattr(app.drive, "aptitude_pass_percentage", 60.0) if app.drive else 60.0,
            technical_test_required=getattr(app.drive, "technical_test_required", False) if app.drive else False,
            technical_question_count=getattr(app.drive, "technical_question_count", 10) if app.drive else 10,
            technical_difficulty=enum_value(getattr(app.drive, "technical_difficulty", None)) if app.drive else None,
            technical_pass_percentage=getattr(app.drive, "technical_pass_percentage", 60.0) if app.drive else 60.0,
        )


class DriveStatsResponse(BaseModel):
    """Drive statistics."""
    total: int
    by_status: dict


class DriveAssessmentStartResponse(BaseModel):
    """Response when a drive assessment is started."""
    attempt_id: str
    questions: List[QuestionBrief]
    total_questions: int
    started_at: datetime
    mode: AptitudeMode
    category: Optional[str] = None
    difficulty: Optional[str] = None
    stage: DriveAssessmentStage
    pass_percentage: float


class DriveAssessmentActiveResponse(BaseModel):
    """Response when resuming a drive assessment."""
    attempt_id: str
    questions: List[QuestionBrief]
    total_questions: int
    started_at: datetime
    mode: AptitudeMode
    category: Optional[str] = None
    difficulty: Optional[str] = None
    user_answers: dict
    stage: DriveAssessmentStage
    pass_percentage: float


class DriveAssessmentSubmitResponse(AttemptResponse):
    """Response when a drive assessment is submitted."""
    stage: DriveAssessmentStage
    passed: bool
    pass_percentage: float
