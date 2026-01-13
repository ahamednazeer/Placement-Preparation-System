"""
Service layer for Placement Drive management.
"""
from typing import List, Optional, Tuple
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.repositories.placement_drive_repo_impl import PlacementDriveRepositoryImpl
from app.infrastructure.repositories.drive_application_repo_impl import DriveApplicationRepositoryImpl
from app.infrastructure.database.models import PlacementDrive, DriveApplication, StudentProfile
from app.core.constants import PlacementDriveStatus, ApplicationStatus
from app.utils.helpers import to_naive_utc


class PlacementDriveService:
    """Business logic for placement drive management."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.drive_repo = PlacementDriveRepositoryImpl(db)
        self.app_repo = DriveApplicationRepositoryImpl(db)
    
    async def create_drive(
        self,
        company_name: str,
        job_title: str,
        job_description: str,
        registration_deadline: datetime,
        drive_date: datetime,
        created_by: str,
        **kwargs
    ) -> PlacementDrive:
        """Create a new placement drive."""
        # Normalize to naive UTC to satisfy asyncpg/Postgres
        registration_deadline = to_naive_utc(registration_deadline)
        drive_date = to_naive_utc(drive_date)

        if registration_deadline >= drive_date:
            raise ValueError("Registration deadline must be before drive date")
        
        return await self.drive_repo.create(
            company_name=company_name,
            job_title=job_title,
            job_description=job_description,
            registration_deadline=registration_deadline,
            drive_date=drive_date,
            created_by=created_by,
            **kwargs
        )
    
    async def get_drive(self, drive_id: str) -> Optional[PlacementDrive]:
        """Get drive by ID."""
        return await self.drive_repo.get_by_id(drive_id)
    
    async def list_drives(
        self,
        status: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[List[PlacementDrive], int]:
        """List drives with pagination."""
        st = PlacementDriveStatus(status) if status else None
        offset = (page - 1) * page_size
        drives = await self.drive_repo.list_drives(status=st, limit=page_size, offset=offset)
        total = await self.drive_repo.count_drives(status=st)
        return drives, total
    
    async def update_drive(self, drive_id: str, **kwargs) -> Optional[PlacementDrive]:
        """Update a drive."""
        drive = await self.get_drive(drive_id)
        if not drive:
            return None
            
        # Validate dates if being updated
        reg_dl = kwargs.get('registration_deadline', drive.registration_deadline)
        d_date = kwargs.get('drive_date', drive.drive_date)
        
        # Normalize to naive UTC
        if 'registration_deadline' in kwargs:
            kwargs['registration_deadline'] = to_naive_utc(kwargs['registration_deadline'])
            reg_dl = kwargs['registration_deadline']
        if 'drive_date' in kwargs:
            kwargs['drive_date'] = to_naive_utc(kwargs['drive_date'])
            d_date = kwargs['drive_date']
        
        if reg_dl >= d_date:
            raise ValueError("Registration deadline must be before drive date")
            
        return await self.drive_repo.update(drive_id, **kwargs)
    
    async def delete_drive(self, drive_id: str) -> bool:
        """Delete a drive."""
        return await self.drive_repo.delete(drive_id)
    
    async def get_stats(self) -> dict:
        """Get drive statistics."""
        return await self.drive_repo.get_stats()
    
    def check_eligibility(self, drive: PlacementDrive, profile: StudentProfile) -> Tuple[bool, str]:
        """Check if student is eligible for a drive."""
        # Check CGPA
        if drive.min_cgpa and profile.cgpa:
            if profile.cgpa < drive.min_cgpa:
                return False, f"Minimum CGPA required: {drive.min_cgpa}"
        
        # Check department
        if drive.allowed_departments and profile.department:
            if profile.department not in drive.allowed_departments:
                return False, f"Not open to {profile.department} department"
        
        # Check graduation year
        if drive.allowed_graduation_years and profile.graduation_year:
            if profile.graduation_year not in drive.allowed_graduation_years:
                return False, f"Not open to {profile.graduation_year} batch"
        
        return True, "Eligible"
    
    async def apply_to_drive(
        self,
        user_id: str,
        drive_id: str,
        resume_url: Optional[str] = None,
        cover_letter: Optional[str] = None,
    ) -> DriveApplication:
        """Apply to a placement drive."""
        drive = await self.drive_repo.get_by_id(drive_id)
        if not drive:
            raise ValueError("Drive not found")
        
        # Check registration deadline
        if datetime.utcnow() > drive.registration_deadline:
            raise ValueError("Registration deadline has passed")
        
        # Check if already applied
        existing = await self.app_repo.get_by_user_and_drive(user_id, drive_id)
        if existing:
            raise ValueError("Already applied to this drive")
        
        # Check max applications
        if drive.max_applications:
            count = await self.app_repo.count_by_drive(drive_id)
            if count >= drive.max_applications:
                raise ValueError("Maximum applications reached")
        
        return await self.app_repo.create(
            user_id=user_id,
            drive_id=drive_id,
            resume_url=resume_url,
            cover_letter=cover_letter,
        )
    
    async def get_drive_applicants(
        self,
        drive_id: str,
        status: Optional[str] = None,
    ) -> List[DriveApplication]:
        """Get all applicants for a drive."""
        st = ApplicationStatus(status) if status else None
        return await self.app_repo.list_by_drive(drive_id, status=st)
    
    async def get_my_applications(self, user_id: str) -> List[DriveApplication]:
        """Get all applications by a user."""
        return await self.app_repo.list_by_user(user_id)
    
    async def update_application_status(
        self,
        application_id: str,
        status: str,
        status_notes: Optional[str] = None,
    ) -> Optional[DriveApplication]:
        """Update application status."""
        st = ApplicationStatus(status)
        return await self.app_repo.update_status(application_id, st, status_notes)
    
    async def withdraw_application(self, application_id: str, user_id: str) -> bool:
        """Withdraw an application (student only for their own)."""
        app = await self.app_repo.get_by_id(application_id)
        if not app or app.user_id != user_id:
            return False
        return await self.app_repo.delete(application_id)
