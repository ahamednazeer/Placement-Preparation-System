"""
Profile API routes.
Handles student profile and resume management.
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.session import get_db_session, get_db_context
from app.application.services.profile_service import ProfileService
from app.application.services.resume_service import ResumeService
from app.application.services.resume_analysis_service import ResumeAnalysisService
from app.dependencies import CurrentStudent
from app.core.constants import ALLOWED_RESUME_EXTENSIONS, MAX_RESUME_SIZE_MB
from app.utils.logger import logger
from .schemas import (
    ProfileUpdateRequest,
    AddSkillRequest,
    RemoveSkillRequest,
    ProfileResponse,
    ProfileStatusResponse,
    ResumeResponse,
    ResumeUploadResponse,
    ResumeAnalysisResponse,
    ResumeProjectHintsResponse,
    MessageResponse,
)


router = APIRouter()


@router.get(
    "",
    response_model=ProfileResponse,
    summary="Get profile",
    description="Get the current student's profile.",
)
async def get_profile(
    user: CurrentStudent,
    db: AsyncSession = Depends(get_db_session),
):
    """Get the current student's profile."""
    profile_service = ProfileService(db)
    
    profile_data = await profile_service.get_profile_dict(user.id)
    
    if not profile_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found",
        )
    
    return ProfileResponse(**profile_data)


@router.put(
    "",
    response_model=ProfileResponse,
    summary="Update profile",
    description="Update the current student's profile.",
)
async def update_profile(
    request: ProfileUpdateRequest,
    user: CurrentStudent,
    db: AsyncSession = Depends(get_db_session),
):
    """Update profile with provided fields."""
    profile_service = ProfileService(db)
    
    try:
        # Convert soft_skills schema to dict if provided
        soft_skills_dict = None
        if request.soft_skills:
            soft_skills_dict = request.soft_skills.to_dict()
        
        await profile_service.update_profile(
            user_id=user.id,
            register_number=request.register_number,
            college_name=request.college_name,
            department=request.department,
            degree=request.degree,
            current_year=request.current_year,
            graduation_year=request.graduation_year,
            cgpa=request.cgpa,
            technical_skills=request.technical_skills,
            soft_skills=soft_skills_dict,
            preferred_roles=request.preferred_roles,
            preferred_domains=request.preferred_domains,
            linkedin_url=request.linkedin_url,
            github_url=request.github_url,
            portfolio_url=request.portfolio_url,
        )
        
        await db.commit()
        
        # Return updated profile
        profile_data = await profile_service.get_profile_dict(user.id)
        return ProfileResponse(**profile_data)
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get(
    "/status",
    response_model=ProfileStatusResponse,
    summary="Get profile status",
    description="Check profile completion status.",
)
async def get_profile_status(
    user: CurrentStudent,
    db: AsyncSession = Depends(get_db_session),
):
    """Get profile completion status."""
    profile_service = ProfileService(db)
    
    status_info = await profile_service.get_profile_status(user.id)
    
    return ProfileStatusResponse(
        is_complete=status_info["is_complete"],
        status=status_info["status"].value,
        missing_required=status_info.get("missing_required", []),
        missing_optional=status_info.get("missing_optional", []),
        completion_percentage=status_info["completion_percentage"],
    )


@router.post(
    "/skills",
    response_model=MessageResponse,
    summary="Add technical skill",
    description="Add a technical skill to the profile.",
)
async def add_skill(
    request: AddSkillRequest,
    user: CurrentStudent,
    db: AsyncSession = Depends(get_db_session),
):
    """Add a technical skill."""
    profile_service = ProfileService(db)
    
    profile = await profile_service.add_technical_skill(user.id, request.skill)
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found",
        )
    
    await db.commit()
    
    return MessageResponse(message=f"Skill '{request.skill}' added successfully")


@router.delete(
    "/skills/{skill}",
    response_model=MessageResponse,
    summary="Remove technical skill",
    description="Remove a technical skill from the profile.",
)
async def remove_skill(
    skill: str,
    user: CurrentStudent,
    db: AsyncSession = Depends(get_db_session),
):
    """Remove a technical skill."""
    profile_service = ProfileService(db)
    
    profile = await profile_service.remove_technical_skill(user.id, skill)
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found",
        )
    
    await db.commit()
    
    return MessageResponse(message=f"Skill '{skill}' removed successfully")


# ============ Resume Endpoints ============

@router.get(
    "/resume",
    response_model=ResumeResponse,
    summary="Get resume info",
    description="Get information about the uploaded resume.",
)
async def get_resume(
    user: CurrentStudent,
    db: AsyncSession = Depends(get_db_session),
):
    """Get resume information."""
    resume_service = ResumeService(db)
    
    resume_info = await resume_service.get_resume_info(user.id)
    
    if not resume_info:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No resume uploaded",
        )
    
    return ResumeResponse(**resume_info)


