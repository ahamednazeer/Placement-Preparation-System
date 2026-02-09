"""
Repository implementation for Placement Drives.
"""
from typing import List, Optional
from uuid import uuid4
from datetime import datetime

from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import PlacementDrive, DriveApplication
from app.core.constants import PlacementDriveStatus, DifficultyLevel


class PlacementDriveRepositoryImpl:
    """Repository for placement drive CRUD operations."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create(
        self,
        company_name: str,
        job_title: str,
        job_description: str,
        registration_deadline: datetime,
        drive_date: datetime,
        created_by: str,
        company_logo_url: Optional[str] = None,
        min_cgpa: Optional[float] = None,
        allowed_departments: Optional[List[str]] = None,
        allowed_graduation_years: Optional[List[int]] = None,
        package_lpa: Optional[float] = None,
        location: Optional[str] = None,
        job_type: Optional[str] = None,
        max_applications: Optional[int] = None,
        aptitude_test_required: bool = False,
        aptitude_question_count: int = 10,
        aptitude_difficulty: Optional[DifficultyLevel] = None,
        aptitude_pass_percentage: float = 60.0,
        technical_test_required: bool = False,
        technical_question_count: int = 10,
        technical_difficulty: Optional[DifficultyLevel] = None,
        technical_pass_percentage: float = 60.0,
    ) -> PlacementDrive:
        """Create a new placement drive."""
        drive = PlacementDrive(
            id=str(uuid4()),
            company_name=company_name,
            job_title=job_title,
            job_description=job_description,
            registration_deadline=registration_deadline,
            drive_date=drive_date,
            created_by=created_by,
            company_logo_url=company_logo_url,
            min_cgpa=min_cgpa,
            allowed_departments=allowed_departments or [],
            allowed_graduation_years=allowed_graduation_years or [],
            package_lpa=package_lpa,
            location=location,
            job_type=job_type,
            max_applications=max_applications,
            aptitude_test_required=aptitude_test_required,
            aptitude_question_count=aptitude_question_count,
            aptitude_difficulty=aptitude_difficulty,
            aptitude_pass_percentage=aptitude_pass_percentage,
            technical_test_required=technical_test_required,
            technical_question_count=technical_question_count,
            technical_difficulty=technical_difficulty,
            technical_pass_percentage=technical_pass_percentage,
            status=PlacementDriveStatus.UPCOMING,
        )
        self.db.add(drive)
        await self.db.commit()
        await self.db.refresh(drive)
        return drive
    
    async def get_by_id(self, drive_id: str) -> Optional[PlacementDrive]:
        """Get drive by ID with applications."""
        result = await self.db.execute(
            select(PlacementDrive)
            .options(selectinload(PlacementDrive.applications))
            .where(PlacementDrive.id == drive_id)
        )
        return result.scalar_one_or_none()
    
    async def list_drives(
        self,
        status: Optional[PlacementDriveStatus] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[PlacementDrive]:
        """List drives with optional filters."""
        query = select(PlacementDrive).options(selectinload(PlacementDrive.applications))
        
        if status:
            query = query.where(PlacementDrive.status == status)
        
        query = query.order_by(PlacementDrive.drive_date.desc()).offset(offset).limit(limit)
        
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    async def count_drives(self, status: Optional[PlacementDriveStatus] = None) -> int:
        """Count drives."""
        query = select(func.count(PlacementDrive.id))
        if status:
            query = query.where(PlacementDrive.status == status)
        result = await self.db.execute(query)
        return result.scalar() or 0
    
    async def update(
        self,
        drive_id: str,
        company_name: Optional[str] = None,
        job_title: Optional[str] = None,
        job_description: Optional[str] = None,
        registration_deadline: Optional[datetime] = None,
        drive_date: Optional[datetime] = None,
        company_logo_url: Optional[str] = None,
        min_cgpa: Optional[float] = None,
        allowed_departments: Optional[List[str]] = None,
        allowed_graduation_years: Optional[List[int]] = None,
        package_lpa: Optional[float] = None,
        location: Optional[str] = None,
        job_type: Optional[str] = None,
        max_applications: Optional[int] = None,
        aptitude_test_required: Optional[bool] = None,
        aptitude_question_count: Optional[int] = None,
        aptitude_difficulty: Optional[DifficultyLevel] = None,
        aptitude_pass_percentage: Optional[float] = None,
        technical_test_required: Optional[bool] = None,
        technical_question_count: Optional[int] = None,
        technical_difficulty: Optional[DifficultyLevel] = None,
        technical_pass_percentage: Optional[float] = None,
        status: Optional[PlacementDriveStatus] = None,
    ) -> Optional[PlacementDrive]:
        """Update a drive."""
        drive = await self.get_by_id(drive_id)
        if not drive:
            return None
        
        if company_name is not None: drive.company_name = company_name
        if job_title is not None: drive.job_title = job_title
        if job_description is not None: drive.job_description = job_description
        if registration_deadline is not None: drive.registration_deadline = registration_deadline
        if drive_date is not None: drive.drive_date = drive_date
        if company_logo_url is not None: drive.company_logo_url = company_logo_url
        if min_cgpa is not None: drive.min_cgpa = min_cgpa
        if allowed_departments is not None: drive.allowed_departments = allowed_departments
        if allowed_graduation_years is not None: drive.allowed_graduation_years = allowed_graduation_years
        if package_lpa is not None: drive.package_lpa = package_lpa
        if location is not None: drive.location = location
        if job_type is not None: drive.job_type = job_type
        if max_applications is not None: drive.max_applications = max_applications
        if aptitude_test_required is not None: drive.aptitude_test_required = aptitude_test_required
        if aptitude_question_count is not None: drive.aptitude_question_count = aptitude_question_count
        if aptitude_difficulty is not None: drive.aptitude_difficulty = aptitude_difficulty
        if aptitude_pass_percentage is not None: drive.aptitude_pass_percentage = aptitude_pass_percentage
        if technical_test_required is not None: drive.technical_test_required = technical_test_required
        if technical_question_count is not None: drive.technical_question_count = technical_question_count
        if technical_difficulty is not None: drive.technical_difficulty = technical_difficulty
        if technical_pass_percentage is not None: drive.technical_pass_percentage = technical_pass_percentage
        if status is not None: drive.status = status
        
        await self.db.commit()
        await self.db.refresh(drive)
        return drive
    
    async def delete(self, drive_id: str) -> bool:
        """Delete a drive."""
        drive = await self.get_by_id(drive_id)
        if not drive:
            return False
        await self.db.delete(drive)
        await self.db.commit()
        return True
    
    async def get_stats(self) -> dict:
        """Get drive statistics."""
        stats = {}
        for status in PlacementDriveStatus:
            count = await self.count_drives(status=status)
            stats[status.value] = count
        total = await self.count_drives()
        return {"total": total, "by_status": stats}
