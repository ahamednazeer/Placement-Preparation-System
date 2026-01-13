"""
SQLAlchemy ORM Models for the Placement Preparation System.
"""
from datetime import datetime
from typing import List, Optional
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    JSON,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, Mapped, mapped_column

from app.infrastructure.database.session import Base
from app.core.constants import (
    UserRole,
    UserStatus,
    AptitudeCategory,
    DifficultyLevel,
    InterviewType,
    PlacementDriveStatus,
    ApplicationStatus,
    CodingLanguage,
    ProfileStatus,
)


class User(Base):
    """User account model."""
    
    __tablename__ = "users"
    
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.STUDENT, nullable=False)
    status: Mapped[UserStatus] = mapped_column(Enum(UserStatus), default=UserStatus.ACTIVE, nullable=False)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Relationships
    student_profile: Mapped[Optional["StudentProfile"]] = relationship(
        "StudentProfile", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    aptitude_attempts: Mapped[List["AptitudeAttempt"]] = relationship(
        "AptitudeAttempt", back_populates="user", cascade="all, delete-orphan"
    )
    interview_sessions: Mapped[List["InterviewSession"]] = relationship(
        "InterviewSession", back_populates="user", cascade="all, delete-orphan"
    )
    coding_attempts: Mapped[List["CodingAttempt"]] = relationship(
        "CodingAttempt", back_populates="user", cascade="all, delete-orphan"
    )
    drive_applications: Mapped[List["DriveApplication"]] = relationship(
        "DriveApplication", back_populates="user", cascade="all, delete-orphan"
    )
    
    def __repr__(self) -> str:
        return f"<User {self.email}>"


class StudentProfile(Base):
    """Student profile with academic and professional info."""
    
    __tablename__ = "student_profiles"
    
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    
    # Student ID
    register_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    
    # Academic Info
    college_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    department: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    degree: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    current_year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # Current year/semester
    graduation_year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    cgpa: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    # Technical Skills - list of skill names
    technical_skills: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, default=list)
    
    # Soft Skills - self-rating (1-5) for each skill
    soft_skills: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, default=dict)
    # Expected format: {"communication": 4, "leadership": 3, "teamwork": 5}
    
    # Career Preferences
    preferred_roles: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, default=list)
    preferred_domains: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, default=list)
    # Domains: IT, Core, Analytics, Finance, etc.
    
    # Professional URLs
    resume_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    linkedin_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    github_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    portfolio_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    # Profile Status
    profile_status: Mapped[ProfileStatus] = mapped_column(
        Enum(ProfileStatus), default=ProfileStatus.INCOMPLETE, nullable=False
    )
    
    # Readiness Scores
    aptitude_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    interview_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    coding_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    overall_readiness: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="student_profile")
    
    def __repr__(self) -> str:
        return f"<StudentProfile user_id={self.user_id}>"


class Resume(Base):
    """Resume file storage model."""
    
    __tablename__ = "resumes"
    
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    student_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # File info
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_type: Mapped[str] = mapped_column(String(10), nullable=False)  # pdf, docx
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    
    # Status & Timestamps
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Note: student_id references users.id, query resumes by student_id directly
    
    def __repr__(self) -> str:
        return f"<Resume {self.id[:8]} - {self.original_filename}>"


class AptitudeQuestion(Base):
    """Aptitude test question model."""
    
    __tablename__ = "aptitude_questions"
    
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    category: Mapped[AptitudeCategory] = mapped_column(Enum(AptitudeCategory), nullable=False, index=True)
    difficulty: Mapped[DifficultyLevel] = mapped_column(Enum(DifficultyLevel), nullable=False, index=True)
    
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    options: Mapped[dict] = mapped_column(JSON, nullable=False)  # {"A": "...", "B": "...", "C": "...", "D": "..."}
    correct_option: Mapped[str] = mapped_column(String(1), nullable=False)  # A, B, C, or D
    explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Metadata
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    def __repr__(self) -> str:
        return f"<AptitudeQuestion {self.id[:8]} - {self.category.value}>"


class AptitudeAttempt(Base):
    """Student's aptitude test attempt."""
    
    __tablename__ = "aptitude_attempts"
    
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Test Info
    category: Mapped[Optional[AptitudeCategory]] = mapped_column(Enum(AptitudeCategory), nullable=True)  # None = mixed
    total_questions: Mapped[int] = mapped_column(Integer, nullable=False)
    correct_answers: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    wrong_answers: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    skipped: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    # Results
    score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)  # Percentage
    time_taken_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    # Answers stored as JSON: {"question_id": {"selected": "A", "is_correct": true}, ...}
    answers: Mapped[dict] = mapped_column(JSON, nullable=True, default=dict)
    
    # Timestamps
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="aptitude_attempts")
    
    def __repr__(self) -> str:
        return f"<AptitudeAttempt {self.id[:8]} - Score: {self.score}%>"


