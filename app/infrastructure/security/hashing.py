"""
General hashing utilities.
"""
import hashlib
import secrets
from typing import Tuple


def generate_token() -> str:
    """Generate a secure random token."""
    return secrets.token_urlsafe(32)


def hash_sha256(value: str) -> str:
    """
    Create SHA256 hash of a value.
    
    Args:
        value: Value to hash.
        
    Returns:
        Hex digest of the hash.
    """
    return hashlib.sha256(value.encode()).hexdigest()


def generate_salt() -> str:
    """Generate a random salt."""
    return secrets.token_hex(16)


def hash_with_salt(value: str, salt: str) -> str:
    """
    Hash a value with a salt.
    
    Args:
        value: Value to hash.
        salt: Salt to use.
        
    Returns:
        Salted hash.
    """
    return hashlib.sha256(f"{salt}{value}".encode()).hexdigest()


def generate_verification_code(length: int = 6) -> str:
    """
    Generate a numeric verification code.
    
    Args:
        length: Length of the code.
        
    Returns:
        Numeric string code.
    """
    return "".join(str(secrets.randbelow(10)) for _ in range(length))
