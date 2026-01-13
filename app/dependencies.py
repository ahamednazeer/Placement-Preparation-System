"""
Common FastAPI dependencies.
Provides database sessions, authentication, and other shared dependencies.
"""
from typing import Annotated, Optional

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.infrastructure.database.session import get_db_session
from app.infrastructure.database.models import User
from app.middleware.auth_middleware import jwt_bearer
from app.core.constants import UserRole, UserStatus


# Type alias for database session dependency
DBSession = Annotated[AsyncSession, Depends(get_db_session)]


async def get_current_user(
    db: DBSession,
    token_payload: dict = Depends(jwt_bearer),
) -> User:
    """
    Get the current authenticated user from the database.
    
    Args:
        db: Database session.
        token_payload: Decoded JWT token payload.
        
    Returns:
        User model instance.
        
    Raises:
        HTTPException: If user not found or inactive.
    """
    user_id = token_payload.get("sub")
    
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    if user.status != UserStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"User account is {user.status.value.lower()}",
        )
    
    return user


async def get_current_active_student(
    user: User = Depends(get_current_user),
) -> User:
    """
    Get the current user if they are a student.
    
    Args:
        user: Current authenticated user.
        
    Returns:
        User if they are a student.
        
    Raises:
        HTTPException: If user is not a student.
    """
    if user.role != UserRole.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can access this resource",
        )
    return user


async def get_current_placement_officer(
    user: User = Depends(get_current_user),
) -> User:
    """
    Get the current user if they are a placement officer or admin.
    
    Args:
        user: Current authenticated user.
        
    Returns:
        User if they are a placement officer or admin.
        
    Raises:
        HTTPException: If user is not authorized.
    """
    if user.role not in [UserRole.PLACEMENT_OFFICER, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only placement officers can access this resource",
        )
    return user


async def get_current_admin(
    user: User = Depends(get_current_user),
) -> User:
    """
    Get the current user if they are an admin.
    
    Args:
        user: Current authenticated user.
        
    Returns:
        User if they are an admin.
        
    Raises:
        HTTPException: If user is not an admin.
    """
    if user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user


# Type aliases for common dependencies
CurrentUser = Annotated[User, Depends(get_current_user)]
CurrentStudent = Annotated[User, Depends(get_current_active_student)]
CurrentOfficer = Annotated[User, Depends(get_current_placement_officer)]
CurrentAdmin = Annotated[User, Depends(get_current_admin)]
