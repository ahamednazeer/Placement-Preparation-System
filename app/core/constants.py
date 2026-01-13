"""
Application constants and enums.
"""
from enum import Enum


class UserRole(str, Enum):
    """User roles in the system."""
    STUDENT = "STUDENT"
    PLACEMENT_OFFICER = "PLACEMENT_OFFICER"
    ADMIN = "ADMIN"


class UserStatus(str, Enum):
    """User account status."""
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    SUSPENDED = "SUSPENDED"
    PENDING = "PENDING"


class AptitudeCategory(str, Enum):
    """Categories for aptitude questions."""
    QUANTITATIVE = "QUANTITATIVE"
    LOGICAL = "LOGICAL"
    VERBAL = "VERBAL"
    TECHNICAL = "TECHNICAL"
    DATA_INTERPRETATION = "DATA_INTERPRETATION"


class DifficultyLevel(str, Enum):
    """Difficulty levels for questions/problems."""
    EASY = "EASY"
    MEDIUM = "MEDIUM"
    HARD = "HARD"


class InterviewType(str, Enum):
    """Types of mock interviews."""
    TECHNICAL = "TECHNICAL"
    HR = "HR"
    BEHAVIORAL = "BEHAVIORAL"
    CASE_STUDY = "CASE_STUDY"


class InterviewMode(str, Enum):
    """Mode of interview input."""
    TEXT = "TEXT"
    VOICE = "VOICE"


class PlacementDriveStatus(str, Enum):
    """Status of placement drives."""
    UPCOMING = "UPCOMING"
    ONGOING = "ONGOING"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class ApplicationStatus(str, Enum):
    """Status of drive applications."""
    PENDING = "PENDING"
    SHORTLISTED = "SHORTLISTED"
    SELECTED = "SELECTED"
    REJECTED = "REJECTED"
    WITHDRAWN = "WITHDRAWN"


class CodingLanguage(str, Enum):
    """Supported programming languages."""
    PYTHON = "PYTHON"
    JAVA = "JAVA"
    CPP = "CPP"
    JAVASCRIPT = "JAVASCRIPT"
    C = "C"


# API Version
API_V1_PREFIX = "/api/v1"

# Token types
TOKEN_TYPE_ACCESS = "access"
TOKEN_TYPE_REFRESH = "refresh"

# Pagination defaults
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100

# Score ranges
MIN_READINESS_SCORE = 0
MAX_READINESS_SCORE = 100

# Interview settings
MAX_INTERVIEW_QUESTIONS = 10
INTERVIEW_TIME_LIMIT_MINUTES = 45

# Aptitude test settings
DEFAULT_TEST_DURATION_MINUTES = 30
QUESTIONS_PER_TEST = 25


class ProfileStatus(str, Enum):
    """Student profile completion status."""
    INCOMPLETE = "INCOMPLETE"
    COMPLETE = "COMPLETE"


# Resume upload settings
ALLOWED_RESUME_EXTENSIONS = ["pdf", "docx"]
MAX_RESUME_SIZE_MB = 5
RESUME_UPLOAD_DIR = "uploads/resumes"
