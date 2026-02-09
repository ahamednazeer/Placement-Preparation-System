"""
Service layer for admin user management.
"""
from typing import Optional, Tuple, List

from sqlalchemy import select, func, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import User
from app.core.constants import UserRole, UserStatus, MAX_PAGE_SIZE


class AdminUserService:
    """Business logic for admin user management."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_users(
        self,
        role: Optional[UserRole] = None,
        status: Optional[UserStatus] = None,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[List[User], int, int]:
        """List users with optional filters and pagination."""
        page = max(page, 1)
        page_size = max(1, min(page_size, MAX_PAGE_SIZE))
        offset = (page - 1) * page_size

        filters = []
        if role:
            filters.append(User.role == role)
        if status:
            filters.append(User.status == status)
        if search:
            trimmed = search.strip()
            if trimmed:
                term = f"%{trimmed.lower()}%"
                filters.append(
                    or_(
                        func.lower(User.email).like(term),
                        func.lower(User.first_name).like(term),
                        func.lower(User.last_name).like(term),
                    )
                )

        query = select(User)
        count_query = select(func.count(User.id))
        if filters:
            query = query.where(and_(*filters))
            count_query = count_query.where(and_(*filters))

        query = query.order_by(User.created_at.desc()).limit(page_size).offset(offset)

        result = await self.db.execute(query)
        users = list(result.scalars().all())

        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0

        return users, total, page_size

    async def update_user(
        self,
        user_id: str,
        role: Optional[UserRole] = None,
        status: Optional[UserStatus] = None,
    ) -> Optional[User]:
        """Update a user's role and/or status."""
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            return None

        if role is not None:
            user.role = role
        if status is not None:
            user.status = status

        await self.db.commit()
        await self.db.refresh(user)
        return user
