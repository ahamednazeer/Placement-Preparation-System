"""
API routes for Aptitude Question management.
"""
from typing import Optional
from math import ceil

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.session import get_db_session
from app.dependencies import get_current_user, get_current_admin
from app.infrastructure.database.models import User
from app.application.services.aptitude_question_service import AptitudeQuestionService
from app.core.constants import UserRole, AptitudeCategory, DifficultyLevel, QuestionStatus, QuestionApprovalStatus
from app.api.v1.aptitude.schemas import (
    QuestionCreate,
    QuestionUpdate,
    QuestionResponse,
    QuestionListResponse,
    BulkUploadResponse,
    QuestionStatsResponse,
    AIGenerateRequest,
    AIGenerateResponse,
    QuestionVersionListResponse,
    QuestionAuditLogListResponse,
)

router = APIRouter(prefix="/aptitude", tags=["Aptitude Questions"])


# Dependency for officer/admin only
async def officer_or_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """Require officer or admin role."""
    if current_user.role not in [UserRole.PLACEMENT_OFFICER, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only placement officers and admins can manage questions"
        )
    return current_user


async def admin_only(
    current_user: User = Depends(get_current_admin),
) -> User:
    """Require admin role."""
    return current_user


@router.post("/questions", response_model=QuestionResponse, status_code=status.HTTP_201_CREATED)
async def create_question(
    data: QuestionCreate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(officer_or_admin),
):
    """Create a new aptitude question."""
    service = AptitudeQuestionService(db)
    try:
        question = await service.create_question(
            question_text=data.question_text,
            options=data.options,
            correct_option=data.correct_option,
            category=data.category,
            sub_topic=data.sub_topic,
            difficulty=data.difficulty,
            marks=data.marks,
            time_limit_seconds=data.time_limit_seconds,
            status=data.status,
            role_tag=data.role_tag,
            explanation=data.explanation,
            created_by_role=current_user.role,
            created_by=current_user.id,
        )
        return QuestionResponse.from_model(question)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/questions/ai-generate", response_model=AIGenerateResponse)
async def ai_generate_questions(
    data: AIGenerateRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(officer_or_admin),
):
    """Generate aptitude questions using AI."""
    service = AptitudeQuestionService(db)
    try:
        created, errors = await service.generate_questions_with_ai(
            category=data.category,
            difficulty=data.difficulty,
            count=data.count,
            sub_topic=data.sub_topic,
            role_tag=data.role_tag,
            marks=data.marks,
            time_limit_seconds=data.time_limit_seconds,
            status=data.status,
            instructions=data.instructions,
            created_by_role=current_user.role,
            created_by=current_user.id,
        )
        return AIGenerateResponse(
            success=len(created) > 0,
            created_count=len(created),
            errors=errors,
            questions=[QuestionResponse.from_model(q) for q in created],
        )
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/questions", response_model=QuestionListResponse)
async def list_questions(
    category: Optional[AptitudeCategory] = None,
    difficulty: Optional[DifficultyLevel] = None,
    status: Optional[QuestionStatus] = None,
    approval_status: Optional[QuestionApprovalStatus] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    include_inactive: bool = False,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(officer_or_admin),
):
    """List aptitude questions with filters."""
    service = AptitudeQuestionService(db)
    
    cat = category.value if category else None
    diff = difficulty.value if difficulty else None
    stat = status.value if status else None
    appr = approval_status.value if approval_status else None
    
    questions, total = await service.list_questions(
        category=cat,
        difficulty=diff,
        status=stat,
        approval_status=appr,
        search=search,
        page=page,
        page_size=page_size,
        include_inactive=include_inactive,
    )
    
    return QuestionListResponse(
        questions=[QuestionResponse.from_model(q) for q in questions],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=ceil(total / page_size) if total > 0 else 1,
    )


@router.get("/questions/stats", response_model=QuestionStatsResponse)
async def get_question_stats(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(officer_or_admin),
):
    """Get question statistics by category and difficulty."""
    service = AptitudeQuestionService(db)
    stats = await service.get_stats()
    return QuestionStatsResponse(**stats)


