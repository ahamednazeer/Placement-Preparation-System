"""
Role-Based Access Control (RBAC) Middleware.
Provides decorators and dependencies for role-based authorization.
"""
from functools import wraps
from typing import Callable, List, Optional

from fastapi import Depends, HTTPException, status

from app.core.constants import UserRole
from app.middleware.auth_middleware import jwt_bearer


class RoleChecker:
    """
    Dependency class for checking user roles.
    """
    
    def __init__(self, allowed_roles: List[UserRole]):
        """
        Initialize with allowed roles.
        
        Args:
            allowed_roles: List of roles that are allowed access.
        """
        self.allowed_roles = allowed_roles
    
    async def __call__(self, token_payload: dict = Depends(jwt_bearer)) -> dict:
        """
        Check if the user has an allowed role.
        
        Args:
            token_payload: Decoded JWT token payload.
            
        Returns:
            Token payload if authorized.
            
        Raises:
            HTTPException: If user doesn't have required role.
        """
        user_role = token_payload.get("role")
        
        if not user_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Role not found in token",
            )
        
        # Convert string to enum if needed
        try:
            role_enum = UserRole(user_role)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Invalid role: {user_role}",
            )
        
        if role_enum not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {[r.value for r in self.allowed_roles]}",
            )
        
        return token_payload


# Pre-configured role checkers
require_admin = RoleChecker([UserRole.ADMIN])
require_placement_officer = RoleChecker([UserRole.PLACEMENT_OFFICER, UserRole.ADMIN])
require_student = RoleChecker([UserRole.STUDENT])
require_any_authenticated = RoleChecker([UserRole.STUDENT, UserRole.PLACEMENT_OFFICER, UserRole.ADMIN])


def roles_required(allowed_roles: List[UserRole]) -> RoleChecker:
    """
    Factory function to create a role checker for specific roles.
    
    Args:
        allowed_roles: List of allowed roles.
        
    Returns:
        RoleChecker instance.
    """
    return RoleChecker(allowed_roles)


def get_user_id(token_payload: dict = Depends(jwt_bearer)) -> str:
    """
    Dependency to extract user ID from token.
    
    Args:
        token_payload: Decoded JWT token payload.
        
    Returns:
        User ID.
    """
    user_id = token_payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User ID not found in token",
        )
    return user_id


def get_user_role(token_payload: dict = Depends(jwt_bearer)) -> UserRole:
    """
    Dependency to extract user role from token.
    
    Args:
        token_payload: Decoded JWT token payload.
        
    Returns:
        User role enum.
    """
    role = token_payload.get("role")
    if not role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Role not found in token",
        )
    return UserRole(role)
