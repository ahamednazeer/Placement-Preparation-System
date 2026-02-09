"""
Admin API routes for user management.
"""
from math import ceil
from typing import Optional, Dict

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_admin
from app.infrastructure.database.session import get_db_session
from app.application.services.admin_user_service import AdminUserService
from app.application.services.auth_service import AuthService
from app.core.constants import UserRole, UserStatus, InterviewStatus
from app.infrastructure.database.models import User, InterviewSession
from app.api.v1.admin.schemas import (
    AdminUserListResponse,
    AdminUserResponse,
    AdminUserCreateRequest,
    AdminUserUpdateRequest,
    AdminSummaryResponse,
    AdminRecentUser,
)

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/users", response_model=AdminUserListResponse)
async def list_users(
    role: Optional[UserRole] = None,
    status_filter: Optional[UserStatus] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db_session),
    current_user=Depends(get_current_admin),
):
    """List users with optional filters (Admin only)."""
    service = AdminUserService(db)
    users, total, normalized_page_size = await service.list_users(
        role=role,
        status=status_filter,
        search=search,
        page=page,
        page_size=page_size,
    )

    return AdminUserListResponse(
        users=[AdminUserResponse.model_validate(u) for u in users],
        total=total,
        page=page,
        page_size=normalized_page_size,
        total_pages=ceil(total / normalized_page_size) if total > 0 else 1,
    )


@router.post("/users", response_model=AdminUserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: AdminUserCreateRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user=Depends(get_current_admin),
):
    """Create a new user (Admin only)."""
    auth_service = AuthService(db)
    try:
        user, _access_token, _refresh_token = await auth_service.register(
            email=payload.email,
            password=payload.password,
            first_name=payload.first_name,
            last_name=payload.last_name,
            phone=payload.phone,
            role=payload.role or UserRole.STUDENT,
        )
        return AdminUserResponse.model_validate(user)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.patch("/users/{user_id}", response_model=AdminUserResponse)
async def update_user(
    user_id: str,
    payload: AdminUserUpdateRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user=Depends(get_current_admin),
):
    """Update a user's role and/or status (Admin only)."""
    if payload.role is None and payload.status is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No updates provided")

    service = AdminUserService(db)
    user = await service.update_user(user_id, role=payload.role, status=payload.status)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    return AdminUserResponse.model_validate(user)


@router.get("/summary", response_model=AdminSummaryResponse)
async def get_admin_summary(
    db: AsyncSession = Depends(get_db_session),
    current_user=Depends(get_current_admin),
):
    """Get admin dashboard summary stats (Admin only)."""
    # User counts by role
    role_counts: Dict[str, int] = {role.value: 0 for role in UserRole}
    role_result = await db.execute(
        select(User.role, func.count(User.id)).group_by(User.role)
    )
    for role, count in role_result.all():
        role_counts[role.value] = count

    total_users = sum(role_counts.values())

    # Recent users
    recent_result = await db.execute(
        select(User).order_by(User.created_at.desc()).limit(5)
    )
    recent_users = list(recent_result.scalars().all())

    # Interview stats (global)
    completed_count = await db.execute(
        select(func.count(InterviewSession.id)).where(InterviewSession.status == InterviewStatus.COMPLETED)
    )
    avg_score = await db.execute(
        select(func.avg(InterviewSession.overall_score)).where(InterviewSession.status == InterviewStatus.COMPLETED)
    )
    best_score = await db.execute(
        select(func.max(InterviewSession.overall_score)).where(InterviewSession.status == InterviewStatus.COMPLETED)
    )

    completed = completed_count.scalar() or 0
    avg_val = avg_score.scalar()
    best_val = best_score.scalar()

    return AdminSummaryResponse(
        total_users=total_users,
        by_role=role_counts,
        recent_users=[AdminRecentUser.model_validate(u) for u in recent_users],
        interview_completed=completed,
        interview_average_score=round(avg_val, 1) if avg_val is not None else None,
        interview_best_score=round(best_val, 1) if best_val is not None else None,
    )
