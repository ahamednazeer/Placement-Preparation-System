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
    InterviewAnswerListResponse,
    InterviewAnswerItem,
    session_to_response,
    session_to_summary,
)


router = APIRouter()


# ============ Static Routes (must be defined BEFORE parameterized routes) ============

@router.post("/transcribe")
async def transcribe_audio(
    user: CurrentStudent,
    file: UploadFile = File(...),
):
    """
    Transcribe audio to text using Whisper.
    Works over HTTP - no HTTPS required.
    Requires authentication.
    Accepts any audio format - converts to WAV for best accuracy.
    """
    import subprocess
    import logging
    logger = logging.getLogger(__name__)
    
    ai_service = get_ai_service()
    content = await file.read()
    logger.info(f"Transcribe request: filename={file.filename}, content_type={file.content_type}, size={len(content)} bytes")
    
    tmp_path = None
    wav_path = None
    
    try:
        # Determine input format
        content_type = file.content_type or ""
        if "webm" in content_type or "opus" in content_type:
            suffix = ".webm"
        elif "mp4" in content_type or "m4a" in content_type:
            suffix = ".m4a"
        elif "mpeg" in content_type or "mp3" in content_type:
            suffix = ".mp3"
        else:
            suffix = ".webm"  # Default to webm for unknown
        
        # Save original audio
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        
        # Convert to WAV for better Whisper accuracy (16kHz mono PCM)
        wav_path = tmp_path.replace(suffix, ".wav")
        try:
            result = subprocess.run([
                "ffmpeg", "-y", "-i", tmp_path,
                "-ar", "16000",     # 16kHz sample rate (optimal for Whisper)
                "-ac", "1",         # Mono
                "-c:a", "pcm_s16le", # 16-bit PCM
                wav_path
            ], capture_output=True, timeout=30)
            
            if result.returncode == 0:
                logger.info(f"Converted {suffix} to WAV successfully")
                transcribe_path = wav_path
            else:
                logger.warning(f"FFmpeg conversion failed: {result.stderr.decode()[:200]}, using original")
                transcribe_path = tmp_path
        except FileNotFoundError:
            logger.warning("FFmpeg not found, using original audio format")
            transcribe_path = tmp_path
        except subprocess.TimeoutExpired:
            logger.warning("FFmpeg conversion timed out, using original")
            transcribe_path = tmp_path
        
        # Transcribe
        text = await ai_service.transcribe_audio(transcribe_path)
        logger.info(f"Transcription result: '{text[:100] if text else '(empty)'}'")
        
        return {"text": text, "success": True}
        
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Transcription failed: {str(e)}"
        )
    finally:
        # Cleanup temp files
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
        if wav_path and os.path.exists(wav_path):
            os.unlink(wav_path)

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
            mode=request.mode,
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


@router.get("/{session_id}/answers", response_model=InterviewAnswerListResponse)
async def get_interview_answers(
    session_id: str,
    user: CurrentStudent,
    db: AsyncSession = Depends(get_db_session),
):
    """Get per-question interview answers for review."""
    service = InterviewService(db)
    try:
        answers = await service.get_answer_review(user_id=user.id, session_id=session_id)
        def scale(value):
            try:
                return round(float(value or 0) * 10, 1)
            except Exception:
                return 0.0
        return InterviewAnswerListResponse(
            session_id=session_id,
            answers=[
                InterviewAnswerItem(
                    id=a.id,
                    question_number=a.question_number,
                    question_text=a.question_text,
                    answer_text=a.answer_text,
                    overall_score=scale(a.overall_score),
                    relevance_score=scale(a.relevance_score),
                    clarity_score=scale(a.clarity_score),
                    depth_score=scale(a.depth_score),
                    confidence_score=scale(a.confidence_score),
                    feedback=a.feedback,
                    strengths=a.strengths,
                    improvements=a.improvements,
                    answered_at=a.answered_at,
                )
                for a in answers
            ],
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch interview answers: {str(e)}"
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
