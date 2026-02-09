"""
Student Profile service.
Handles profile business logic.
"""
from typing import Optional, Dict, Any, List

from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.repositories.profile_repo_impl import ProfileRepositoryImpl
from app.infrastructure.database.models import StudentProfile
from app.core.constants import ProfileStatus
from app.utils.logger import logger


class ProfileService:
    """Profile business logic service."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.profile_repo = ProfileRepositoryImpl(session)
    
    async def get_profile(self, user_id: str) -> Optional[StudentProfile]:
        """Get a user's profile."""
        return await self.profile_repo.get_by_user_id(user_id)
    
    async def get_profile_dict(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get profile as dictionary for API response."""
        profile = await self.profile_repo.get_by_user_id(user_id)
        if not profile:
            # Create a profile if missing (legacy users or inconsistent data)
            profile = await self.profile_repo.create(user_id)
        
        return {
            "id": profile.id,
            "user_id": profile.user_id,
            "register_number": profile.register_number,
            "college_name": profile.college_name,
            "department": profile.department,
            "degree": profile.degree,
            "current_year": profile.current_year,
            "graduation_year": profile.graduation_year,
            "cgpa": profile.cgpa,
            "technical_skills": profile.technical_skills or [],
            "soft_skills": profile.soft_skills or {},
            "preferred_roles": profile.preferred_roles or [],
            "preferred_domains": profile.preferred_domains or [],
            "resume_url": profile.resume_url,
            "linkedin_url": profile.linkedin_url,
            "github_url": profile.github_url,
            "portfolio_url": profile.portfolio_url,
            "profile_status": profile.profile_status.value,
            "aptitude_score": profile.aptitude_score,
            "interview_score": profile.interview_score,
            "coding_score": profile.coding_score,
            "overall_readiness": profile.overall_readiness,
            "created_at": profile.created_at.isoformat(),
            "updated_at": profile.updated_at.isoformat(),
        }
    
    async def update_profile(
        self,
        user_id: str,
        register_number: Optional[str] = None,
        college_name: Optional[str] = None,
        department: Optional[str] = None,
        degree: Optional[str] = None,
        current_year: Optional[int] = None,
        graduation_year: Optional[int] = None,
        cgpa: Optional[float] = None,
        technical_skills: Optional[List[str]] = None,
        soft_skills: Optional[Dict[str, int]] = None,
        preferred_roles: Optional[List[str]] = None,
        preferred_domains: Optional[List[str]] = None,
        linkedin_url: Optional[str] = None,
        github_url: Optional[str] = None,
        portfolio_url: Optional[str] = None,
    ) -> Optional[StudentProfile]:
        """Update profile with provided fields."""
        # Ensure profile exists (handles legacy users without a profile row)
        profile = await self.profile_repo.get_by_user_id(user_id)
        if not profile:
            await self.profile_repo.create(user_id)
        
        # Build update dict from provided values
        update_data = {}
        
        if register_number is not None:
            update_data['register_number'] = register_number.strip()
        if college_name is not None:
            update_data['college_name'] = college_name.strip()
        if department is not None:
            update_data['department'] = department.strip()
        if degree is not None:
            update_data['degree'] = degree.strip()
        if current_year is not None:
            update_data['current_year'] = current_year
        if graduation_year is not None:
            update_data['graduation_year'] = graduation_year
        if cgpa is not None:
            # Validate CGPA range
            if cgpa < 0 or cgpa > 10:
                raise ValueError("CGPA must be between 0 and 10")
            update_data['cgpa'] = round(cgpa, 2)
        if technical_skills is not None:
            update_data['technical_skills'] = [s.strip().lower() for s in technical_skills if s.strip()]
        if soft_skills is not None:
            # Validate soft skill ratings (1-5)
            validated_soft_skills = {}
            for skill, rating in soft_skills.items():
                if 1 <= rating <= 5:
                    validated_soft_skills[skill.lower()] = rating
            update_data['soft_skills'] = validated_soft_skills
        if preferred_roles is not None:
            update_data['preferred_roles'] = [r.strip() for r in preferred_roles if r.strip()]
        if preferred_domains is not None:
            update_data['preferred_domains'] = [d.strip() for d in preferred_domains if d.strip()]
        if linkedin_url is not None:
            update_data['linkedin_url'] = linkedin_url.strip() or None
        if github_url is not None:
            update_data['github_url'] = github_url.strip() or None
        if portfolio_url is not None:
            update_data['portfolio_url'] = portfolio_url.strip() or None
        
        profile = await self.profile_repo.update(user_id, **update_data)
        
        if profile:
            # Check and update completion status
            await self._update_completion_status(user_id)
            logger.info(f"Profile updated for user: {user_id}")
        
        return profile
    
    async def get_profile_status(self, user_id: str) -> Dict[str, Any]:
        """Get profile completion status."""
        return await self.profile_repo.check_profile_completion(user_id)
    
    async def _update_completion_status(self, user_id: str) -> None:
        """Update profile completion status based on current data."""
        status_info = await self.profile_repo.check_profile_completion(user_id)
        new_status = status_info['status']
        
        await self.profile_repo.update_status(user_id, new_status)
    
    async def add_technical_skill(self, user_id: str, skill: str) -> Optional[StudentProfile]:
        """Add a technical skill to the profile."""
        profile = await self.profile_repo.get_by_user_id(user_id)
        if not profile:
            return None
        
        skills = list(profile.technical_skills or [])
        skill = skill.strip().lower()
        
        if skill and skill not in skills:
            skills.append(skill)
            return await self.profile_repo.update(user_id, technical_skills=skills)
        
        return profile
    
    async def remove_technical_skill(self, user_id: str, skill: str) -> Optional[StudentProfile]:
        """Remove a technical skill from the profile."""
        profile = await self.profile_repo.get_by_user_id(user_id)
        if not profile:
            return None
        
        skills = list(profile.technical_skills or [])
        skill = skill.strip().lower()
        
        if skill in skills:
            skills.remove(skill)
            return await self.profile_repo.update(user_id, technical_skills=skills)
        
        return profile
    
    async def update_resume_url(self, user_id: str, resume_url: Optional[str]) -> bool:
        """Update the resume URL in profile."""
        success = await self.profile_repo.update_resume_url(user_id, resume_url)
        if success:
            await self._update_completion_status(user_id)
        return success
