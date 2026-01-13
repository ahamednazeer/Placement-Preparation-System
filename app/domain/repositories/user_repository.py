"""
User repository interface.
Defines the contract for user data access.
"""
from abc import ABC, abstractmethod
from typing import List, Optional

from app.domain.entities.user import UserEntity
from app.core.constants import UserRole, UserStatus


class UserRepositoryInterface(ABC):
    """Abstract user repository interface."""
    
    @abstractmethod
    async def create(self, user: UserEntity, password_hash: str) -> UserEntity:
        """Create a new user."""
        pass
    
    @abstractmethod
    async def get_by_id(self, user_id: str) -> Optional[UserEntity]:
        """Get user by ID."""
        pass
    
    @abstractmethod
    async def get_by_email(self, email: str) -> Optional[UserEntity]:
        """Get user by email."""
        pass
    
    @abstractmethod
    async def get_password_hash(self, user_id: str) -> Optional[str]:
        """Get password hash for a user."""
        pass
    
    @abstractmethod
    async def update(self, user: UserEntity) -> UserEntity:
        """Update user data."""
        pass
    
    @abstractmethod
    async def update_password(self, user_id: str, password_hash: str) -> bool:
        """Update user password."""
        pass
    
    @abstractmethod
    async def update_status(self, user_id: str, status: UserStatus) -> bool:
        """Update user status."""
        pass
    
    @abstractmethod
    async def update_last_login(self, user_id: str) -> bool:
        """Update last login timestamp."""
        pass
    
    @abstractmethod
    async def delete(self, user_id: str) -> bool:
        """Delete a user."""
        pass
    
    @abstractmethod
    async def list_all(
        self,
        role: Optional[UserRole] = None,
        status: Optional[UserStatus] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[UserEntity]:
        """List users with optional filters."""
        pass
    
    @abstractmethod
    async def count(
        self,
        role: Optional[UserRole] = None,
        status: Optional[UserStatus] = None,
    ) -> int:
        """Count users with optional filters."""
        pass
    
    @abstractmethod
    async def email_exists(self, email: str) -> bool:
        """Check if email is already registered."""
        pass
