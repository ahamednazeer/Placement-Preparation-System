"""
Role value object.
"""
from dataclasses import dataclass

from app.core.constants import UserRole


@dataclass(frozen=True)
class Role:
    """Immutable role value object."""
    
    value: UserRole
    
    @classmethod
    def student(cls) -> "Role":
        """Create a student role."""
        return cls(UserRole.STUDENT)
    
    @classmethod
    def placement_officer(cls) -> "Role":
        """Create a placement officer role."""
        return cls(UserRole.PLACEMENT_OFFICER)
    
    @classmethod
    def admin(cls) -> "Role":
        """Create an admin role."""
        return cls(UserRole.ADMIN)
    
    @classmethod
    def from_string(cls, role_str: str) -> "Role":
        """Create a role from string."""
        return cls(UserRole(role_str.upper()))
    
    def __str__(self) -> str:
        return self.value.value
    
    @property
    def is_student(self) -> bool:
        return self.value == UserRole.STUDENT
    
    @property
    def is_placement_officer(self) -> bool:
        return self.value == UserRole.PLACEMENT_OFFICER
    
    @property
    def is_admin(self) -> bool:
        return self.value == UserRole.ADMIN
