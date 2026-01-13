"""
Authentication service.
Handles user registration, login, token management.
"""
from datetime import datetime
from typing import Optional, Tuple
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.user import UserEntity
from app.infrastructure.repositories.user_repo_impl import UserRepositoryImpl
from app.infrastructure.security.jwt import jwt_handler
from app.infrastructure.security.password import hash_password, verify_password
from app.core.constants import UserRole, UserStatus, TOKEN_TYPE_REFRESH
from app.utils.logger import logger


class AuthService:
    """Authentication service for handling user auth operations."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.user_repo = UserRepositoryImpl(session)
    
    async def register(
        self,
        email: str,
        password: str,
        first_name: str,
        last_name: str,
        role: UserRole = UserRole.STUDENT,
        phone: Optional[str] = None,
    ) -> Tuple[UserEntity, str, str]:
        """
        Register a new user.
        
        Args:
            email: User's email address.
            password: Plain text password.
            first_name: User's first name.
            last_name: User's last name.
            role: User role (default: STUDENT).
            phone: Optional phone number.
            
        Returns:
            Tuple of (user_entity, access_token, refresh_token).
            
        Raises:
            ValueError: If email already exists or validation fails.
        """
        # Normalize email
        email = email.lower().strip()
        
        # Check if email exists
        if await self.user_repo.email_exists(email):
            raise ValueError("Email already registered")
        
        # Create user entity
        user = UserEntity(
            id=str(uuid4()),
            email=email,
            first_name=first_name.strip(),
            last_name=last_name.strip(),
            phone=phone,
            role=role,
            status=UserStatus.ACTIVE,
        )
        
        # Hash password and create user
        password_hash = hash_password(password)
        created_user = await self.user_repo.create(user, password_hash)
        
        # Generate tokens
        access_token = jwt_handler.create_access_token(
            user_id=created_user.id,
            role=created_user.role.value,
        )
        refresh_token = jwt_handler.create_refresh_token(user_id=created_user.id)
        
        logger.info(f"User registered: {email} with role {role.value}")
        
        return created_user, access_token, refresh_token
    
    async def login(
        self,
        email: str,
        password: str,
    ) -> Tuple[UserEntity, str, str]:
        """
        Authenticate a user and return tokens.
        
        Args:
            email: User's email address.
            password: Plain text password.
            
        Returns:
            Tuple of (user_entity, access_token, refresh_token).
            
        Raises:
            ValueError: If credentials are invalid.
        """
        email = email.lower().strip()
        
        # Get user
        user = await self.user_repo.get_by_email(email)
        if not user:
            raise ValueError("Invalid email or password")
        
        # Check if user is active
        if user.status != UserStatus.ACTIVE:
            raise ValueError(f"Account is {user.status.value.lower()}")
        
        # Verify password
        password_hash = await self.user_repo.get_password_hash_by_email(email)
        if not password_hash or not verify_password(password, password_hash):
            raise ValueError("Invalid email or password")
        
        # Update last login
        await self.user_repo.update_last_login(user.id)
        
        # Generate tokens
        access_token = jwt_handler.create_access_token(
            user_id=user.id,
            role=user.role.value,
        )
        refresh_token = jwt_handler.create_refresh_token(user_id=user.id)
        
        logger.info(f"User logged in: {email}")
        
        return user, access_token, refresh_token
    
    async def refresh_tokens(
        self,
        refresh_token: str,
    ) -> Tuple[str, str]:
        """
        Refresh access and refresh tokens.
        
        Args:
            refresh_token: Current refresh token.
            
        Returns:
            Tuple of (new_access_token, new_refresh_token).
            
        Raises:
            ValueError: If refresh token is invalid.
        """
        # Verify refresh token
        payload = jwt_handler.verify_token(refresh_token, TOKEN_TYPE_REFRESH)
        if not payload:
            raise ValueError("Invalid or expired refresh token")
        
        user_id = payload.get("sub")
        if not user_id:
            raise ValueError("Invalid token payload")
        
        # Get user
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise ValueError("User not found")
        
        if user.status != UserStatus.ACTIVE:
            raise ValueError(f"Account is {user.status.value.lower()}")
        
        # Generate new tokens
        new_access_token = jwt_handler.create_access_token(
            user_id=user.id,
            role=user.role.value,
        )
        new_refresh_token = jwt_handler.create_refresh_token(user_id=user.id)
        
        logger.info(f"Tokens refreshed for user: {user.email}")
        
        return new_access_token, new_refresh_token
    
    async def get_user_by_id(self, user_id: str) -> Optional[UserEntity]:
        """Get user by ID."""
        return await self.user_repo.get_by_id(user_id)
    
    async def change_password(
        self,
        user_id: str,
        current_password: str,
        new_password: str,
    ) -> bool:
        """
        Change user password.
        
        Args:
            user_id: User's ID.
            current_password: Current password.
            new_password: New password.
            
        Returns:
            True if password changed successfully.
            
        Raises:
            ValueError: If current password is wrong.
        """
        # Verify current password
        password_hash = await self.user_repo.get_password_hash(user_id)
        if not password_hash or not verify_password(current_password, password_hash):
            raise ValueError("Current password is incorrect")
        
        # Update password
        new_hash = hash_password(new_password)
        success = await self.user_repo.update_password(user_id, new_hash)
        
        if success:
            logger.info(f"Password changed for user: {user_id}")
        
        return success
