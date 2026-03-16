"""
Coding API Routes.
Endpoints for AI-powered coding practice.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db_session, CurrentStudent
from app.application.services.coding_service import CodingService
from app.infrastructure.repositories.coding_attempt_repo_impl import CodingAttemptRepositoryImpl
from .schemas import (
    CodingProblemGenerateRequest,
    CodingProblemResponse,
    CodingAttemptRequest,
    CodingAttemptResponse,
    CodingHintRequest,
    CodingHintResponse,
    CodingExplanationResponse,
    CodingStatsResponse,
    problem_to_response,
)


router = APIRouter()


@router.post("/problems/ai-generate", response_model=CodingProblemResponse)
async def generate_coding_problem(
    request: CodingProblemGenerateRequest,
    user: CurrentStudent,
    db: AsyncSession = Depends(get_db_session),
):
    """Generate a new coding problem using Groq."""
    service = CodingService(db)
    try:
        problem = await service.generate_problem(
            difficulty=request.difficulty,
            tags=request.tags,
            topic=request.topic,
        )
        return problem_to_response(problem)
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to generate problem: {str(e)}")


@router.get("/problems/{problem_id}", response_model=CodingProblemResponse)
async def get_coding_problem(
    problem_id: str,
    user: CurrentStudent,
    db: AsyncSession = Depends(get_db_session),
):
    """Get a coding problem by ID."""
    service = CodingService(db)
    problem = await service.get_problem(problem_id)
    if not problem:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Problem not found")
    return problem_to_response(problem)


@router.post("/problems/{problem_id}/hint", response_model=CodingHintResponse)
async def get_coding_hint(
    problem_id: str,
    request: CodingHintRequest,
    user: CurrentStudent,
    db: AsyncSession = Depends(get_db_session),
):
    """Generate a hint for the given coding problem."""
    service = CodingService(db)
    try:
        hint = await service.get_hint(problem_id, request.code, request.hint_level or "MEDIUM")
        return CodingHintResponse(hint=hint)
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to generate hint: {str(e)}")


@router.post("/problems/{problem_id}/explain", response_model=CodingExplanationResponse)
async def get_coding_explanation(
    problem_id: str,
    user: CurrentStudent,
    db: AsyncSession = Depends(get_db_session),
):
    """Generate a solution explanation for the problem."""
    service = CodingService(db)
    try:
        explanation = await service.get_explanation(problem_id)
        payload = explanation if isinstance(explanation, dict) else {}
        return CodingExplanationResponse(
            approach=payload.get("approach") or "No explanation available.",
            pseudocode=payload.get("pseudocode") or "",
            complexity=payload.get("complexity") or {"time": "Unknown", "space": "Unknown"},
            edge_cases=payload.get("edge_cases") or [],
        )
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to generate explanation: {str(e)}")


@router.post("/attempts/submit", response_model=CodingAttemptResponse)
async def submit_coding_attempt(
    request: CodingAttemptRequest,
    user: CurrentStudent,
    db: AsyncSession = Depends(get_db_session),
):
    """Submit a coding attempt for AI evaluation."""
    service = CodingService(db)
    try:
        attempt, evaluation = await service.submit_attempt(
            user_id=user.id,
            problem_id=request.problem_id,
            language=request.language,
            code=request.code,
        )
        return CodingAttemptResponse(
            attempt_id=attempt.id,
            is_accepted=attempt.is_accepted,
            evaluation=evaluation,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to submit attempt: {str(e)}")


@router.get("/stats", response_model=CodingStatsResponse)
async def get_coding_stats(
    user: CurrentStudent,
    db: AsyncSession = Depends(get_db_session),
):
    """Get coding practice stats for the current user."""
    repo = CodingAttemptRepositoryImpl(db)
    stats = await repo.get_overall_stats(user.id)
    return CodingStatsResponse(
        total_attempts=stats.get("total_attempts", 0),
        average_score=stats.get("average_score", 0),
        best_score=stats.get("best_score", 0),
    )