class InterviewSession(Base):
    """AI mock interview session."""
    
    __tablename__ = "interview_sessions"
    
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    interview_type: Mapped[InterviewType] = mapped_column(Enum(InterviewType), nullable=False)
    target_role: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    target_company: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    # Session data stored as JSON array of Q&A
    # [{"question": "...", "answer": "...", "feedback": "...", "score": 8}, ...]
    conversation: Mapped[dict] = mapped_column(JSON, nullable=True, default=list)
    
    # Scores
    overall_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    technical_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    communication_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    confidence_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    # AI Feedback summary
    feedback_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    improvement_areas: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    # Timestamps
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="interview_sessions")
    
    def __repr__(self) -> str:
        return f"<InterviewSession {self.id[:8]} - {self.interview_type.value}>"


class CodingProblem(Base):
    """Coding practice problem."""
    
    __tablename__ = "coding_problems"
    
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    difficulty: Mapped[DifficultyLevel] = mapped_column(Enum(DifficultyLevel), nullable=False, index=True)
    
    # Problem details
    input_format: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    output_format: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    constraints: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Test cases stored as JSON
    # [{"input": "...", "expected_output": "...", "is_sample": true}, ...]
    test_cases: Mapped[dict] = mapped_column(JSON, nullable=False, default=list)
    
    # Tags and metadata
    tags: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, default=list)  # ["arrays", "dp", ...]
    time_limit_ms: Mapped[int] = mapped_column(Integer, default=2000, nullable=False)
    memory_limit_mb: Mapped[int] = mapped_column(Integer, default=256, nullable=False)
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    
    def __repr__(self) -> str:
        return f"<CodingProblem {self.title}>"


class CodingAttempt(Base):
    """Student's coding attempt for a problem."""
    
    __tablename__ = "coding_attempts"
    
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    problem_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("coding_problems.id", ondelete="CASCADE"), nullable=False, index=True)
    
    language: Mapped[CodingLanguage] = mapped_column(Enum(CodingLanguage), nullable=False)
    code: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Results
    is_accepted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    tests_passed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    tests_total: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    execution_time_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    memory_used_mb: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    # Error info
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    submitted_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="coding_attempts")
    problem: Mapped["CodingProblem"] = relationship("CodingProblem")
    
    def __repr__(self) -> str:
        return f"<CodingAttempt {self.id[:8]} - {'Accepted' if self.is_accepted else 'Failed'}>"


class PlacementDrive(Base):
    """Placement drive/company visit."""
    
    __tablename__ = "placement_drives"
    
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    
    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    company_logo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    job_title: Mapped[str] = mapped_column(String(255), nullable=False)
    job_description: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Eligibility criteria
    min_cgpa: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    allowed_departments: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)  # List of departments
    allowed_graduation_years: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)  # List of years
    
    # Package details
    package_lpa: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # Lakhs per annum
    location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    job_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # Full-time, Internship
    
    # Schedule
    registration_deadline: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    drive_date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    
    # Status
    status: Mapped[PlacementDriveStatus] = mapped_column(
        Enum(PlacementDriveStatus), default=PlacementDriveStatus.UPCOMING, nullable=False
    )
    max_applications: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # Metadata
    created_by: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    applications: Mapped[List["DriveApplication"]] = relationship(
        "DriveApplication", back_populates="drive", cascade="all, delete-orphan"
    )
    
    def __repr__(self) -> str:
        return f"<PlacementDrive {self.company_name} - {self.job_title}>"


class DriveApplication(Base):
    """Student's application to a placement drive."""
    
    __tablename__ = "drive_applications"
    
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    drive_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("placement_drives.id", ondelete="CASCADE"), nullable=False, index=True)
    
    status: Mapped[ApplicationStatus] = mapped_column(
        Enum(ApplicationStatus), default=ApplicationStatus.PENDING, nullable=False
    )
    
    # Application data
    resume_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    cover_letter: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Status updates
    status_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    applied_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="drive_applications")
    drive: Mapped["PlacementDrive"] = relationship("PlacementDrive", back_populates="applications")
    
    def __repr__(self) -> str:
        return f"<DriveApplication {self.id[:8]} - {self.status.value}>"


class RefreshToken(Base):
    """Refresh token storage for JWT authentication."""
    
    __tablename__ = "refresh_tokens"
    
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    def __repr__(self) -> str:
        return f"<RefreshToken {self.id[:8]}>"
