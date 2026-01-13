"""
Repository implementation for Drive Applications.
"""
from typing import List, Optional
from uuid import uuid4

from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import DriveApplication, PlacementDrive, User
from app.core.constants import ApplicationStatus


class DriveApplicationRepositoryImpl:
    """Repository for drive application operations."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create(
        self,
        user_id: str,
        drive_id: str,
        resume_url: Optional[str] = None,
        cover_letter: Optional[str] = None,
    ) -> DriveApplication:
        """Create a new application."""
        application = DriveApplication(
            id=str(uuid4()),
            user_id=user_id,
            drive_id=drive_id,
            resume_url=resume_url,
            cover_letter=cover_letter,
            status=ApplicationStatus.PENDING,
        )
        self.db.add(application)
        await self.db.commit()
        await self.db.refresh(application)
        return application
    
    async def get_by_id(self, application_id: str) -> Optional[DriveApplication]:
        """Get application by ID."""
        result = await self.db.execute(
            select(DriveApplication)
            .options(selectinload(DriveApplication.user), selectinload(DriveApplication.drive))
            .where(DriveApplication.id == application_id)
        )
        return result.scalar_one_or_none()
    
    async def get_by_user_and_drive(self, user_id: str, drive_id: str) -> Optional[DriveApplication]:
        """Check if user already applied to drive."""
        result = await self.db.execute(
            select(DriveApplication).where(
                and_(DriveApplication.user_id == user_id, DriveApplication.drive_id == drive_id)
            )
        )
        return result.scalar_one_or_none()
    
    async def list_by_drive(
        self,
        drive_id: str,
        status: Optional[ApplicationStatus] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[DriveApplication]:
        """List applications for a drive."""
        query = (
            select(DriveApplication)
            .options(selectinload(DriveApplication.user))
            .where(DriveApplication.drive_id == drive_id)
        )
        
        if status:
            query = query.where(DriveApplication.status == status)
        
        query = query.order_by(DriveApplication.applied_at.desc()).offset(offset).limit(limit)
        
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    async def list_by_user(self, user_id: str) -> List[DriveApplication]:
        """List all applications by a user."""
        result = await self.db.execute(
            select(DriveApplication)
            .options(selectinload(DriveApplication.drive))
            .where(DriveApplication.user_id == user_id)
            .order_by(DriveApplication.applied_at.desc())
        )
        return list(result.scalars().all())
    
    async def count_by_drive(self, drive_id: str, status: Optional[ApplicationStatus] = None) -> int:
        """Count applications for a drive."""
        query = select(func.count(DriveApplication.id)).where(DriveApplication.drive_id == drive_id)
        if status:
            query = query.where(DriveApplication.status == status)
        result = await self.db.execute(query)
        return result.scalar() or 0
    
    async def update_status(
        self,
        application_id: str,
        status: ApplicationStatus,
        status_notes: Optional[str] = None,
    ) -> Optional[DriveApplication]:
        """Update application status."""
        app = await self.get_by_id(application_id)
        if not app:
            return None
        
        app.status = status
        if status_notes is not None:
            app.status_notes = status_notes
        
        await self.db.commit()
        await self.db.refresh(app)
        return app
    
    async def delete(self, application_id: str) -> bool:
        """Delete/withdraw an application."""
        app = await self.get_by_id(application_id)
        if not app:
            return False
        await self.db.delete(app)
        await self.db.commit()
        return True