@router.get("/questions/audit", response_model=QuestionAuditLogListResponse)
async def get_question_audit_logs(
    question_id: Optional[str] = None,
    action: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(officer_or_admin),
):
    """Get audit logs for aptitude questions."""
    service = AptitudeQuestionService(db)
    logs, total = await service.get_audit_logs(
        question_id=question_id,
        action=action,
        page=page,
        page_size=page_size,
    )
    return QuestionAuditLogListResponse(
        logs=logs,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=ceil(total / page_size) if total > 0 else 1,
    )


@router.get("/questions/{question_id}", response_model=QuestionResponse)
async def get_question(
    question_id: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(officer_or_admin),
):
    """Get a specific question by ID."""
    service = AptitudeQuestionService(db)
    question = await service.get_question(question_id)
    
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
    
    return QuestionResponse.from_model(question)


@router.get("/questions/{question_id}/versions", response_model=QuestionVersionListResponse)
async def get_question_versions(
    question_id: str,
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(officer_or_admin),
):
    """Get version history for a question."""
    service = AptitudeQuestionService(db)
    versions, total = await service.get_versions(
        question_id=question_id,
        page=page,
        page_size=page_size,
    )
    return QuestionVersionListResponse(
        versions=versions,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=ceil(total / page_size) if total > 0 else 1,
    )


@router.put("/questions/{question_id}", response_model=QuestionResponse)
async def update_question(
    question_id: str,
    data: QuestionUpdate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(officer_or_admin),
):
    """Update an existing question."""
    service = AptitudeQuestionService(db)
    
    try:
        question = await service.update_question(
            question_id=question_id,
            question_text=data.question_text,
            options=data.options,
            correct_option=data.correct_option,
            category=data.category,
            sub_topic=data.sub_topic,
            difficulty=data.difficulty,
            marks=data.marks,
            time_limit_seconds=data.time_limit_seconds,
            status=data.status,
            role_tag=data.role_tag,
            explanation=data.explanation,
            created_by_role=current_user.role,
            changed_by=current_user.id,
        )
        
        if not question:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
        
        return QuestionResponse.from_model(question)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_question(
    question_id: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(officer_or_admin),
):
    """Delete (deactivate) a question."""
    service = AptitudeQuestionService(db)
    deleted = await service.delete_question(question_id, actor_id=current_user.id)
    
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")


@router.post("/questions/{question_id}/approve", response_model=QuestionResponse)
async def approve_question(
    question_id: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(admin_only),
):
    """Approve a question (admin only)."""
    service = AptitudeQuestionService(db)
    question = await service.approve_question(question_id, current_user.id)
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
    return QuestionResponse.from_model(question)


@router.post("/questions/{question_id}/reject", response_model=QuestionResponse)
async def reject_question(
    question_id: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(admin_only),
):
    """Reject a question (admin only)."""
    service = AptitudeQuestionService(db)
    question = await service.reject_question(question_id, current_user.id)
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
    return QuestionResponse.from_model(question)


@router.post("/questions/bulk-upload", response_model=BulkUploadResponse)
async def bulk_upload_questions(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(officer_or_admin),
):
    """Bulk upload questions from CSV file.
    
    CSV format:
    question_text,option_a,option_b,option_c,option_d,correct_option,category,difficulty,explanation,sub_topic,marks,status,time_limit_seconds,role_tag
    """
    if not file.filename.endswith(('.csv', '.txt')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a CSV (.csv) file"
        )
    
    try:
        content = await file.read()
        csv_content = content.decode('utf-8')
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read file: {str(e)}"
        )
    
    service = AptitudeQuestionService(db)
    created_count, errors = await service.bulk_upload(
        csv_content,
        created_by=current_user.id,
        created_by_role=current_user.role,
    )
    
    return BulkUploadResponse(
        success=created_count > 0,
        created_count=created_count,
        errors=errors,
        message=f"Successfully created {created_count} questions" + (f" with {len(errors)} errors" if errors else ""),
    )


@router.get("/categories", response_model=list)
async def get_categories():
    """Get all available aptitude categories."""
    return [{"value": c.value, "label": c.value.replace("_", " ").title()} for c in AptitudeCategory]


@router.get("/difficulties", response_model=list)
async def get_difficulties():
    """Get all available difficulty levels."""
    return [{"value": d.value, "label": d.value.title()} for d in DifficultyLevel]