@router.post(
    "/resume",
    response_model=ResumeUploadResponse,
    summary="Upload resume",
    description=f"Upload a resume file. Allowed types: {', '.join(ALLOWED_RESUME_EXTENSIONS)}. Max size: {MAX_RESUME_SIZE_MB}MB.",
)
async def upload_resume(
    user: CurrentStudent,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="Resume file (PDF or DOCX)"),
    db: AsyncSession = Depends(get_db_session),
):
    """Upload a resume file."""
    resume_service = ResumeService(db)
    
    # Read file content
    file_content = await file.read()
    
    # Upload resume
    resume, error = await resume_service.upload_resume(
        user_id=user.id,
        filename=file.filename or "resume.pdf",
        file_content=file_content,
    )
    
    if error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error,
        )
    
    await db.commit()
    
    # Get resume info for response
    resume_info = await resume_service.get_resume_info(user.id)

    # Trigger resume analysis in background
    background_tasks.add_task(_analyze_resume_task, user.id)
    
    return ResumeUploadResponse(
        success=True,
        message="Resume uploaded successfully",
        resume=ResumeResponse(**resume_info) if resume_info else None,
    )


@router.delete(
    "/resume",
    response_model=MessageResponse,
    summary="Delete resume",
    description="Delete the uploaded resume.",
)
async def delete_resume(
    user: CurrentStudent,
    db: AsyncSession = Depends(get_db_session),
):
    """Delete the uploaded resume."""
    resume_service = ResumeService(db)
    
    success, error = await resume_service.delete_resume(user.id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error or "Failed to delete resume",
        )
    
    await db.commit()
    
    return MessageResponse(message="Resume deleted successfully")


@router.get(
    "/resume/download",
    summary="Download resume",
    description="Download the uploaded resume file.",
)
async def download_resume(
    user: CurrentStudent,
    db: AsyncSession = Depends(get_db_session),
):
    """Download the resume file."""
    resume_service = ResumeService(db)
    
    file_path = await resume_service.get_resume_file_path(user.id)
    
    if not file_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume file not found",
        )
    
    resume = await resume_service.get_resume(user.id)
    
    return FileResponse(
        path=file_path,
        filename=resume.original_filename if resume else "resume.pdf",
        media_type="application/octet-stream",
    )


async def _analyze_resume_task(user_id: str) -> None:
    """Background task to analyze resume."""
    try:
        async with get_db_context() as session:
            service = ResumeAnalysisService(session)
            await service.analyze_and_store(user_id)
    except Exception as e:
        logger.error(f"Background resume analysis failed for user {user_id}: {e}")


@router.post(
    "/resume/analyze",
    response_model=ResumeAnalysisResponse,
    summary="Analyze resume",
    description="Run AI analysis on the latest uploaded resume.",
)
async def analyze_resume(
    user: CurrentStudent,
    db: AsyncSession = Depends(get_db_session),
):
    """Analyze the latest resume and store results."""
    service = ResumeAnalysisService(db)
    try:
        analysis = await service.analyze_and_store(user.id)
        await db.commit()
        return ResumeAnalysisResponse(**service.to_dict(analysis))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get(
    "/resume/analysis",
    response_model=ResumeAnalysisResponse,
    summary="Get resume analysis",
    description="Get the latest resume analysis results.",
)
async def get_resume_analysis(
    user: CurrentStudent,
    db: AsyncSession = Depends(get_db_session),
):
    """Get latest resume analysis."""
    service = ResumeAnalysisService(db)
    analysis = await service.get_latest_analysis(user.id)
    if not analysis:
        # If analysis doesn't exist yet but resume does, run analysis on demand
        try:
            analysis = await service.analyze_and_store(user.id)
            await db.commit()
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    return ResumeAnalysisResponse(**service.to_dict(analysis))


@router.get(
    "/resume/projects",
    response_model=ResumeProjectHintsResponse,
    summary="Get resume project hints",
    description="Extract project titles from the uploaded resume text.",
)
async def get_resume_projects(
    user: CurrentStudent,
    db: AsyncSession = Depends(get_db_session),
):
    """Extract project hints directly from resume text."""
    service = ResumeAnalysisService(db)
    resume_text = await service.get_resume_text(user.id)
    if not resume_text:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No resume uploaded")
    projects = await service.get_resume_project_hints(user.id, resume_text=resume_text)
    return ResumeProjectHintsResponse(projects=projects, source="resume_text")
