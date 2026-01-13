"""
User repository implementation using SQLAlchemy.
"""
from datetime import datetime
from typing import List, Optional

from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.user import UserEntity
from app.domain.repositories.user_repository import UserRepositoryInterface
from app.infrastructure.database.models import User, StudentProfile
from app.core.constants import UserRole, UserStatus


class UserRepositoryImpl(UserRepositoryInterface):
    """SQLAlchemy implementation of user repository."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    def _to_entity(self, model: User) -> UserEntity:
        """Convert ORM model to domain entity."""
        return UserEntity(
            id=model.id,
            email=model.email,
            first_name=model.first_name,
            last_name=model.last_name,
            phone=model.phone,
            role=model.role,
            status=model.status,
            created_at=model.created_at,
            updated_at=model.updated_at,
            last_login=model.last_login,
        )
    
    async def create(self, user: UserEntity, password_hash: str) -> UserEntity:
        """Create a new user."""
        db_user = User(
            id=user.id,
            email=user.email,
            password_hash=password_hash,
            first_name=user.first_name,
            last_name=user.last_name,
            phone=user.phone,
            role=user.role,
            status=user.status,
        )
        
        self.session.add(db_user)
        await self.session.flush()
        await self.session.refresh(db_user)
        
        # Create student profile if user is a student
        if user.role == UserRole.STUDENT:
            profile = StudentProfile(user_id=db_user.id)
            self.session.add(profile)
            await self.session.flush()
        
        return self._to_entity(db_user)
    
    async def get_by_id(self, user_id: str) -> Optional[UserEntity]:
        """Get user by ID."""
        result = await self.session.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        return self._to_entity(user) if user else None
    
    async def get_by_email(self, email: str) -> Optional[UserEntity]:
        """Get user by email."""
        result = await self.session.execute(
            select(User).where(User.email == email.lower())
        )
        user = result.scalar_one_or_none()
        return self._to_entity(user) if user else None
    
    async def get_password_hash(self, user_id: str) -> Optional[str]:
        """Get password hash for a user."""
        result = await self.session.execute(
            select(User.password_hash).where(User.id == user_id)
        )
        return result.scalar_one_or_none()
    
    async def get_password_hash_by_email(self, email: str) -> Optional[str]:
        """Get password hash by email."""
        result = await self.session.execute(
            select(User.password_hash).where(User.email == email.lower())
        )
        return result.scalar_one_or_none()
    
    async def update(self, user: UserEntity) -> UserEntity:
        """Update user data."""
        await self.session.execute(
            update(User)
            .where(User.id == user.id)
            .values(
                first_name=user.first_name,
                last_name=user.last_name,
                phone=user.phone,
                updated_at=datetime.utcnow(),
            )
        )
        return user
    
    async def update_password(self, user_id: str, password_hash: str) -> bool:
        """Update user password."""
        result = await self.session.execute(
            update(User)
            .where(User.id == user_id)
            .values(password_hash=password_hash, updated_at=datetime.utcnow())
        )
        return result.rowcount > 0
    
    async def update_status(self, user_id: str, status: UserStatus) -> bool:
        """Update user status."""
        result = await self.session.execute(
            update(User)
            .where(User.id == user_id)
            .values(status=status, updated_at=datetime.utcnow())
        )
        return result.rowcount > 0
    
    async def update_last_login(self, user_id: str) -> bool:
        """Update last login timestamp."""
        result = await self.session.execute(
            update(User)
            .where(User.id == user_id)
            .values(last_login=datetime.utcnow())
        )
        return result.rowcount > 0
    
    async def delete(self, user_id: str) -> bool:
        """Delete a user."""
        result = await self.session.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        if user:
            await self.session.delete(user)
            return True
        return False
    
    async def list_all(
        self,
        role: Optional[UserRole] = None,
        status: Optional[UserStatus] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[UserEntity]:
        """List users with optional filters."""
        query = select(User)
        
        if role:
            query = query.where(User.role == role)
        if status:
            query = query.where(User.status == status)
        
        query = query.order_by(User.created_at.desc()).limit(limit).offset(offset)
        
        result = await self.session.execute(query)
        users = result.scalars().all()
        return [self._to_entity(user) for user in users]
    
    async def count(
        self,
        role: Optional[UserRole] = None,
        status: Optional[UserStatus] = None,
    ) -> int:
        """Count users with optional filters."""
        query = select(func.count(User.id))
        
        if role:
            query = query.where(User.role == role)
        if status:
            query = query.where(User.status == status)
        
        result = await self.session.execute(query)
        return result.scalar() or 0
    
    async def email_exists(self, email: str) -> bool:
        """Check if email is already registered."""
        result = await self.session.execute(
            select(func.count(User.id)).where(User.email == email.lower())
        )
        count = result.scalar() or 0
        return count > 0
