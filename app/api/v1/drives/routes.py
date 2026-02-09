"""
API routes for Placement Drives management.
"""
from typing import Optional
from math import ceil
import io
import re

from fastapi import APIRouter, Depends, HTTPException, status, Response
from openpyxl import Workbook
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.session import get_db_session
from app.dependencies import get_current_user
from app.infrastructure.database.models import User
from app.infrastructure.repositories.drive_application_repo_impl import DriveApplicationRepositoryImpl
from app.application.services.placement_drive_service import PlacementDriveService
from app.application.services.aptitude_attempt_service import AptitudeAttemptService
from app.core.constants import (
    UserRole,
    PlacementDriveStatus,
    DriveAssessmentStage,
    DriveAssessmentStatus,
    AptitudeMode,
    AptitudeCategory,
    DifficultyLevel,
    ApplicationStatus,
)
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
    DriveAssessmentStartResponse,
    DriveAssessmentActiveResponse,
    DriveAssessmentSubmitResponse,
)
from app.api.v1.aptitude.attempt_schemas import SubmitAssessmentRequest, AttemptResponse

router = APIRouter(prefix="/drives", tags=["Placement Drives"])


def _safe_filename(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_-]+", "_", value or "").strip("_")
    return cleaned or "drive"


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
            aptitude_test_required=data.aptitude_test_required,
            aptitude_question_count=data.aptitude_question_count,
            aptitude_difficulty=data.aptitude_difficulty,
            aptitude_pass_percentage=data.aptitude_pass_percentage,
            technical_test_required=data.technical_test_required,
            technical_question_count=data.technical_question_count,
            technical_difficulty=data.technical_difficulty,
            technical_pass_percentage=data.technical_pass_percentage,
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


def _coerce_difficulty(value):
    if value is None:
        return None
    if isinstance(value, DifficultyLevel):
        return value
    try:
        return DifficultyLevel(str(value))
    except Exception:
        return None


