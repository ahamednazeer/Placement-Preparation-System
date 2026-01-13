"""
Resume service.
Handles resume upload, validation, and storage.
"""
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional, Tuple, BinaryIO, Dict, Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.repositories.resume_repo_impl import ResumeRepositoryImpl
from app.infrastructure.repositories.profile_repo_impl import ProfileRepositoryImpl
from app.infrastructure.database.models import Resume
from app.core.constants import ALLOWED_RESUME_EXTENSIONS, MAX_RESUME_SIZE_MB, RESUME_UPLOAD_DIR
from app.utils.logger import logger


class ResumeService:
    """Resume business logic service."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.resume_repo = ResumeRepositoryImpl(session)
        self.profile_repo = ProfileRepositoryImpl(session)
        
        # Ensure upload directory exists
        self.upload_dir = Path(RESUME_UPLOAD_DIR)
        self.upload_dir.mkdir(parents=True, exist_ok=True)
    
    def validate_file(
        self,
        filename: str,
        file_size_bytes: int,
    ) -> Tuple[bool, Optional[str]]:
        """
        Validate uploaded file.
        
        Returns:
            Tuple of (is_valid, error_message)
        """
        # Check file extension
        ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
        
        if ext not in ALLOWED_RESUME_EXTENSIONS:
            return False, f"Invalid file type. Allowed: {', '.join(ALLOWED_RESUME_EXTENSIONS)}"
        
        # Check file size
        max_bytes = MAX_RESUME_SIZE_MB * 1024 * 1024
        if file_size_bytes > max_bytes:
            return False, f"File too large. Maximum size: {MAX_RESUME_SIZE_MB}MB"
        
        if file_size_bytes == 0:
            return False, "File is empty"
        
        return True, None
    
    def _generate_secure_filename(self, user_id: str, original_filename: str) -> str:
        """Generate a secure unique filename."""
        # Get extension
        ext = original_filename.rsplit('.', 1)[-1].lower() if '.' in original_filename else 'pdf'
        
        # Generate unique name: user_id_timestamp_uuid.ext
        timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S')
        unique_id = str(uuid.uuid4())[:8]
        
        return f"{user_id[:8]}_{timestamp}_{unique_id}.{ext}"
    
    async def upload_resume(
        self,
        user_id: str,
        filename: str,
        file_content: bytes,
    ) -> Tuple[Optional[Resume], Optional[str]]:
        """
        Upload and store a resume file.
        
        Args:
            user_id: Student's user ID
            filename: Original filename
            file_content: File content as bytes
            
        Returns:
            Tuple of (resume record, error message)
        """
        file_size = len(file_content)
        
        # Validate file
        is_valid, error = self.validate_file(filename, file_size)
        if not is_valid:
            return None, error
        
        # Get file type
        file_type = filename.rsplit('.', 1)[-1].lower()
        
        # Generate secure filename
        secure_filename = self._generate_secure_filename(user_id, filename)
        file_path = self.upload_dir / secure_filename
        
        try:
            # Deactivate any existing active resumes
            await self.resume_repo.deactivate_all_for_student(user_id)
            
            # Save file to disk
            with open(file_path, 'wb') as f:
                f.write(file_content)
            
            # Create resume record
            resume = await self.resume_repo.create(
                student_id=user_id,
                file_path=str(file_path),
                file_type=file_type,
                original_filename=filename,
                file_size_bytes=file_size,
            )
            
            # Update profile with resume URL
            resume_url = f"/uploads/resumes/{secure_filename}"
            await self.profile_repo.update_resume_url(user_id, resume_url)
            
            logger.info(f"Resume uploaded for user {user_id}: {secure_filename}")
            
            return resume, None
            
        except Exception as e:
            # Clean up file if it was created
            if file_path.exists():
                file_path.unlink()
            logger.error(f"Resume upload failed for user {user_id}: {str(e)}")
            return None, f"Upload failed: {str(e)}"
    
    async def get_resume(self, user_id: str) -> Optional[Resume]:
        """Get the active resume for a user."""
        return await self.resume_repo.get_active_by_student_id(user_id)
    
    async def get_resume_info(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get resume info as dictionary."""
        resume = await self.resume_repo.get_active_by_student_id(user_id)
        
        if not resume:
            return None
        
        return {
            "id": resume.id,
            "original_filename": resume.original_filename,
            "file_type": resume.file_type,
            "file_size_bytes": resume.file_size_bytes,
            "file_size_mb": round(resume.file_size_bytes / (1024 * 1024), 2),
            "uploaded_at": resume.uploaded_at.isoformat(),
            "download_url": f"/api/v1/profile/resume/download",
        }
    
    async def delete_resume(self, user_id: str) -> Tuple[bool, Optional[str]]:
        """
        Delete the active resume for a user.
        
        Returns:
            Tuple of (success, error message)
        """
        resume = await self.resume_repo.get_active_by_student_id(user_id)
        
        if not resume:
            return False, "No resume found"
        
        try:
            # Delete file from disk
            file_path = Path(resume.file_path)
            if file_path.exists():
                file_path.unlink()
            
            # Soft delete record
            await self.resume_repo.soft_delete(resume.id)
            
            # Clear resume URL in profile
            await self.profile_repo.update_resume_url(user_id, None)
            
            logger.info(f"Resume deleted for user {user_id}")
            
            return True, None
            
        except Exception as e:
            logger.error(f"Resume delete failed for user {user_id}: {str(e)}")
            return False, f"Delete failed: {str(e)}"
    
    async def get_resume_file_path(self, user_id: str) -> Optional[str]:
        """Get the file path for downloading."""
        resume = await self.resume_repo.get_active_by_student_id(user_id)
        if resume and Path(resume.file_path).exists():
            return resume.file_path
        return None
