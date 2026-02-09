"""
Pydantic schemas for Aptitude Question API.
"""
from datetime import datetime
from typing import Optional, List, Dict, Any

from pydantic import BaseModel, Field, field_validator

from app.core.constants import AptitudeCategory, DifficultyLevel, QuestionStatus


# Request Schemas
class QuestionCreate(BaseModel):
    """Schema for creating a new question."""
    question_text: str = Field(..., min_length=10, max_length=2000)
    options: Dict[str, str] = Field(..., description="Options A, B, C, D")
    correct_option: str = Field(..., pattern="^[A-Da-d]$")
    category: AptitudeCategory
    sub_topic: Optional[str] = Field(None, max_length=100)
    difficulty: DifficultyLevel
    marks: int = Field(1, ge=1, le=10)
    time_limit_seconds: Optional[int] = Field(None, ge=10, le=3600)
    status: QuestionStatus = QuestionStatus.ACTIVE
    role_tag: Optional[str] = Field(None, max_length=100)
    explanation: Optional[str] = Field(None, max_length=1000)
    
    @field_validator("options")
    @classmethod
    def validate_options(cls, v):
        required = {"A", "B", "C", "D"}
        if set(v.keys()) != required:
            raise ValueError("Options must contain exactly A, B, C, D")
        for key, val in v.items():
            if not val or not val.strip():
                raise ValueError(f"Option {key} cannot be empty")
        return v
    
    @field_validator("correct_option")
    @classmethod
    def validate_correct(cls, v):
        return v.upper()


class QuestionUpdate(BaseModel):
    """Schema for updating a question."""
    question_text: Optional[str] = Field(None, min_length=10, max_length=2000)
    options: Optional[Dict[str, str]] = None
    correct_option: Optional[str] = Field(None, pattern="^[A-Da-d]$")
    category: Optional[AptitudeCategory] = None
    sub_topic: Optional[str] = Field(None, max_length=100)
    difficulty: Optional[DifficultyLevel] = None
    marks: Optional[int] = Field(None, ge=1, le=10)
    time_limit_seconds: Optional[int] = Field(None, ge=10, le=3600)
    status: Optional[QuestionStatus] = None
    role_tag: Optional[str] = Field(None, max_length=100)
    explanation: Optional[str] = Field(None, max_length=1000)


class BulkUploadRequest(BaseModel):
    """Schema for bulk upload via CSV content."""
    csv_content: str = Field(..., min_length=50)


class AIGenerateRequest(BaseModel):
    """Schema for AI generated questions."""
    count: int = Field(1, ge=1, le=10)
    category: AptitudeCategory
    difficulty: DifficultyLevel
    sub_topic: Optional[str] = Field(None, max_length=100)
    role_tag: Optional[str] = Field(None, max_length=100)
    marks: int = Field(1, ge=1, le=10)
    time_limit_seconds: Optional[int] = Field(None, ge=10, le=3600)
    status: QuestionStatus = QuestionStatus.DRAFT
    instructions: Optional[str] = Field(None, max_length=500)


# Response Schemas
class QuestionResponse(BaseModel):
    """Schema for question response."""
    id: str
    question_text: str
    options: Dict[str, str]
    correct_option: str
    category: str
    sub_topic: Optional[str]
    difficulty: str
    marks: int
    time_limit_seconds: Optional[int]
    status: str
    approval_status: str
    approved_by: Optional[str]
    approved_at: Optional[datetime]
    role_tag: Optional[str]
    version_number: int
    previous_version_id: Optional[str]
    explanation: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
    
    @classmethod
    def from_model(cls, question):
        return cls(
            id=question.id,
            question_text=question.question_text,
            options=question.options,
            correct_option=question.correct_option,
            category=question.category.value,
            sub_topic=question.sub_topic,
            difficulty=question.difficulty.value,
            marks=question.marks,
            time_limit_seconds=question.time_limit_seconds,
            status=getattr(question.status, "value", question.status),
            approval_status=getattr(question.approval_status, "value", question.approval_status),
            approved_by=question.approved_by,
            approved_at=question.approved_at,
            role_tag=question.role_tag,
            version_number=question.version_number,
            previous_version_id=question.previous_version_id,
            explanation=question.explanation,
            is_active=question.is_active,
            created_at=question.created_at,
            updated_at=question.updated_at,
        )


class QuestionListResponse(BaseModel):
    """Paginated list of questions."""
    questions: List[QuestionResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class BulkUploadResponse(BaseModel):
    """Response for bulk upload."""
    success: bool
    created_count: int
    errors: List[str]
    message: str


class QuestionStatsResponse(BaseModel):
    """Question statistics."""
    total: int
    by_category: Dict[str, int]
    by_difficulty: Dict[str, int]


class AIGenerateResponse(BaseModel):
    """Response for AI generated questions."""
    success: bool
    created_count: int
    errors: List[str]
    questions: List[QuestionResponse]


class QuestionVersionResponse(BaseModel):
    """Question version snapshot response."""
    id: str
    question_id: str
    version_number: int
    snapshot: Dict[str, Any]
    changed_by: Optional[str]
    change_reason: Optional[str]
    changed_at: datetime

    class Config:
        from_attributes = True


class QuestionVersionListResponse(BaseModel):
    versions: List[QuestionVersionResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class QuestionAuditLogResponse(BaseModel):
    """Audit log entry response."""
    id: str
    question_id: Optional[str]
    action: str
    actor_id: Optional[str]
    before_data: Optional[Dict[str, Any]]
    after_data: Optional[Dict[str, Any]]
    created_at: datetime

    class Config:
        from_attributes = True


class QuestionAuditLogListResponse(BaseModel):
    logs: List[QuestionAuditLogResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
