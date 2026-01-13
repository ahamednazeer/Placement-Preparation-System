"""
Helper utility functions.
"""
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional


def generate_uuid() -> str:
    """Generate a new UUID string."""
    return str(uuid.uuid4())


def utc_now() -> datetime:
    """Get current UTC datetime."""
    return datetime.now(timezone.utc)


def to_naive_utc(dt: datetime) -> datetime:
    """Convert a datetime to naive UTC."""
    if dt.tzinfo is None:
        return dt
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


def format_datetime(dt: datetime, fmt: str = "%Y-%m-%d %H:%M:%S") -> str:
    """Format datetime to string."""
    return dt.strftime(fmt)


def parse_datetime(dt_string: str, fmt: str = "%Y-%m-%d %H:%M:%S") -> datetime:
    """Parse string to datetime."""
    return datetime.strptime(dt_string, fmt).replace(tzinfo=timezone.utc)


def calculate_percentage(part: float, whole: float) -> float:
    """
    Calculate percentage safely.
    
    Args:
        part: The numerator.
        whole: The denominator.
        
    Returns:
        Percentage value (0-100).
    """
    if whole == 0:
        return 0.0
    return round((part / whole) * 100, 2)


def paginate_list(items: list, page: int, page_size: int) -> Dict[str, Any]:
    """
    Paginate a list of items.
    
    Args:
        items: List of items to paginate.
        page: Current page (1-indexed).
        page_size: Items per page.
        
    Returns:
        Dictionary with paginated data and metadata.
    """
    total = len(items)
    total_pages = (total + page_size - 1) // page_size
    start = (page - 1) * page_size
    end = start + page_size
    
    return {
        "items": items[start:end],
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": total_pages,
        "has_next": page < total_pages,
        "has_prev": page > 1,
    }


def mask_email(email: str) -> str:
    """
    Mask an email address for privacy.
    
    Args:
        email: Email to mask.
        
    Returns:
        Masked email (e.g., j***@example.com).
    """
    if "@" not in email:
        return email
    
    local, domain = email.split("@", 1)
    if len(local) <= 2:
        masked_local = local[0] + "***"
    else:
        masked_local = local[0] + "***" + local[-1]
    
    return f"{masked_local}@{domain}"


def truncate_string(text: str, max_length: int = 50, suffix: str = "...") -> str:
    """
    Truncate a string with ellipsis.
    
    Args:
        text: String to truncate.
        max_length: Maximum length before truncation.
        suffix: Suffix to append when truncated.
        
    Returns:
        Truncated string.
    """
    if len(text) <= max_length:
        return text
    return text[: max_length - len(suffix)] + suffix
