"""
User domain entity.
Pure business logic representation of a user.
"""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

from app.core.constants import UserRole, UserStatus


@dataclass
class UserEntity:
    """User domain entity with business rules."""
    
    id: str
    email: str
    first_name: str
    last_name: str
    role: UserRole
    status: UserStatus = UserStatus.ACTIVE
    phone: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    last_login: Optional[datetime] = None
    
    @property
    def full_name(self) -> str:
        """Get the user's full name."""
        return f"{self.first_name} {self.last_name}".strip()
    
    @property
    def is_active(self) -> bool:
        """Check if the user is active."""
        return self.status == UserStatus.ACTIVE
    
    @property
    def is_student(self) -> bool:
        """Check if the user is a student."""
        return self.role == UserRole.STUDENT
    
    @property
    def is_placement_officer(self) -> bool:
        """Check if the user is a placement officer."""
        return self.role == UserRole.PLACEMENT_OFFICER
    
    @property
    def is_admin(self) -> bool:
        """Check if the user is an admin."""
        return self.role == UserRole.ADMIN
    
    def can_access_admin_panel(self) -> bool:
        """Check if user can access admin panel."""
        return self.role in [UserRole.ADMIN, UserRole.PLACEMENT_OFFICER]
    
    def can_manage_drives(self) -> bool:
        """Check if user can manage placement drives."""
        return self.role in [UserRole.ADMIN, UserRole.PLACEMENT_OFFICER]
    
    def can_apply_for_drives(self) -> bool:
        """Check if user can apply for placement drives."""
        return self.role == UserRole.STUDENT and self.is_active
    
    def activate(self) -> None:
        """Activate the user account."""
        self.status = UserStatus.ACTIVE
        self.updated_at = datetime.utcnow()
    
    def deactivate(self) -> None:
        """Deactivate the user account."""
        self.status = UserStatus.INACTIVE
        self.updated_at = datetime.utcnow()
    
    def suspend(self) -> None:
        """Suspend the user account."""
        self.status = UserStatus.SUSPENDED
        self.updated_at = datetime.utcnow()
    
    def update_login(self) -> None:
        """Update last login timestamp."""
        self.last_login = datetime.utcnow()
