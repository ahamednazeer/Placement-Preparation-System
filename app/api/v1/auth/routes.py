"""
Authentication API routes.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.session import get_db_session
from app.application.services.auth_service import AuthService
from app.middleware.auth_middleware import jwt_bearer
from app.middleware.rbac_middleware import get_user_id
from app.core.constants import UserRole
from .schemas import (
    RegisterRequest,
    LoginRequest,
    RefreshTokenRequest,
    ChangePasswordRequest,
    AuthResponse,
    TokenResponse,
    UserResponse,
    MessageResponse,
)


router = APIRouter()


@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
    description="Create a new user account with email and password.",
)
async def register(
    request: RegisterRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """
    Register a new user.
    
    - **email**: Valid email address
    - **password**: Password with min 8 chars, 1 uppercase, 1 lowercase, 1 digit
    - **first_name**: User's first name
    - **last_name**: User's last name
    - **phone**: Optional phone number
    - **role**: User role (STUDENT, PLACEMENT_OFFICER, ADMIN)
    """
    auth_service = AuthService(db)
    
    try:
        user, access_token, refresh_token = await auth_service.register(
            email=request.email,
            password=request.password,
            first_name=request.first_name,
            last_name=request.last_name,
            phone=request.phone,
            role=request.role or UserRole.STUDENT,
        )
        
        return AuthResponse(
            user=UserResponse(
                id=user.id,
                email=user.email,
                first_name=user.first_name,
                last_name=user.last_name,
                phone=user.phone,
                role=user.role,
                status=user.status.value,
                created_at=user.created_at,
                last_login=user.last_login,
            ),
            access_token=access_token,
            refresh_token=refresh_token,
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post(
    "/login",
    response_model=AuthResponse,
    summary="Login user",
    description="Authenticate user and return access tokens.",
)
async def login(
    request: LoginRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """
    Login with email and password.
    
    Returns access and refresh tokens on successful authentication.
    """
    auth_service = AuthService(db)
    
    try:
        user, access_token, refresh_token = await auth_service.login(
            email=request.email,
            password=request.password,
        )
        
        return AuthResponse(
            user=UserResponse(
                id=user.id,
                email=user.email,
                first_name=user.first_name,
                last_name=user.last_name,
                phone=user.phone,
                role=user.role,
                status=user.status.value,
                created_at=user.created_at,
                last_login=user.last_login,
            ),
            access_token=access_token,
            refresh_token=refresh_token,
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
        )


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Refresh tokens",
    description="Get new access and refresh tokens using a valid refresh token.",
)
async def refresh_tokens(
    request: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """
    Refresh access and refresh tokens.
    
    Provide a valid refresh token to get new tokens.
    """
    auth_service = AuthService(db)
    
    try:
        access_token, refresh_token = await auth_service.refresh_tokens(
            refresh_token=request.refresh_token,
        )
        
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
        )


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current user",
    description="Get the currently authenticated user's information.",
)
async def get_current_user(
    token_payload: dict = Depends(jwt_bearer),
    db: AsyncSession = Depends(get_db_session),
):
    """
    Get current authenticated user info.
    
    Requires a valid access token.
    """
    auth_service = AuthService(db)
    
    user_id = token_payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )
    
    user = await auth_service.get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    return UserResponse(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        phone=user.phone,
        role=user.role,
        status=user.status.value,
        created_at=user.created_at,
        last_login=user.last_login,
    )


@router.post(
    "/change-password",
    response_model=MessageResponse,
    summary="Change password",
    description="Change the current user's password.",
)
async def change_password(
    request: ChangePasswordRequest,
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db_session),
):
    """
    Change the current user's password.
    
    Requires the current password and a new password.
    """
    auth_service = AuthService(db)
    
    try:
        success = await auth_service.change_password(
            user_id=user_id,
            current_password=request.current_password,
            new_password=request.new_password,
        )
        
        if success:
            return MessageResponse(message="Password changed successfully")
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to change password",
            )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Logout user",
    description="Logout the current user (client should discard tokens).",
)
async def logout(
    token_payload: dict = Depends(jwt_bearer),
):
    """
    Logout the current user.
    
    Note: This endpoint is mainly for client-side token cleanup.
    The client should discard the tokens after calling this.
    """
    # In a production system, you might want to blacklist the token here
    # For now, we just return a success message
    return MessageResponse(message="Logged out successfully")
