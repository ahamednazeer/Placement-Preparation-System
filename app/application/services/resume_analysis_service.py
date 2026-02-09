"""
Resume Analysis service.
Handles text extraction, AI analysis, and persistence.
"""
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.services.ai_service import AIService
from app.infrastructure.repositories.resume_repo_impl import ResumeRepositoryImpl
from app.infrastructure.repositories.profile_repo_impl import ProfileRepositoryImpl
from app.infrastructure.repositories.resume_analysis_repo_impl import ResumeAnalysisRepositoryImpl
from app.infrastructure.database.models import ResumeAnalysis
from app.utils.logger import logger
from app.core.constants import RESUME_UPLOAD_DIR


class ResumeAnalysisService:
    """Resume analysis service."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.resume_repo = ResumeRepositoryImpl(session)
        self.profile_repo = ProfileRepositoryImpl(session)
        self.analysis_repo = ResumeAnalysisRepositoryImpl(session)
        self.ai_service = AIService()
    
    def _extract_text(self, file_path: str, file_type: str) -> str:
        """Extract text from PDF or DOCX."""
        text = ""
        if file_type.lower() == "pdf":
            try:
                import pdfplumber  # type: ignore
            except Exception as e:
                raise RuntimeError("pdfplumber is required for PDF extraction") from e
            with pdfplumber.open(file_path) as pdf:
                pages = [page.extract_text() or "" for page in pdf.pages]
            text = "\n".join(pages)
        elif file_type.lower() == "docx":
            try:
                import docx  # type: ignore
            except Exception as e:
                raise RuntimeError("python-docx is required for DOCX extraction") from e
            doc = docx.Document(file_path)
            text = "\n".join([p.text for p in doc.paragraphs if p.text])
        else:
            raise ValueError("Unsupported resume type")
        
        text = re.sub(r"\s+", " ", text).strip()
        return text
    
    def _clamp_score(self, value: Any, default: float = 0.0) -> float:
        try:
            num = float(value)
            if num < 0:
                return 0.0
            if num > 100:
                return 100.0
            return round(num, 1)
        except Exception:
            return default
    
    def _as_list(self, value: Any) -> List[str]:
        if isinstance(value, list):
            return [str(v).strip() for v in value if str(v).strip()]
        if isinstance(value, str):
            return [v.strip() for v in value.split(",") if v.strip()]
        return []
    
    def _as_dict(self, value: Any) -> Dict[str, Any]:
        return value if isinstance(value, dict) else {}
    
    async def analyze_and_store(self, user_id: str) -> ResumeAnalysis:
        """Analyze the latest resume and store results."""
        resume = await self.resume_repo.get_active_by_student_id(user_id)
        profile = await self.profile_repo.get_by_user_id(user_id)

        if not resume:
            # Fallback: if resume table is empty but profile has resume_url, rebuild record
            resume_url = profile.resume_url if profile else None
            file_path: Optional[Path] = None
            if resume_url:
                relative_path = resume_url.lstrip("/")
                file_path = Path(relative_path)
            else:
                # Try to locate by user_id prefix in uploads/resumes
                upload_dir = Path(RESUME_UPLOAD_DIR)
                if upload_dir.exists():
                    prefix = f"{user_id[:8]}_"
                    candidates = [p for p in upload_dir.glob(f"{prefix}*") if p.is_file()]
                    if candidates:
                        file_path = max(candidates, key=lambda p: p.stat().st_mtime)
                        await self.profile_repo.update_resume_url(
                            user_id, f"/{file_path.as_posix()}"
                        )

            if not file_path:
                raise ValueError("No resume found for analysis")
            if not file_path.exists():
                raise ValueError("Resume file not found")

            file_type = file_path.suffix.lstrip(".").lower() or "pdf"
            file_size = os.path.getsize(file_path)
            resume = await self.resume_repo.create(
                student_id=user_id,
                file_path=str(file_path),
                file_type=file_type,
                original_filename=file_path.name,
                file_size_bytes=file_size,
            )
            logger.info(f"Rebuilt resume record from profile URL for user {user_id}")
        preferred_role = None
        existing_skills: List[str] = []
        if profile:
            preferred_roles = profile.preferred_roles or []
            if preferred_roles:
                preferred_role = preferred_roles[0]
            existing_skills = profile.technical_skills or []
        
        text = self._extract_text(resume.file_path, resume.file_type)
        if not text:
            raise ValueError("Unable to extract resume text")
        
        # Limit text for LLM
        text = text[:6000]
        
        ai_result = await self.ai_service.analyze_resume(
            resume_text=text,
            preferred_role=preferred_role,
            existing_skills=existing_skills,
        )
        
        structured = self._as_dict(ai_result.get("structured") or ai_result.get("structured_data"))
        extracted_skills = self._as_list(ai_result.get("extracted_skills"))
        missing_skills = self._as_list(ai_result.get("missing_skills"))
        suggestions = self._as_list(ai_result.get("suggestions"))
        
        scores = ai_result.get("scores") if isinstance(ai_result.get("scores"), dict) else {}
        
        skill_match_score = self._clamp_score(
            ai_result.get("skill_match_score") or scores.get("skill_match") or scores.get("skill_match_score"),
            default=0.0,
        )
        ats_score = self._clamp_score(
            ai_result.get("ats_score") or scores.get("ats"),
            default=0.0,
        )
        content_score = self._clamp_score(
            ai_result.get("content_score") or scores.get("content"),
            default=0.0,
        )
        project_score = self._clamp_score(
            ai_result.get("project_score") or scores.get("project"),
            default=0.0,
        )
        
        resume_score = self._clamp_score(
            ai_result.get("resume_score"),
            default=round(
                (skill_match_score * 0.4) +
                (ats_score * 0.25) +
                (content_score * 0.2) +
                (project_score * 0.15),
                1,
            ),
        )
        
        analysis = await self.analysis_repo.create(
            student_id=user_id,
            resume_id=resume.id,
            preferred_role=preferred_role,
            resume_score=resume_score,
            skill_match_score=skill_match_score,
            ats_score=ats_score,
            content_score=content_score,
            project_score=project_score,
            extracted_skills=extracted_skills,
            missing_skills=missing_skills,
            suggestions=suggestions,
            structured_data=structured,
        )
        
        logger.info(f"Resume analysis created for user {user_id} - Score {resume_score}")
        return analysis
    
    async def get_latest_analysis(self, user_id: str) -> Optional[ResumeAnalysis]:
        """Get the latest analysis for a student."""
        return await self.analysis_repo.get_latest_by_student_id(user_id)

    async def get_resume_text(self, user_id: str) -> Optional[str]:
        """Fetch and extract resume text without running full analysis."""
        resume = await self.resume_repo.get_active_by_student_id(user_id)
        profile = await self.profile_repo.get_by_user_id(user_id)

        if not resume:
            resume_url = profile.resume_url if profile else None
            file_path: Optional[Path] = None
            if resume_url:
                relative_path = resume_url.lstrip("/")
                file_path = Path(relative_path)
            else:
                upload_dir = Path(RESUME_UPLOAD_DIR)
                if upload_dir.exists():
                    prefix = f"{user_id[:8]}_"
                    candidates = [p for p in upload_dir.glob(f"{prefix}*") if p.is_file()]
                    if candidates:
                        file_path = max(candidates, key=lambda p: p.stat().st_mtime)
                        await self.profile_repo.update_resume_url(
                            user_id, f"/{file_path.as_posix()}"
                        )
            if not file_path or not file_path.exists():
                return None
            file_type = file_path.suffix.lstrip(".").lower() or "pdf"
            resume = await self.resume_repo.create(
                student_id=user_id,
                file_path=str(file_path),
                file_type=file_type,
                original_filename=file_path.name,
                file_size_bytes=os.path.getsize(file_path),
            )

        text = self._extract_text(resume.file_path, resume.file_type)
        if not text:
            return None
        return text[:6000]

    async def get_resume_skill_hints(self, user_id: str, resume_text: Optional[str] = None) -> List[str]:
        """Fetch skill hints from latest resume analysis or fallback text scan."""
        analysis = await self.analysis_repo.get_latest_by_student_id(user_id)
        hints: List[str] = []
        if analysis:
            if analysis.extracted_skills:
                hints.extend([str(s).strip() for s in analysis.extracted_skills if str(s).strip()])
            if analysis.structured_data:
                structured = analysis.structured_data or {}
                structured_skills = structured.get("skills") or structured.get("technical_skills") or []
                if isinstance(structured_skills, list):
                    hints.extend([str(s).strip() for s in structured_skills if str(s).strip()])
        if not hints and resume_text:
            normalized = resume_text.lower()
            common_skills = [
                "Python", "Java", "C++", "C#", "JavaScript", "TypeScript", "React", "Node.js",
                "Express", "Django", "Flask", "FastAPI", "Spring", "Spring Boot", "SQL",
                "MySQL", "PostgreSQL", "MongoDB", "Redis", "Docker", "Kubernetes", "AWS",
                "Azure", "GCP", "HTML", "CSS", "Git", "Linux", "Pandas", "NumPy",
                "TensorFlow", "PyTorch", "Scikit-learn", "Power BI", "Tableau",
                "Excel", "REST", "GraphQL",
            ]
            for skill in common_skills:
                if skill.lower() in normalized:
                    hints.append(skill)
        # Deduplicate while preserving order
        seen = set()
        deduped: List[str] = []
        for item in hints:
            key = item.lower()
            if key in seen:
                continue
            seen.add(key)
            deduped.append(item)
        return deduped

    def _extract_project_hints_from_text(self, resume_text: str) -> List[str]:
        if not resume_text:
            return []
        candidates: List[str] = []
        patterns = [
            r"(?:projects?|project)\s*[:\-]\s*([A-Za-z0-9][A-Za-z0-9 &+._/-]{2,80})",
            r"(?:projects?|project)\s+([A-Z][A-Za-z0-9 &+._/-]{2,80})",
            r"([A-Z][A-Za-z0-9 &+._/-]{2,80})\s+(?:project)",
        ]
        for pattern in patterns:
            for match in re.finditer(pattern, resume_text, flags=re.IGNORECASE):
                name = match.group(1).strip()
                for sep in [" - ", " | ", " – ", " — ", " using ", " with ", " built ", " developed "]:
                    if sep in name:
                        name = name.split(sep)[0].strip()
                name = name.strip(":-|,.; ")
                if 3 <= len(name) <= 60:
                    candidates.append(name)
        seen = set()
        deduped: List[str] = []
        for item in candidates:
            key = item.lower()
            if key in seen:
                continue
            seen.add(key)
            deduped.append(item)
        return deduped

    async def get_resume_project_hints(self, user_id: str, resume_text: Optional[str] = None) -> List[str]:
        """Extract project name hints from resume text."""
        if resume_text:
            return self._extract_project_hints_from_text(resume_text)
        resume_text = await self.get_resume_text(user_id)
        if not resume_text:
            return []
        return self._extract_project_hints_from_text(resume_text)

    async def get_project_skill_map(
        self,
        user_id: str,
        resume_text: Optional[str] = None,
        skill_hints: Optional[List[str]] = None,
        project_hints: Optional[List[str]] = None,
    ) -> Dict[str, List[str]]:
        """Build a map of project -> skills found near the project mention in resume text."""
        if not resume_text:
            resume_text = await self.get_resume_text(user_id)
        if not resume_text:
            return {}
        if skill_hints is None:
            skill_hints = await self.get_resume_skill_hints(user_id, resume_text=resume_text)
        if project_hints is None:
            project_hints = self._extract_project_hints_from_text(resume_text)
        if not skill_hints or not project_hints:
            return {}
        text = resume_text.lower()
        skills_norm = {s.lower(): s for s in skill_hints}
        project_map: Dict[str, List[str]] = {}
        for project in project_hints:
            p_lower = project.lower()
            idx = text.find(p_lower)
            if idx == -1:
                continue
            start = max(0, idx - 200)
            end = min(len(text), idx + len(p_lower) + 200)
            window = text[start:end]
            matched: List[str] = []
            for skill_lower, skill_original in skills_norm.items():
                if skill_lower and skill_lower in window:
                    matched.append(skill_original)
            if matched:
                project_map[project] = matched
        return project_map
    
    def to_dict(self, analysis: ResumeAnalysis) -> Dict[str, Any]:
        """Convert analysis model to dict for API response."""
        return {
            "id": analysis.id,
            "student_id": analysis.student_id,
            "resume_id": analysis.resume_id,
            "preferred_role": analysis.preferred_role,
            "resume_score": analysis.resume_score,
            "skill_match_score": analysis.skill_match_score,
            "ats_score": analysis.ats_score,
            "content_score": analysis.content_score,
            "project_score": analysis.project_score,
            "extracted_skills": analysis.extracted_skills or [],
            "missing_skills": analysis.missing_skills or [],
            "suggestions": analysis.suggestions or [],
            "structured_data": analysis.structured_data or {},
            "analyzed_at": analysis.analyzed_at.isoformat(),
        }
