"""
Email value object with validation.
"""
import re
from dataclasses import dataclass


@dataclass(frozen=True)
class Email:
    """Immutable email value object with validation."""
    
    value: str
    
    def __post_init__(self):
        """Validate email format."""
        if not self._is_valid_email(self.value):
            raise ValueError(f"Invalid email format: {self.value}")
    
    @staticmethod
    def _is_valid_email(email: str) -> bool:
        """Check if email format is valid."""
        pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
        return bool(re.match(pattern, email))
    
    def __str__(self) -> str:
        return self.value
    
    @property
    def local_part(self) -> str:
        """Get the local part of the email (before @)."""
        return self.value.split("@")[0]
    
    @property
    def domain(self) -> str:
        """Get the domain part of the email (after @)."""
        return self.value.split("@")[1]
    
    def masked(self) -> str:
        """Get masked version of email for privacy."""
        local = self.local_part
        if len(local) <= 2:
            masked_local = local[0] + "***"
        else:
            masked_local = local[0] + "***" + local[-1]
        return f"{masked_local}@{self.domain}"
