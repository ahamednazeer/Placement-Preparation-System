"""
Resume domain entity.
"""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class ResumeEntity:
    """Resume domain entity."""
    
    id: str
    student_id: str
    file_path: str
    file_type: str
    original_filename: str
    file_size_bytes: int
    is_active: bool = True
    uploaded_at: datetime = field(default_factory=datetime.utcnow)
    
    @property
    def file_size_mb(self) -> float:
        """Get file size in MB."""
        return round(self.file_size_bytes / (1024 * 1024), 2)
    
    @property
    def file_extension(self) -> str:
        """Get file extension."""
        return self.file_type.lower()
    
    def deactivate(self) -> None:
        """Mark resume as inactive."""
        self.is_active = False
