"""
Pydantic schemas for Student Aptitude Attempt API.
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

from app.core.constants import AptitudeCategory, DifficultyLevel, AptitudeMode, AttemptStatus


# Request Schemas
class StartAssessmentRequest(BaseModel):
    """Request to start a new assessment."""
    category: Optional[AptitudeCategory] = None
    count: int = Field(10, ge=5, le=50)
    difficulty: Optional[DifficultyLevel] = None
    mode: AptitudeMode = AptitudeMode.PRACTICE
    resume_question_count: Optional[int] = Field(None, ge=0, le=50)


class SubmitAssessmentRequest(BaseModel):
    """Request to submit assessment answers."""
    user_answers: Dict[str, Optional[str]] # question_id -> selected_option (A, B, C, D or None)
    time_taken_seconds: int = Field(..., ge=0)


class AutoSaveAssessmentRequest(BaseModel):
    """Autosave partial answers during an attempt."""
    user_answers: Dict[str, Optional[str]]


# Response Schemas
class QuestionBrief(BaseModel):
    """Brief question info for the test runner (no correct answer)."""
    id: str
    question_text: str
    options: Dict[str, str]
    category: str
    difficulty: str
    sub_topic: Optional[str] = None
    marks: int = 1
    time_limit_seconds: Optional[int] = None

    class Config:
        from_attributes = True


class AssessmentStartResponse(BaseModel):
    """Response when a test is initialized."""
    attempt_id: str
    questions: List[QuestionBrief]
    total_questions: int
    started_at: datetime
    mode: AptitudeMode
    category: Optional[str] = None
    difficulty: Optional[str] = None


class ActiveAssessmentResponse(BaseModel):
    """Response for resuming an active assessment."""
    attempt_id: str
    questions: List[QuestionBrief]
    total_questions: int
    started_at: datetime
    mode: AptitudeMode
    category: Optional[str] = None
    difficulty: Optional[str] = None
    user_answers: Dict[str, Optional[str]]


class AttemptResponse(BaseModel):
    """Brief attempt info for lists."""
    id: str
    category: Optional[str]
    total_questions: int
    correct_answers: int = 0
    wrong_answers: int = 0
    skipped: int = 0
    score: float
    time_taken_seconds: int = 0
    completed_at: Optional[datetime]
    started_at: datetime

    class Config:
        from_attributes = True


class DetailedAnswer(BaseModel):
    """Detailed answer info for review."""
    id: str
    question_text: str
    options: Dict[str, str]
    correct_option: str
    selected_option: Optional[str]
    is_correct: bool
    marks: Optional[int] = None
    explanation: Optional[str]
    category: str

    class Config:
        from_attributes = True


class AttemptDetailResponse(BaseModel):
    """Detailed attempt info with all answers."""
    id: str
    user_id: str
    category: Optional[str]
    total_questions: int
    correct_answers: int
    wrong_answers: int
    skipped: int
    score: float
    time_taken_seconds: int
    started_at: datetime
    completed_at: Optional[datetime]
    detailed_answers: List[DetailedAnswer]


class TopicAnalysisItem(BaseModel):
    """Topic-wise performance analysis item."""
    category: str
    correct: int
    total: int
    accuracy: float


class StudentAptitudeDashboard(BaseModel):
    """High-level dashboard data for students."""
    total_attempts: int
    average_score: float
    best_score: float
    topic_analysis: List[TopicAnalysisItem]