@router.post("/{drive_id}/assessments/{stage}/start", response_model=DriveAssessmentStartResponse)
async def start_drive_assessment(
    drive_id: str,
    stage: DriveAssessmentStage,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """Start a drive-specific assessment for a student."""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Students only")

    drive_service = PlacementDriveService(db)
    drive = await drive_service.get_drive(drive_id)
    if not drive:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Drive not found")

    app_repo = DriveApplicationRepositoryImpl(db)
    application = await app_repo.get_by_user_and_drive(current_user.id, drive_id)
    if not application:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Apply to the drive first")

    if stage == DriveAssessmentStage.APTITUDE:
        if not getattr(drive, "aptitude_test_required", False):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Aptitude test not required for this drive")
        if application.aptitude_status == DriveAssessmentStatus.PASSED:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Aptitude assessment already completed")
        if application.aptitude_status == DriveAssessmentStatus.IN_PROGRESS and application.aptitude_attempt_id:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Aptitude assessment already in progress")

        count = getattr(drive, "aptitude_question_count", 10) or 10
        difficulty = _coerce_difficulty(getattr(drive, "aptitude_difficulty", None))
        pass_percentage = getattr(drive, "aptitude_pass_percentage", 60.0)
        if pass_percentage is None:
            pass_percentage = 60.0
        category = None
        exclude_categories = [AptitudeCategory.TECHNICAL]
    else:
        if not getattr(drive, "technical_test_required", False):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Technical test not required for this drive")
        if getattr(drive, "aptitude_test_required", False) and application.aptitude_status != DriveAssessmentStatus.PASSED:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Pass aptitude assessment first")
        if application.technical_status == DriveAssessmentStatus.PASSED:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Technical assessment already completed")
        if application.technical_status == DriveAssessmentStatus.IN_PROGRESS and application.technical_attempt_id:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Technical assessment already in progress")

        count = getattr(drive, "technical_question_count", 10) or 10
        difficulty = _coerce_difficulty(getattr(drive, "technical_difficulty", None))
        pass_percentage = getattr(drive, "technical_pass_percentage", 60.0)
        if pass_percentage is None:
            pass_percentage = 60.0
        category = AptitudeCategory.TECHNICAL
        exclude_categories = None

    attempt_service = AptitudeAttemptService(db)
    try:
        attempt, questions = await attempt_service.start_assessment(
            user_id=current_user.id,
            category=category,
            count=count,
            difficulty=difficulty,
            mode=AptitudeMode.TEST,
            resume_question_count=None,
            exclude_categories=exclude_categories,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    if stage == DriveAssessmentStage.APTITUDE:
        application.aptitude_attempt_id = attempt.id
        application.aptitude_status = DriveAssessmentStatus.IN_PROGRESS
    else:
        application.technical_attempt_id = attempt.id
        application.technical_status = DriveAssessmentStatus.IN_PROGRESS

    await db.commit()
    await db.refresh(application)

    return DriveAssessmentStartResponse(
        attempt_id=attempt.id,
        questions=questions,
        total_questions=len(questions),
        started_at=attempt.started_at,
        mode=attempt.mode,
        category=attempt.category.value if attempt.category else None,
        difficulty=attempt.difficulty.value if attempt.difficulty else None,
        stage=stage,
        pass_percentage=pass_percentage,
    )


@router.get("/{drive_id}/assessments/{stage}/active", response_model=DriveAssessmentActiveResponse)
async def get_drive_assessment_active(
    drive_id: str,
    stage: DriveAssessmentStage,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """Resume an active drive assessment if one exists."""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Students only")

    drive_service = PlacementDriveService(db)
    drive = await drive_service.get_drive(drive_id)
    if not drive:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Drive not found")

    app_repo = DriveApplicationRepositoryImpl(db)
    application = await app_repo.get_by_user_and_drive(current_user.id, drive_id)
    if not application:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    if stage == DriveAssessmentStage.APTITUDE:
        attempt_id = application.aptitude_attempt_id
        pass_percentage = getattr(drive, "aptitude_pass_percentage", 60.0)
        if pass_percentage is None:
            pass_percentage = 60.0
        if not attempt_id or application.aptitude_status != DriveAssessmentStatus.IN_PROGRESS:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active attempt")
    else:
        attempt_id = application.technical_attempt_id
        pass_percentage = getattr(drive, "technical_pass_percentage", 60.0)
        if pass_percentage is None:
            pass_percentage = 60.0
        if not attempt_id or application.technical_status != DriveAssessmentStatus.IN_PROGRESS:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active attempt")

    attempt_service = AptitudeAttemptService(db)
    try:
        attempt, questions, user_answers = await attempt_service.get_attempt_briefs(
            attempt_id=attempt_id,
            user_id=current_user.id,
        )
    except ValueError as e:
        message = str(e)
        if "expired" in message.lower():
            if stage == DriveAssessmentStage.APTITUDE:
                application.aptitude_status = DriveAssessmentStatus.FAILED
            else:
                application.technical_status = DriveAssessmentStatus.FAILED
            await db.commit()
            raise HTTPException(status_code=status.HTTP_410_GONE, detail=message)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=message)

    return DriveAssessmentActiveResponse(
        attempt_id=attempt.id,
        questions=questions,
        total_questions=len(questions),
        started_at=attempt.started_at,
        mode=attempt.mode,
        category=attempt.category.value if attempt.category else None,
        difficulty=attempt.difficulty.value if attempt.difficulty else None,
        user_answers=user_answers,
        stage=stage,
        pass_percentage=pass_percentage,
    )


@router.post("/{drive_id}/assessments/{stage}/submit/{attempt_id}", response_model=DriveAssessmentSubmitResponse)
async def submit_drive_assessment(
    drive_id: str,
    stage: DriveAssessmentStage,
    attempt_id: str,
    data: SubmitAssessmentRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """Submit a drive-specific assessment and store pass/fail state."""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Students only")

    drive_service = PlacementDriveService(db)
    drive = await drive_service.get_drive(drive_id)
    if not drive:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Drive not found")

    app_repo = DriveApplicationRepositoryImpl(db)
    application = await app_repo.get_by_user_and_drive(current_user.id, drive_id)
    if not application:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    if stage == DriveAssessmentStage.APTITUDE:
        if application.aptitude_attempt_id != attempt_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid aptitude attempt")
        pass_percentage = getattr(drive, "aptitude_pass_percentage", 60.0)
        if pass_percentage is None:
            pass_percentage = 60.0
    else:
        if application.technical_attempt_id != attempt_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid technical attempt")
        pass_percentage = getattr(drive, "technical_pass_percentage", 60.0)
        if pass_percentage is None:
            pass_percentage = 60.0

    attempt_service = AptitudeAttemptService(db)
    try:
        attempt = await attempt_service.submit_assessment(
            attempt_id=attempt_id,
            user_id=current_user.id,
            user_answers=data.user_answers,
            time_taken_seconds=data.time_taken_seconds,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    passed = bool(attempt.score >= pass_percentage)
    if stage == DriveAssessmentStage.APTITUDE:
        application.aptitude_score = attempt.score
        application.aptitude_status = DriveAssessmentStatus.PASSED if passed else DriveAssessmentStatus.FAILED
        if not passed and application.status in [ApplicationStatus.PENDING, ApplicationStatus.SHORTLISTED]:
            application.status = ApplicationStatus.REJECTED
            application.status_notes = "Aptitude test failed"
        if passed and not getattr(drive, "technical_test_required", False) and application.status == ApplicationStatus.PENDING:
            application.status_notes = "In process (assessment passed)"
    else:
        application.technical_score = attempt.score
        application.technical_status = DriveAssessmentStatus.PASSED if passed else DriveAssessmentStatus.FAILED
        if not passed and application.status in [ApplicationStatus.PENDING, ApplicationStatus.SHORTLISTED]:
            application.status = ApplicationStatus.REJECTED
            application.status_notes = "Technical test failed"
        if passed and application.status == ApplicationStatus.PENDING:
            application.status_notes = "In process (tests passed)"

    await db.commit()
    await db.refresh(application)

    attempt_payload = AttemptResponse.model_validate(attempt).model_dump()
    return DriveAssessmentSubmitResponse(
        **attempt_payload,
        stage=stage,
        passed=passed,
        pass_percentage=pass_percentage,
    )


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


@router.get("/{drive_id}/applicants/export")
async def export_drive_applicants(
    drive_id: str,
    status_filter: Optional[str] = None,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(officer_or_admin),
):
    """Export applicants for a drive as XLSX (Officer/Admin only)."""
    service = PlacementDriveService(db)
    drive = await service.get_drive(drive_id)
    if not drive:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Drive not found")

    apps = await service.get_drive_applicants(drive_id, status=status_filter)

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Applicants"
    sheet.append([
        "Application ID",
        "Drive ID",
        "Drive Company",
        "Drive Job Title",
        "Drive Status",
        "Drive Type",
        "Drive Location",
        "Drive Package LPA",
        "Drive Min CGPA",
        "Drive Registration Deadline",
        "Drive Date",
        "Drive Allowed Departments",
        "Drive Allowed Graduation Years",
        "Drive Max Applications",
        "Drive Created At",
        "User ID",
        "Name",
        "Email",
        "Phone",
        "User Role",
        "User Status",
        "Register Number",
        "Department",
        "Graduation Year",
        "CGPA",
        "Profile Status",
        "Applied At",
        "Application Updated At",
        "Resume URL",
        "Cover Letter",
        "Application Status",
        "Status Notes",
        "Aptitude Status",
        "Aptitude Score",
        "Technical Status",
        "Technical Score",
    ])

    for app in apps:
        user = app.user
        profile = user.student_profile if user else None
        drive = app.drive
        sheet.append([
            app.id,
            app.drive_id,
            drive.company_name if drive else "",
            drive.job_title if drive else "",
            drive.status.value if drive and drive.status else "",
            drive.job_type if drive else "",
            drive.location if drive else "",
            drive.package_lpa if drive else "",
            drive.min_cgpa if drive else "",
            drive.registration_deadline.isoformat() if drive and drive.registration_deadline else "",
            drive.drive_date.isoformat() if drive and drive.drive_date else "",
            ", ".join(drive.allowed_departments or []) if drive else "",
            ", ".join([str(y) for y in (drive.allowed_graduation_years or [])]) if drive else "",
            drive.max_applications if drive else "",
            drive.created_at.isoformat() if drive and drive.created_at else "",
            app.user_id,
            f"{user.first_name} {user.last_name}" if user else "",
            user.email if user else "",
            user.phone if user else "",
            user.role.value if user and user.role else "",
            user.status.value if user and user.status else "",
            profile.register_number if profile else "",
            profile.department if profile else "",
            profile.graduation_year if profile else "",
            profile.cgpa if profile else "",
            profile.profile_status.value if profile and profile.profile_status else "",
            app.applied_at.isoformat() if app.applied_at else "",
            app.updated_at.isoformat() if app.updated_at else "",
            app.resume_url or "",
            app.cover_letter or "",
            app.status.value,
            app.status_notes or "",
            app.aptitude_status.value if app.aptitude_status else DriveAssessmentStatus.NOT_STARTED.value,
            app.aptitude_score if app.aptitude_score is not None else "",
            app.technical_status.value if app.technical_status else DriveAssessmentStatus.NOT_STARTED.value,
            app.technical_score if app.technical_score is not None else "",
        ])

    output = io.BytesIO()
    workbook.save(output)
    output.seek(0)
    filename = f"{_safe_filename(drive.company_name)}_{_safe_filename(drive.job_title)}_applicants.xlsx"
    return Response(
        content=output.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=\"{filename}\""},
    )


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
