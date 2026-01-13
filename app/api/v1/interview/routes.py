"""
Interview API Routes.
Endpoints for AI mock interview sessions.
"""
import os
import tempfile
from math import ceil
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db_session, CurrentStudent
from app.application.services.interview_service import InterviewService
from app.application.services.ai_service import get_ai_service
from app.core.constants import MAX_INTERVIEW_QUESTIONS
from .schemas import (
    StartInterviewRequest,
    SubmitAnswerRequest,
    InterviewQuestionResponse,
    AnswerEvaluationResponse,
    InterviewSessionResponse,
    InterviewHistoryResponse,
    InterviewStatsResponse,
    session_to_response,
    session_to_summary,
)


router = APIRouter()


# ============ Static Routes (must be defined BEFORE parameterized routes) ============

@router.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
):
    """
    Transcribe audio to text using Whisper.
    Works over HTTP - no HTTPS required.
    Public endpoint - no auth required.
    """
    ai_service = get_ai_service()
    
    # Validate file type
    allowed_types = ["audio/webm", "audio/wav", "audio/mp3", "audio/mpeg", "audio/ogg", "audio/m4a"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported audio format: {file.content_type}"
        )
    
    # Save to temp file
    try:
        suffix = ".webm" if "webm" in file.content_type else ".wav"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name
        
        # Transcribe
        text = await ai_service.transcribe_audio(tmp_path)
        
        # Cleanup
        os.unlink(tmp_path)
        
        return {"text": text, "success": True}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Transcription failed: {str(e)}"
        )

@router.post("/start", response_model=InterviewQuestionResponse)
async def start_interview(
    request: StartInterviewRequest,
    user: CurrentStudent,
    db: AsyncSession = Depends(get_db_session),
):
    """
    Start a new mock interview session.
    
    Returns the first interview question.
    """
    service = InterviewService(db)
    
    try:
        session, first_question = await service.start_interview(
            user_id=user.id,
            interview_type=request.interview_type,
            difficulty=request.difficulty,
            target_role=request.target_role,
            target_company=request.target_company,
        )
        
        return InterviewQuestionResponse(
            session_id=session.id,
            question_number=1,
            question_text=first_question,
            is_last_question=MAX_INTERVIEW_QUESTIONS == 1,
            questions_remaining=MAX_INTERVIEW_QUESTIONS - 1,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start interview: {str(e)}"
        )


@router.get("/history", response_model=InterviewHistoryResponse)
async def get_interview_history(
    user: CurrentStudent,
    db: AsyncSession = Depends(get_db_session),
    page: int = 1,
    page_size: int = 10,
):
    """Get paginated list of past interview sessions."""
    service = InterviewService(db)
    
    if page < 1:
        page = 1
    if page_size < 1 or page_size > 50:
        page_size = 10
    
    sessions, total = await service.list_sessions(
        user_id=user.id,
        page=page,
        page_size=page_size,
    )
    
    return InterviewHistoryResponse(
        sessions=[session_to_summary(s) for s in sessions],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=ceil(total / page_size) if total > 0 else 0,
    )


@router.get("/stats", response_model=InterviewStatsResponse)
async def get_interview_stats(
    user: CurrentStudent,
    db: AsyncSession = Depends(get_db_session),
):
    """Get interview statistics for the current user."""
    service = InterviewService(db)
    
    stats = await service.get_user_stats(user.id)
    
    return InterviewStatsResponse(
        completed_interviews=stats.get("completed_interviews", 0),
        average_score=stats.get("average_score", 0),
        best_score=stats.get("best_score", 0),
    )


# ============ Parameterized Routes ============

@router.post("/{session_id}/answer", response_model=AnswerEvaluationResponse)
async def submit_answer(
    session_id: str,
    request: SubmitAnswerRequest,
    user: CurrentStudent,
    db: AsyncSession = Depends(get_db_session),
):
    """
    Submit an answer to the current question.
    
    Returns evaluation and next question (if not complete).
    """
    service = InterviewService(db)
    
    try:
        result = await service.submit_answer(
            user_id=user.id,
            session_id=session_id,
            answer_text=request.answer_text,
        )
        
        return AnswerEvaluationResponse(
            evaluation=result["evaluation"],
            next_question=result.get("next_question"),
            question_number=result.get("question_number"),
            is_complete=result.get("is_complete", False),
            questions_remaining=result.get("questions_remaining", 0),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process answer: {str(e)}"
        )


@router.post("/{session_id}/complete", response_model=InterviewSessionResponse)
async def complete_interview(
    session_id: str,
    user: CurrentStudent,
    db: AsyncSession = Depends(get_db_session),
):
    """
    Complete an interview session early or get final results.
    
    Generates comprehensive feedback and scores.
    """
    service = InterviewService(db)
    
    try:
        session = await service.complete_interview(
            user_id=user.id,
            session_id=session_id,
        )
        
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Interview session not found"
            )
        
        return session_to_response(session)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to complete interview: {str(e)}"
        )


@router.get("/{session_id}", response_model=InterviewSessionResponse)
async def get_interview_session(
    session_id: str,
    user: CurrentStudent,
    db: AsyncSession = Depends(get_db_session),
):
    """Get details of a specific interview session."""
    service = InterviewService(db)
    
    session = await service.get_session(
        user_id=user.id,
        session_id=session_id,
    )
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interview session not found"
        )
    
    return session_to_response(session)
