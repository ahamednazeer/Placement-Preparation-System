"""
Student Profile repository implementation.
"""
from datetime import datetime
from typing import Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import StudentProfile, Resume
from app.core.constants import ProfileStatus


class ProfileRepositoryImpl:
    """SQLAlchemy implementation of profile repository."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def get_by_user_id(self, user_id: str) -> Optional[StudentProfile]:
        """Get profile by user ID."""
        result = await self.session.execute(
            select(StudentProfile)
            .where(StudentProfile.user_id == user_id)
        )
        return result.scalar_one_or_none()
    
    async def create(self, user_id: str) -> StudentProfile:
        """Create a new profile for a user."""
        profile = StudentProfile(user_id=user_id)
        self.session.add(profile)
        await self.session.flush()
        await self.session.refresh(profile)
        return profile
    
    async def update(self, user_id: str, **kwargs) -> Optional[StudentProfile]:
        """Update profile fields."""
        # Filter out None values and invalid fields
        valid_fields = {
            'register_number', 'college_name', 'department', 'degree',
            'current_year', 'graduation_year', 'cgpa', 'technical_skills',
            'soft_skills', 'preferred_roles', 'preferred_domains',
            'resume_url', 'linkedin_url', 'github_url', 'portfolio_url',
            'profile_status'
        }
        
        update_data = {k: v for k, v in kwargs.items() if k in valid_fields}
        
        if not update_data:
            return await self.get_by_user_id(user_id)
        
        update_data['updated_at'] = datetime.utcnow()
        
        await self.session.execute(
            update(StudentProfile)
            .where(StudentProfile.user_id == user_id)
            .values(**update_data)
        )
        
        return await self.get_by_user_id(user_id)
    
    async def update_status(self, user_id: str, status: ProfileStatus) -> bool:
        """Update profile completion status."""
        result = await self.session.execute(
            update(StudentProfile)
            .where(StudentProfile.user_id == user_id)
            .values(profile_status=status, updated_at=datetime.utcnow())
        )
        return result.rowcount > 0
    
    async def update_resume_url(self, user_id: str, resume_url: Optional[str]) -> bool:
        """Update resume URL in profile."""
        result = await self.session.execute(
            update(StudentProfile)
            .where(StudentProfile.user_id == user_id)
            .values(resume_url=resume_url, updated_at=datetime.utcnow())
        )
        return result.rowcount > 0
    
    async def update_interview_score(self, user_id: str, score: float) -> bool:
        """Update interview score in profile."""
        result = await self.session.execute(
            update(StudentProfile)
            .where(StudentProfile.user_id == user_id)
            .values(interview_score=score, updated_at=datetime.utcnow())
        )
        await self.session.commit()
        return result.rowcount > 0
    
    async def check_profile_completion(self, user_id: str) -> dict:
        """Check if profile is complete and return status details."""
        profile = await self.get_by_user_id(user_id)
        
        if not profile:
            return {
                "is_complete": False,
                "status": ProfileStatus.INCOMPLETE,
                "missing_fields": ["profile"],
                "completion_percentage": 0
            }
        
        # Define required fields for completion
        required_fields = {
            "register_number": profile.register_number,
            "college_name": profile.college_name,
            "department": profile.department,
            "degree": profile.degree,
            "current_year": profile.current_year,
            "graduation_year": profile.graduation_year,
            "cgpa": profile.cgpa,
        }
        
        # Optional but recommended fields
        optional_fields = {
            "technical_skills": profile.technical_skills and len(profile.technical_skills) > 0,
            "soft_skills": profile.soft_skills and len(profile.soft_skills) > 0,
            "preferred_roles": profile.preferred_roles and len(profile.preferred_roles) > 0,
            "resume": profile.resume_url is not None,
        }
        
        # Check missing required fields
        missing_required = [k for k, v in required_fields.items() if v is None]
        missing_optional = [k for k, v in optional_fields.items() if not v]
        
        # Calculate completion percentage
        total_required = len(required_fields)
        filled_required = total_required - len(missing_required)
        total_optional = len(optional_fields)
        filled_optional = total_optional - len(missing_optional)
        
        # Required fields count 70%, optional 30%
        completion = (filled_required / total_required * 70) + (filled_optional / total_optional * 30)
        
        is_complete = len(missing_required) == 0 and profile.resume_url is not None
        
        return {
            "is_complete": is_complete,
            "status": ProfileStatus.COMPLETE if is_complete else ProfileStatus.INCOMPLETE,
            "missing_required": missing_required,
            "missing_optional": missing_optional,
            "completion_percentage": round(completion, 1)
        }
