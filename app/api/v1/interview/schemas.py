"""
Interview API Pydantic Schemas.
"""
from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

from app.core.constants import InterviewType, InterviewMode, DifficultyLevel


# ============ Request Schemas ============

class StartInterviewRequest(BaseModel):
    """Request to start a new interview session."""
    interview_type: InterviewType = Field(..., description="Type of interview")
    mode: InterviewMode = Field(default=InterviewMode.TEXT, description="Input mode")
    difficulty: DifficultyLevel = Field(default=DifficultyLevel.MEDIUM, description="Difficulty level")
    target_role: Optional[str] = Field(None, max_length=100, description="Target job role")
    target_company: Optional[str] = Field(None, max_length=100, description="Target company")


class SubmitAnswerRequest(BaseModel):
    """Request to submit an answer."""
    answer_text: str = Field(..., min_length=1, max_length=5000, description="Answer text")


# ============ Response Schemas ============

class InterviewQuestionResponse(BaseModel):
    """Response with a single question."""
    session_id: str
    question_number: int
    question_text: str
    is_last_question: bool = False
    questions_remaining: int


class AnswerEvaluationResponse(BaseModel):
    """Response after submitting an answer."""
    evaluation: Dict[str, Any] = Field(..., description="Evaluation scores and feedback")
    next_question: Optional[str] = None
    question_number: Optional[int] = None
    is_complete: bool = False
    questions_remaining: int = 0


class ConversationItemResponse(BaseModel):
    """Single Q&A item in conversation."""
    question_number: int
    question: str
    answer: Optional[str] = None
    evaluation: Optional[Dict[str, Any]] = None
    asked_at: Optional[str] = None
    answered_at: Optional[str] = None


class InterviewSessionResponse(BaseModel):
    """Full interview session response."""
    id: str
    interview_type: str
    mode: str
    difficulty: str
    status: str
    target_role: Optional[str] = None
    target_company: Optional[str] = None
    conversation: List[ConversationItemResponse] = []
    overall_score: float = 0
    technical_score: Optional[float] = None
    communication_score: Optional[float] = None
    confidence_score: Optional[float] = None
    feedback_summary: Optional[str] = None
    improvement_areas: Optional[List[str]] = None
    started_at: datetime
    ended_at: Optional[datetime] = None
    is_complete: bool = False
    
    class Config:
        from_attributes = True


class InterviewSessionSummary(BaseModel):
    """Summary for list view."""
    id: str
    interview_type: str
    mode: str
    difficulty: str
    status: str
    target_role: Optional[str] = None
    overall_score: float = 0
    questions_answered: int = 0
    started_at: datetime
    ended_at: Optional[datetime] = None
    is_complete: bool = False


class InterviewHistoryResponse(BaseModel):
    """Paginated history response."""
    sessions: List[InterviewSessionSummary]
    total: int
    page: int
    page_size: int
    total_pages: int


class InterviewStatsResponse(BaseModel):
    """User interview statistics."""
    completed_interviews: int = 0
    average_score: float = 0
    best_score: float = 0


class InterviewAnswerItem(BaseModel):
    """Per-question interview answer review."""
    id: str
    question_number: int
    question_text: str
    answer_text: str
    overall_score: float = 0
    relevance_score: float = 0
    clarity_score: float = 0
    depth_score: float = 0
    confidence_score: float = 0
    feedback: Optional[str] = None
    strengths: Optional[List[str]] = None
    improvements: Optional[List[str]] = None
    answered_at: datetime


class InterviewAnswerListResponse(BaseModel):
    """List of answers for a session."""
    session_id: str
    answers: List[InterviewAnswerItem]


# ============ Helper Functions ============

def session_to_response(session) -> InterviewSessionResponse:
    """Convert InterviewSession model to response."""
    conversation = []
    if session.conversation:
        for qa in session.conversation:
            conversation.append(ConversationItemResponse(
                question_number=qa.get("question_number", 0),
                question=qa.get("question", ""),
                answer=qa.get("answer"),
                evaluation=qa.get("evaluation"),
                asked_at=qa.get("asked_at"),
                answered_at=qa.get("answered_at"),
            ))
    
    mode_value = getattr(session.mode, "value", session.mode) or "TEXT"
    difficulty_value = getattr(session.difficulty, "value", session.difficulty) or "MEDIUM"
    status_value = getattr(session.status, "value", session.status) or ("COMPLETED" if session.ended_at else "IN_PROGRESS")
    return InterviewSessionResponse(
        id=session.id,
        interview_type=session.interview_type.value,
        mode=mode_value,
        difficulty=difficulty_value,
        status=status_value,
        target_role=session.target_role,
        target_company=session.target_company,
        conversation=conversation,
        overall_score=session.overall_score or 0,
        technical_score=session.technical_score,
        communication_score=session.communication_score,
        confidence_score=session.confidence_score,
        feedback_summary=session.feedback_summary,
        improvement_areas=session.improvement_areas,
        started_at=session.started_at,
        ended_at=session.ended_at,
        is_complete=status_value == "COMPLETED",
    )


def session_to_summary(session) -> InterviewSessionSummary:
    """Convert InterviewSession model to summary."""
    questions_answered = 0
    if session.conversation:
        questions_answered = sum(1 for qa in session.conversation if qa.get("answer"))
    
    mode_value = getattr(session.mode, "value", session.mode) or "TEXT"
    difficulty_value = getattr(session.difficulty, "value", session.difficulty) or "MEDIUM"
    status_value = getattr(session.status, "value", session.status) or ("COMPLETED" if session.ended_at else "IN_PROGRESS")
    return InterviewSessionSummary(
        id=session.id,
        interview_type=session.interview_type.value,
        mode=mode_value,
        difficulty=difficulty_value,
        status=status_value,
        target_role=session.target_role,
        overall_score=session.overall_score or 0,
        questions_answered=questions_answered,
        started_at=session.started_at,
        ended_at=session.ended_at,
        is_complete=status_value == "COMPLETED",
    )
