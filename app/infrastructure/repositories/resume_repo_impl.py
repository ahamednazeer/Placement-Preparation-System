"""
Resume repository implementation.
"""
from datetime import datetime
from typing import List, Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import Resume


class ResumeRepositoryImpl:
    """SQLAlchemy implementation of resume repository."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create(
        self,
        student_id: str,
        file_path: str,
        file_type: str,
        original_filename: str,
        file_size_bytes: int,
    ) -> Resume:
        """Create a new resume record."""
        resume = Resume(
            student_id=student_id,
            file_path=file_path,
            file_type=file_type,
            original_filename=original_filename,
            file_size_bytes=file_size_bytes,
            is_active=True,
        )
        self.session.add(resume)
        await self.session.flush()
        await self.session.refresh(resume)
        return resume
    
    async def get_by_id(self, resume_id: str) -> Optional[Resume]:
        """Get resume by ID."""
        result = await self.session.execute(
            select(Resume).where(Resume.id == resume_id)
        )
        return result.scalar_one_or_none()
    
    async def get_active_by_student_id(self, student_id: str) -> Optional[Resume]:
        """Get the active resume for a student."""
        result = await self.session.execute(
            select(Resume)
            .where(Resume.student_id == student_id, Resume.is_active == True)
            .order_by(Resume.uploaded_at.desc())
        )
        return result.scalar_one_or_none()
    
    async def get_all_by_student_id(self, student_id: str) -> List[Resume]:
        """Get all resumes for a student (history)."""
        result = await self.session.execute(
            select(Resume)
            .where(Resume.student_id == student_id)
            .order_by(Resume.uploaded_at.desc())
        )
        return list(result.scalars().all())
    
    async def deactivate_all_for_student(self, student_id: str) -> int:
        """Deactivate all resumes for a student (before uploading new one)."""
        result = await self.session.execute(
            update(Resume)
            .where(Resume.student_id == student_id, Resume.is_active == True)
            .values(is_active=False)
        )
        return result.rowcount
    
    async def delete(self, resume_id: str) -> bool:
        """Delete a resume record."""
        result = await self.session.execute(
            select(Resume).where(Resume.id == resume_id)
        )
        resume = result.scalar_one_or_none()
        if resume:
            await self.session.delete(resume)
            return True
        return False
    
    async def soft_delete(self, resume_id: str) -> bool:
        """Soft delete a resume by marking it inactive."""
        result = await self.session.execute(
            update(Resume)
            .where(Resume.id == resume_id)
            .values(is_active=False)
        )
        return result.rowcount > 0
