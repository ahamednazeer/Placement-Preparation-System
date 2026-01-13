"""
JWT Authentication Middleware.
Extracts and validates JWT tokens from requests.
"""
from typing import Optional, Tuple

from fastapi import Request, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.infrastructure.security.jwt import jwt_handler
from app.core.constants import TOKEN_TYPE_ACCESS


class JWTBearer(HTTPBearer):
    """
    Custom JWT Bearer authentication.
    Validates the JWT token and extracts user information.
    """
    
    def __init__(self, auto_error: bool = True):
        super().__init__(auto_error=auto_error)
    
    async def __call__(self, request: Request) -> Optional[dict]:
        """
        Extract and validate JWT token from request.
        
        Args:
            request: FastAPI request object.
            
        Returns:
            Decoded token payload.
            
        Raises:
            HTTPException: If token is invalid or missing.
        """
        credentials: HTTPAuthorizationCredentials = await super().__call__(request)
        
        if not credentials:
            if self.auto_error:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Not authenticated",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            return None
        
        if credentials.scheme.lower() != "bearer":
            if self.auto_error:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid authentication scheme",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            return None
        
        payload = jwt_handler.verify_token(credentials.credentials, TOKEN_TYPE_ACCESS)
        
        if not payload:
            if self.auto_error:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid or expired token",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            return None
        
        return payload


def get_current_user_from_token(token: str) -> Optional[Tuple[str, str]]:
    """
    Extract user ID and role from a token.
    
    Args:
        token: JWT access token.
        
    Returns:
        Tuple of (user_id, role) or None if invalid.
    """
    payload = jwt_handler.verify_token(token, TOKEN_TYPE_ACCESS)
    if payload:
        return payload.get("sub"), payload.get("role")
    return None


# Global JWT bearer instance
jwt_bearer = JWTBearer()
jwt_bearer_optional = JWTBearer(auto_error=False)
