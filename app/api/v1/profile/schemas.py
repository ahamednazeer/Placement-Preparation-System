"""
Profile API Pydantic schemas.
"""
from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, Field, field_validator


# ============ Request Schemas ============

class SoftSkillsSchema(BaseModel):
    """Soft skills self-rating schema."""
    
    communication: Optional[int] = Field(None, ge=1, le=5, description="Communication skill rating (1-5)")
    leadership: Optional[int] = Field(None, ge=1, le=5, description="Leadership skill rating (1-5)")
    teamwork: Optional[int] = Field(None, ge=1, le=5, description="Teamwork skill rating (1-5)")
    problem_solving: Optional[int] = Field(None, ge=1, le=5, description="Problem solving rating (1-5)")
    adaptability: Optional[int] = Field(None, ge=1, le=5, description="Adaptability rating (1-5)")
    
    def to_dict(self) -> Dict[str, int]:
        """Convert to dictionary, excluding None values."""
        return {k: v for k, v in self.model_dump().items() if v is not None}


class ProfileUpdateRequest(BaseModel):
    """Profile update request schema."""
    
    register_number: Optional[str] = Field(None, max_length=50, description="Student ID / Register Number")
    college_name: Optional[str] = Field(None, max_length=255, description="College/University name")
    department: Optional[str] = Field(None, max_length=100, description="Department / Branch")
    degree: Optional[str] = Field(None, max_length=100, description="Degree (B.E, B.Tech, MCA, etc.)")
    current_year: Optional[int] = Field(None, ge=1, le=8, description="Current year/semester")
    graduation_year: Optional[int] = Field(None, ge=2020, le=2035, description="Expected graduation year")
    cgpa: Optional[float] = Field(None, ge=0, le=10, description="CGPA (0-10 scale)")
    
    technical_skills: Optional[List[str]] = Field(None, description="List of technical skills")
    soft_skills: Optional[SoftSkillsSchema] = Field(None, description="Soft skills self-rating")
    
    preferred_roles: Optional[List[str]] = Field(None, description="Preferred job roles")
    preferred_domains: Optional[List[str]] = Field(None, description="Preferred domains (IT, Core, Analytics)")
    
    linkedin_url: Optional[str] = Field(None, max_length=500, description="LinkedIn profile URL")
    github_url: Optional[str] = Field(None, max_length=500, description="GitHub profile URL")
    portfolio_url: Optional[str] = Field(None, max_length=500, description="Portfolio website URL")
    
    @field_validator("technical_skills", mode="before")
    @classmethod
    def validate_skills(cls, v):
        if v is None:
            return v
        # Filter empty strings and limit
        skills = [s.strip() for s in v if s and s.strip()][:50]
        return skills
    
    @field_validator("preferred_roles", "preferred_domains", mode="before")
    @classmethod
    def validate_list_fields(cls, v):
        if v is None:
            return v
        return [s.strip() for s in v if s and s.strip()][:20]


class AddSkillRequest(BaseModel):
    """Request to add a technical skill."""
    
    skill: str = Field(..., min_length=1, max_length=100, description="Skill name to add")


class RemoveSkillRequest(BaseModel):
    """Request to remove a technical skill."""
    
    skill: str = Field(..., min_length=1, max_length=100, description="Skill name to remove")


# ============ Response Schemas ============

class ProfileResponse(BaseModel):
    """Full profile response."""
    
    id: str
    user_id: str
    register_number: Optional[str] = None
    college_name: Optional[str] = None
    department: Optional[str] = None
    degree: Optional[str] = None
    current_year: Optional[int] = None
    graduation_year: Optional[int] = None
    cgpa: Optional[float] = None
    
    technical_skills: List[str] = []
    soft_skills: Dict[str, int] = {}
    preferred_roles: List[str] = []
    preferred_domains: List[str] = []
    
    resume_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    
    profile_status: str
    aptitude_score: float = 0.0
    interview_score: float = 0.0
    coding_score: float = 0.0
    overall_readiness: float = 0.0
    
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True


class ProfileStatusResponse(BaseModel):
    """Profile completion status response."""
    
    is_complete: bool
    status: str
    missing_required: List[str] = []
    missing_optional: List[str] = []
    completion_percentage: float


class ResumeResponse(BaseModel):
    """Resume information response."""
    
    id: str
    original_filename: str
    file_type: str
    file_size_bytes: int
    file_size_mb: float
    uploaded_at: str
    download_url: str


class ResumeUploadResponse(BaseModel):
    """Resume upload result response."""
    
    success: bool
    message: str
    resume: Optional[ResumeResponse] = None


class MessageResponse(BaseModel):
    """Generic message response."""
    
    message: str
    success: bool = True
