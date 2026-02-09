"""
API routes for Student Aptitude assessments.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.session import get_db_session
from app.dependencies import get_current_user
from app.infrastructure.database.models import User
from app.application.services.aptitude_attempt_service import AptitudeAttemptService
from app.core.constants import UserRole
from app.api.v1.aptitude.attempt_schemas import (
    StartAssessmentRequest,
    SubmitAssessmentRequest,
    AutoSaveAssessmentRequest,
    AssessmentStartResponse,
    ActiveAssessmentResponse,
    QuestionBrief,
    AttemptResponse,
    AttemptDetailResponse,
    StudentAptitudeDashboard
)

router = APIRouter(prefix="/student/aptitude", tags=["Student Aptitude"])


@router.post("/start", response_model=AssessmentStartResponse)
async def start_assessment(
    data: StartAssessmentRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """Start a new aptitude assessment session."""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Students only")
        
    service = AptitudeAttemptService(db)
    try:
        attempt, questions = await service.start_assessment(
            user_id=current_user.id,
            category=data.category,
            count=data.count,
            difficulty=data.difficulty,
            mode=data.mode,
            resume_question_count=data.resume_question_count,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    
    return AssessmentStartResponse(
        attempt_id=attempt.id,
        questions=questions,
        total_questions=len(questions),
        started_at=attempt.started_at,
        mode=attempt.mode,
        category=attempt.category.value if attempt.category else None,
        difficulty=attempt.difficulty.value if attempt.difficulty else None,
    )


@router.get("/active", response_model=ActiveAssessmentResponse)
async def get_active_assessment(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """Resume an active assessment if one exists."""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Students only")

    service = AptitudeAttemptService(db)
    try:
        attempt, questions, user_answers = await service.get_active_attempt(current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail=str(e))

    if not attempt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active attempt")

    return ActiveAssessmentResponse(
        attempt_id=attempt.id,
        questions=questions,
        total_questions=len(questions),
        started_at=attempt.started_at,
        mode=attempt.mode,
        category=attempt.category.value if attempt.category else None,
        difficulty=attempt.difficulty.value if attempt.difficulty else None,
        user_answers=user_answers,
    )


@router.post("/submit/{attempt_id}", response_model=AttemptResponse)
async def submit_assessment(
    attempt_id: str,
    data: SubmitAssessmentRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """Submit assessment answers and get score."""
    service = AptitudeAttemptService(db)
    try:
        attempt = await service.submit_assessment(
            attempt_id=attempt_id,
            user_id=current_user.id,
            user_answers=data.user_answers,
            time_taken_seconds=data.time_taken_seconds
        )
        return AttemptResponse.model_validate(attempt)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/autosave/{attempt_id}")
async def autosave_assessment(
    attempt_id: str,
    data: AutoSaveAssessmentRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """Autosave partial answers."""
    service = AptitudeAttemptService(db)
    try:
        await service.autosave_answers(
            attempt_id=attempt_id,
            user_id=current_user.id,
            user_answers=data.user_answers,
        )
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/attempts", response_model=List[AttemptResponse])
async def list_my_attempts(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """List student's past attempts."""
    service = AptitudeAttemptService(db)
    attempts = await service.get_test_history(current_user.id)
    return [AttemptResponse.model_validate(a) for a in attempts]


@router.get("/attempts/{attempt_id}", response_model=AttemptDetailResponse)
async def get_attempt_detail(
    attempt_id: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """Get detailed results of a specific attempt."""
    service = AptitudeAttemptService(db)
    details = await service.get_attempt_details(attempt_id, current_user.id)
    
    if not details:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attempt not found")
        
    attempt = details["attempt"]
    return AttemptDetailResponse(
        id=attempt.id,
        user_id=attempt.user_id,
        category=attempt.category.value if attempt.category else "Mixed",
        total_questions=attempt.total_questions,
        correct_answers=attempt.correct_answers,
        wrong_answers=attempt.wrong_answers,
        skipped=attempt.skipped,
        score=attempt.score,
        time_taken_seconds=attempt.time_taken_seconds,
        started_at=attempt.started_at,
        completed_at=attempt.completed_at,
        detailed_answers=details["detailed_answers"]
    )


@router.delete("/attempts/{attempt_id}")
async def discard_attempt(
    attempt_id: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """Discard an active attempt."""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Students only")
    service = AptitudeAttemptService(db)
    try:
        await service.discard_attempt(attempt_id, current_user.id)
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/dashboard", response_model=StudentAptitudeDashboard)
async def get_student_dashboard(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """Get student aptitude performance overview."""
    service = AptitudeAttemptService(db)
    stats_data = await service.get_student_dashboard_stats(current_user.id)
    
    return StudentAptitudeDashboard(
        total_attempts=stats_data["stats"]["total_attempts"],
        average_score=stats_data["stats"]["average_score"],
        best_score=stats_data["stats"]["best_score"],
        topic_analysis=stats_data["topic_analysis"]
    )
