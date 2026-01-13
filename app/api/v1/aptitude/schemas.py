"""
Pydantic schemas for Aptitude Question API.
"""
from datetime import datetime
from typing import Optional, List, Dict

from pydantic import BaseModel, Field, field_validator

from app.core.constants import AptitudeCategory, DifficultyLevel


# Request Schemas
class QuestionCreate(BaseModel):
    """Schema for creating a new question."""
    question_text: str = Field(..., min_length=10, max_length=2000)
    options: Dict[str, str] = Field(..., description="Options A, B, C, D")
    correct_option: str = Field(..., pattern="^[A-Da-d]$")
    category: AptitudeCategory
    difficulty: DifficultyLevel
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
    difficulty: Optional[DifficultyLevel] = None
    explanation: Optional[str] = Field(None, max_length=1000)


class BulkUploadRequest(BaseModel):
    """Schema for bulk upload via CSV content."""
    csv_content: str = Field(..., min_length=50)


# Response Schemas
class QuestionResponse(BaseModel):
    """Schema for question response."""
    id: str
    question_text: str
    options: Dict[str, str]
    correct_option: str
    category: str
    difficulty: str
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
            difficulty=question.difficulty.value,
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
