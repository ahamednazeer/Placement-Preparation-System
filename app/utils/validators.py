"""
Common validation utilities.
"""
import re
from typing import Optional


def validate_email(email: str) -> bool:
    """
    Validate email format.
    
    Args:
        email: Email string to validate.
        
    Returns:
        True if valid, False otherwise.
    """
    pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    return bool(re.match(pattern, email))


def validate_password(password: str) -> tuple[bool, Optional[str]]:
    """
    Validate password strength.
    
    Args:
        password: Password to validate.
        
    Returns:
        Tuple of (is_valid, error_message).
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter"
    
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter"
    
    if not re.search(r"\d", password):
        return False, "Password must contain at least one digit"
    
    return True, None


def validate_phone(phone: str) -> bool:
    """
    Validate phone number format.
    
    Args:
        phone: Phone number to validate.
        
    Returns:
        True if valid, False otherwise.
    """
    # Remove common separators
    cleaned = re.sub(r"[\s\-\(\)]", "", phone)
    # Check if it's a valid phone number (10-15 digits, optionally starting with +)
    return bool(re.match(r"^\+?\d{10,15}$", cleaned))


def sanitize_string(value: str, max_length: int = 255) -> str:
    """
    Sanitize and truncate a string.
    
    Args:
        value: String to sanitize.
        max_length: Maximum allowed length.
        
    Returns:
        Sanitized string.
    """
    # Strip whitespace and truncate
    return value.strip()[:max_length]
