"""
Resume analysis repository implementation.
"""
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import ResumeAnalysis


class ResumeAnalysisRepositoryImpl:
    """SQLAlchemy implementation for resume analysis storage."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create(
        self,
        student_id: str,
        resume_id: Optional[str],
        preferred_role: Optional[str],
        resume_score: float,
        skill_match_score: float,
        ats_score: float,
        content_score: float,
        project_score: float,
        extracted_skills: list,
        missing_skills: list,
        suggestions: list,
        structured_data: dict,
    ) -> ResumeAnalysis:
        """Create a resume analysis record."""
        analysis = ResumeAnalysis(
            student_id=student_id,
            resume_id=resume_id,
            preferred_role=preferred_role,
            resume_score=resume_score,
            skill_match_score=skill_match_score,
            ats_score=ats_score,
            content_score=content_score,
            project_score=project_score,
            extracted_skills=extracted_skills,
            missing_skills=missing_skills,
            suggestions=suggestions,
            structured_data=structured_data,
        )
        self.session.add(analysis)
        await self.session.flush()
        await self.session.refresh(analysis)
        return analysis
    
    async def get_latest_by_student_id(self, student_id: str) -> Optional[ResumeAnalysis]:
        """Get the latest resume analysis for a student."""
        result = await self.session.execute(
            select(ResumeAnalysis)
            .where(ResumeAnalysis.student_id == student_id)
            .order_by(ResumeAnalysis.analyzed_at.desc())
        )
        return result.scalar_one_or_none()
