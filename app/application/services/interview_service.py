"""
Interview Service.
Core business logic for mock interview sessions.
"""
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
import os

from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.repositories.interview_repo_impl import InterviewRepositoryImpl
from app.infrastructure.repositories.profile_repo_impl import ProfileRepositoryImpl
from app.infrastructure.repositories.resume_repo_impl import ResumeRepositoryImpl
from app.application.services.ai_service import get_ai_service
from app.infrastructure.database.models import InterviewSession
from app.core.constants import InterviewType, DifficultyLevel, MAX_INTERVIEW_QUESTIONS
from app.utils.logger import logger


class InterviewService:
    """Business logic for interview sessions."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.interview_repo = InterviewRepositoryImpl(session)
        self.profile_repo = ProfileRepositoryImpl(session)
        self.resume_repo = ResumeRepositoryImpl(session)
        self.ai_service = get_ai_service()
    
    async def start_interview(
        self,
        user_id: str,
        interview_type: InterviewType,
        difficulty: DifficultyLevel,
        target_role: Optional[str] = None,
        target_company: Optional[str] = None,
    ) -> Tuple[InterviewSession, str]:
        """
        Start a new interview session.
        
        Returns:
            Tuple of (InterviewSession, first_question)
        """
        # Create the session
        interview = await self.interview_repo.create(
            user_id=user_id,
            interview_type=interview_type,
            target_role=target_role,
            target_company=target_company,
        )
        
        # Get student context for AI
        student_context = await self._get_student_context(user_id)
        
        # Generate first question
        first_question = await self.ai_service.generate_interview_question(
            interview_type=interview_type,
            difficulty=difficulty,
            student_context=student_context,
            previous_qa=[],
            question_number=1,
        )
        
        # Update conversation with first question
        conversation = [{
            "question_number": 1,
            "question": first_question,
            "answer": None,
            "evaluation": None,
            "asked_at": datetime.utcnow().isoformat(),
        }]
        interview = await self.interview_repo.update_conversation(interview.id, conversation)
        
        logger.info(f"Started interview session {interview.id} for user {user_id}")
        return interview, first_question
    
    async def submit_answer(
        self,
        user_id: str,
        session_id: str,
        answer_text: str,
        difficulty: DifficultyLevel = DifficultyLevel.MEDIUM,
    ) -> Dict[str, Any]:
        """
        Submit an answer and get evaluation + next question.
        
        Returns:
            Dict with evaluation, next_question (or None if complete), is_complete
        """
        # Get session
        interview = await self.interview_repo.get_by_user_and_id(user_id, session_id)
        if not interview:
            raise ValueError("Interview session not found")
        
        if interview.ended_at:
            raise ValueError("Interview session already completed")
        
        conversation = list(interview.conversation) if interview.conversation else []
        
        # Find current unanswered question
        current_qa = None
        for qa in conversation:
            if qa.get("answer") is None:
                current_qa = qa
                break
        
        if not current_qa:
            raise ValueError("No pending question to answer")
        
        question_number = current_qa.get("question_number", 1)
        current_question = current_qa.get("question", "")
        
        # Get student context
        student_context = await self._get_student_context(user_id)
        
        # Evaluate the answer
        evaluation = await self.ai_service.evaluate_answer(
            question=current_question,
            answer=answer_text,
            interview_type=interview.interview_type,
            student_context=student_context,
        )
        
        # Update the current Q&A
        current_qa["answer"] = answer_text
        current_qa["evaluation"] = evaluation
        current_qa["answered_at"] = datetime.utcnow().isoformat()
        
        # Check if we should continue or complete
        is_complete = question_number >= MAX_INTERVIEW_QUESTIONS
        next_question = None
        
        if not is_complete:
            # Generate next question
            next_question = await self.ai_service.generate_interview_question(
                interview_type=interview.interview_type,
                difficulty=difficulty,
                student_context=student_context,
                previous_qa=conversation,
                question_number=question_number + 1,
            )
            
            # Add next question to conversation
            conversation.append({
                "question_number": question_number + 1,
                "question": next_question,
                "answer": None,
                "evaluation": None,
                "asked_at": datetime.utcnow().isoformat(),
            })
        
        # Update conversation
        await self.interview_repo.update_conversation(session_id, conversation)
        
        logger.info(f"Answer submitted for Q{question_number} in session {session_id}")
        
        return {
            "evaluation": evaluation,
            "next_question": next_question,
            "question_number": question_number + 1 if next_question else None,
            "is_complete": is_complete,
            "questions_remaining": MAX_INTERVIEW_QUESTIONS - question_number if not is_complete else 0,
        }
    
    async def complete_interview(
        self,
        user_id: str,
        session_id: str,
    ) -> InterviewSession:
        """
        Complete an interview session and generate final feedback.
        
        Returns:
            Completed InterviewSession with scores and feedback
        """
        # Get session
        interview = await self.interview_repo.get_by_user_and_id(user_id, session_id)
        if not interview:
            raise ValueError("Interview session not found")
        
        if interview.ended_at:
            # Already completed, just return
            return interview
        
        conversation = list(interview.conversation) if interview.conversation else []
        
        # Filter to only answered questions
        answered_qa = [qa for qa in conversation if qa.get("answer")]
        
        if not answered_qa:
            # No answers, just mark as ended with zero scores
            return await self.interview_repo.complete_session(
                session_id=session_id,
                overall_score=0,
                feedback_summary="Interview ended without completing any questions.",
            )
        
        # Get student context
        student_context = await self._get_student_context(user_id)
        
        # Generate comprehensive feedback
        feedback = await self.ai_service.generate_feedback_summary(
            interview_type=interview.interview_type,
            conversation=answered_qa,
            student_context=student_context,
        )
        
        # Complete session with scores
        completed_interview = await self.interview_repo.complete_session(
            session_id=session_id,
            overall_score=feedback.get("overall_score", 0),
            technical_score=feedback.get("technical_score"),
            communication_score=feedback.get("communication_score"),
            confidence_score=feedback.get("confidence_score"),
            feedback_summary=feedback.get("overall_assessment"),
            improvement_areas=feedback.get("improvement_suggestions"),
        )
        
        # Update student's interview score in profile
        await self._update_profile_score(user_id, feedback.get("overall_score", 0))
        
        logger.info(f"Completed interview session {session_id} with score {feedback.get('overall_score', 0)}")
        
        return completed_interview
    
    async def get_session(
        self,
        user_id: str,
        session_id: str,
    ) -> Optional[InterviewSession]:
        """Get interview session with full details."""
        return await self.interview_repo.get_by_user_and_id(user_id, session_id)
    
    async def list_sessions(
        self,
        user_id: str,
        page: int = 1,
        page_size: int = 10,
    ) -> Tuple[List[InterviewSession], int]:
        """
        List user's interview sessions with pagination.
        
        Returns:
            Tuple of (sessions, total_count)
        """
        offset = (page - 1) * page_size
        sessions = await self.interview_repo.list_by_user(user_id, limit=page_size, offset=offset)
        total = await self.interview_repo.count_by_user(user_id)
        return sessions, total
    
    async def get_user_stats(self, user_id: str) -> Dict[str, Any]:
        """Get interview statistics for user."""
        return await self.interview_repo.get_user_stats(user_id)
    
    async def _get_student_context(self, user_id: str) -> Dict[str, Any]:
        """Get comprehensive student context for AI."""
        context = {
            "profile": {},
            "skills": [],
            "resume_text": "",
            "aptitude_performance": {},
        }
        
        try:
            # Get profile
            profile = await self.profile_repo.get_by_user_id(user_id)
            if profile:
                context["profile"] = {
                    "department": profile.department,
                    "degree": profile.degree,
                    "cgpa": profile.cgpa,
                    "graduation_year": profile.graduation_year,
                    "preferred_roles": profile.preferred_roles or [],
                    "preferred_domains": profile.preferred_domains or [],
                }
                context["skills"] = profile.technical_skills or []
                context["aptitude_performance"] = {
                    "aptitude_score": profile.aptitude_score,
                    "interview_score": profile.interview_score,
                    "coding_score": profile.coding_score,
                }
            
            # Get resume content
            resume = await self.resume_repo.get_active_by_student_id(user_id)
            if resume and resume.file_path:
                # Try to extract text from resume
                context["resume_text"] = await self._extract_resume_text(resume.file_path)
                
        except Exception as e:
            logger.warning(f"Failed to load student context: {e}")
        
        return context
    
    async def _extract_resume_text(self, file_path: str) -> str:
        """Extract text content from resume file."""
        try:
            if not os.path.exists(file_path):
                return ""
            
            file_ext = file_path.rsplit(".", 1)[-1].lower()
            
            if file_ext == "pdf":
                # Try to extract text from PDF using pypdf
                try:
                    from pypdf import PdfReader
                    reader = PdfReader(file_path)
                    text = ""
                    for page in reader.pages:
                        text += page.extract_text() or ""
                    return text[:5000]  # Limit to 5000 chars
                except ImportError:
                    logger.warning("pypdf not installed, skipping PDF text extraction")
                    return f"[PDF Resume: {os.path.basename(file_path)}]"
            
            elif file_ext == "docx":
                try:
                    from docx import Document
                    doc = Document(file_path)
                    text = "\n".join([para.text for para in doc.paragraphs])
                    return text[:5000]
                except ImportError:
                    logger.warning("python-docx not installed, skipping DOCX text extraction")
                    return f"[DOCX Resume: {os.path.basename(file_path)}]"
            
            return ""
            
        except Exception as e:
            logger.warning(f"Failed to extract resume text: {e}")
            return ""
    
    async def _update_profile_score(self, user_id: str, score: float) -> None:
        """Update the interview score in student profile."""
        try:
            profile = await self.profile_repo.get_by_user_id(user_id)
            if profile:
                # Use weighted average with existing score
                current_score = profile.interview_score or 0
                if current_score > 0:
                    # Average of old and new
                    new_score = (current_score + score) / 2
                else:
                    new_score = score
                
                await self.profile_repo.update_interview_score(user_id, new_score)
                logger.info(f"Updated interview score for user {user_id}: {new_score}")
        except Exception as e:
            logger.warning(f"Failed to update profile score: {e}")
