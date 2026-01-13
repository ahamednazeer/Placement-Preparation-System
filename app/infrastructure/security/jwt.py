"""
JWT token creation and verification.
"""
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
import hashlib

from jose import jwt, JWTError

from app.core.config import settings
from app.core.constants import TOKEN_TYPE_ACCESS, TOKEN_TYPE_REFRESH


class JWTHandler:
    """Handle JWT token operations."""
    
    def __init__(self):
        self.secret_key = settings.secret_key
        self.algorithm = settings.algorithm
        self.access_token_expire_minutes = settings.access_token_expire_minutes
        self.refresh_token_expire_days = settings.refresh_token_expire_days
    
    def create_access_token(
        self,
        user_id: str,
        role: str,
        additional_claims: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Create an access token.
        
        Args:
            user_id: User's unique identifier.
            role: User's role.
            additional_claims: Optional additional JWT claims.
            
        Returns:
            Encoded JWT access token.
        """
        expire = datetime.now(timezone.utc) + timedelta(minutes=self.access_token_expire_minutes)
        
        payload = {
            "sub": user_id,
            "role": role,
            "type": TOKEN_TYPE_ACCESS,
            "exp": expire,
            "iat": datetime.now(timezone.utc),
        }
        
        if additional_claims:
            payload.update(additional_claims)
        
        return jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
    
    def create_refresh_token(self, user_id: str) -> str:
        """
        Create a refresh token.
        
        Args:
            user_id: User's unique identifier.
            
        Returns:
            Encoded JWT refresh token.
        """
        expire = datetime.now(timezone.utc) + timedelta(days=self.refresh_token_expire_days)
        
        payload = {
            "sub": user_id,
            "type": TOKEN_TYPE_REFRESH,
            "exp": expire,
            "iat": datetime.now(timezone.utc),
        }
        
        return jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
    
    def verify_token(self, token: str, token_type: str = TOKEN_TYPE_ACCESS) -> Optional[Dict[str, Any]]:
        """
        Verify and decode a JWT token.
        
        Args:
            token: The JWT token to verify.
            token_type: Expected token type (access or refresh).
            
        Returns:
            Decoded token payload or None if invalid.
        """
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            
            # Verify token type
            if payload.get("type") != token_type:
                return None
            
            # Verify expiration
            exp = payload.get("exp")
            if exp and datetime.fromtimestamp(exp, tz=timezone.utc) < datetime.now(timezone.utc):
                return None
            
            return payload
            
        except JWTError:
            return None
    
    def get_token_hash(self, token: str) -> str:
        """
        Create a hash of the token for storage.
        
        Args:
            token: The token to hash.
            
        Returns:
            SHA256 hash of the token.
        """
        return hashlib.sha256(token.encode()).hexdigest()
    
    def decode_token_unsafe(self, token: str) -> Optional[Dict[str, Any]]:
        """
        Decode a token without verification.
        Use only for debugging/logging purposes.
        
        Args:
            token: The JWT token to decode.
            
        Returns:
            Decoded payload or None.
        """
        try:
            return jwt.decode(token, self.secret_key, algorithms=[self.algorithm], options={"verify_exp": False})
        except JWTError:
            return None


# Global JWT handler instance
jwt_handler = JWTHandler()
