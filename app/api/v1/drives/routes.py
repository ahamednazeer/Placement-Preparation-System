"""
API routes for Placement Drives management.
"""
from typing import Optional
from math import ceil

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.session import get_db_session
from app.dependencies import get_current_user
from app.infrastructure.database.models import User
from app.application.services.placement_drive_service import PlacementDriveService
from app.core.constants import UserRole, PlacementDriveStatus
from app.api.v1.drives.schemas import (
    DriveCreate,
    DriveUpdate,
    DriveResponse,
    DriveListResponse,
    DriveStatsResponse,
    ApplicationCreate,
    ApplicationStatusUpdate,
    ApplicantResponse,
    MyApplicationResponse,
)

router = APIRouter(prefix="/drives", tags=["Placement Drives"])


# Dependency for officer/admin only
async def officer_or_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in [UserRole.PLACEMENT_OFFICER, UserRole.ADMIN]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Officers only")
    return current_user


@router.post("", response_model=DriveResponse, status_code=status.HTTP_201_CREATED)
async def create_drive(
    data: DriveCreate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(officer_or_admin),
):
    """Create a new placement drive (Officer only)."""
    service = PlacementDriveService(db)
    try:
        drive = await service.create_drive(
            company_name=data.company_name,
            job_title=data.job_title,
            job_description=data.job_description,
            registration_deadline=data.registration_deadline,
            drive_date=data.drive_date,
            created_by=current_user.id,
            company_logo_url=data.company_logo_url,
            min_cgpa=data.min_cgpa,
            allowed_departments=data.allowed_departments,
            allowed_graduation_years=data.allowed_graduation_years,
            package_lpa=data.package_lpa,
            location=data.location,
            job_type=data.job_type,
            max_applications=data.max_applications,
        )
        return DriveResponse.from_model(drive)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=DriveListResponse)
async def list_drives(
    status_filter: Optional[PlacementDriveStatus] = None,
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """List placement drives."""
    service = PlacementDriveService(db)
    st = status_filter.value if status_filter else None
    drives, total = await service.list_drives(status=st, page=page, page_size=page_size)
    
    return DriveListResponse(
        drives=[DriveResponse.from_model(d) for d in drives],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/stats", response_model=DriveStatsResponse)
async def get_drive_stats(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(officer_or_admin),
):
    """Get drive statistics (Officer only)."""
    service = PlacementDriveService(db)
    stats = await service.get_stats()
    return DriveStatsResponse(**stats)


@router.get("/my-applications", response_model=list)
async def get_my_applications(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """Get current user's applications (Student)."""
    service = PlacementDriveService(db)
    apps = await service.get_my_applications(current_user.id)
    return [MyApplicationResponse.from_model(a) for a in apps]


@router.get("/{drive_id}", response_model=DriveResponse)
async def get_drive(
    drive_id: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """Get drive details."""
    service = PlacementDriveService(db)
    drive = await service.get_drive(drive_id)
    if not drive:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Drive not found")
    return DriveResponse.from_model(drive)


@router.put("/{drive_id}", response_model=DriveResponse)
async def update_drive(
    drive_id: str,
    data: DriveUpdate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(officer_or_admin),
):
    """Update a placement drive (Officer only)."""
    service = PlacementDriveService(db)
    update_data = data.model_dump(exclude_unset=True)
    drive = await service.update_drive(drive_id, **update_data)
    if not drive:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Drive not found")
    return DriveResponse.from_model(drive)


@router.delete("/{drive_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_drive(
    drive_id: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(officer_or_admin),
):
    """Delete a placement drive (Officer only)."""
    service = PlacementDriveService(db)
    deleted = await service.delete_drive(drive_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Drive not found")


@router.post("/{drive_id}/apply", response_model=MyApplicationResponse)
async def apply_to_drive(
    drive_id: str,
    data: ApplicationCreate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """Apply to a placement drive (Student)."""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Students only")
    
    service = PlacementDriveService(db)
    try:
        app = await service.apply_to_drive(
            user_id=current_user.id,
            drive_id=drive_id,
            resume_url=data.resume_url,
            cover_letter=data.cover_letter,
        )
        # Refresh to get drive info
        from app.infrastructure.repositories.drive_application_repo_impl import DriveApplicationRepositoryImpl
        repo = DriveApplicationRepositoryImpl(db)
        app = await repo.get_by_id(app.id)
        return MyApplicationResponse.from_model(app)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{drive_id}/applicants", response_model=list)
async def get_drive_applicants(
    drive_id: str,
    status_filter: Optional[str] = None,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(officer_or_admin),
):
    """Get all applicants for a drive (Officer only)."""
    service = PlacementDriveService(db)
    apps = await service.get_drive_applicants(drive_id, status=status_filter)
    return [ApplicantResponse.from_model(a) for a in apps]


@router.put("/{drive_id}/applicants/{application_id}", response_model=ApplicantResponse)
async def update_application_status(
    drive_id: str,
    application_id: str,
    data: ApplicationStatusUpdate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(officer_or_admin),
):
    """Update application status (Officer only)."""
    service = PlacementDriveService(db)
    app = await service.update_application_status(
        application_id=application_id,
        status=data.status.value,
        status_notes=data.status_notes,
    )
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
    return ApplicantResponse.from_model(app)


@router.delete("/applications/{application_id}", status_code=status.HTTP_204_NO_CONTENT)
async def withdraw_application(
    application_id: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """Withdraw an application (Student only for own applications)."""
    service = PlacementDriveService(db)
    deleted = await service.withdraw_application(application_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
