"""
Pydantic schemas for admin user management.
"""
from datetime import datetime
from typing import Optional, List, Dict

from pydantic import BaseModel

from app.core.constants import UserRole, UserStatus
from app.api.v1.auth.schemas import RegisterRequest


class AdminUserUpdateRequest(BaseModel):
    """Schema for updating user role/status."""
    role: Optional[UserRole] = None
    status: Optional[UserStatus] = None


class AdminUserCreateRequest(RegisterRequest):
    """Schema for creating a user via admin."""
    pass


class AdminUserResponse(BaseModel):
    """Schema for admin user responses."""
    id: str
    email: str
    first_name: str
    last_name: str
    phone: Optional[str] = None
    role: UserRole
    status: UserStatus
    created_at: datetime
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True


class AdminUserListResponse(BaseModel):
    """Paginated list of users."""
    users: List[AdminUserResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class AdminRecentUser(BaseModel):
    """Recent user summary for admin dashboard."""
    id: str
    first_name: str
    last_name: str
    email: str
    role: UserRole
    status: UserStatus
    created_at: datetime
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True


class AdminSummaryResponse(BaseModel):
    """Admin dashboard summary."""
    total_users: int
    by_role: Dict[str, int]
    recent_users: List[AdminRecentUser]
    interview_completed: int
    interview_average_score: Optional[float] = None
    interview_best_score: Optional[float] = None
