"""
Interview Service.
Core business logic for mock interview sessions.
"""
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple

from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.repositories.interview_repo_impl import InterviewRepositoryImpl
from app.infrastructure.repositories.profile_repo_impl import ProfileRepositoryImpl
from app.infrastructure.repositories.interview_answer_repo_impl import InterviewAnswerRepositoryImpl
from app.application.services.ai_service import get_ai_service
from app.application.services.resume_analysis_service import ResumeAnalysisService
from app.infrastructure.database.models import InterviewSession
from app.core.constants import (
    InterviewType,
    InterviewMode,
    InterviewStatus,
    DifficultyLevel,
    MAX_INTERVIEW_QUESTIONS,
)
from app.utils.logger import logger


class InterviewService:
    """Business logic for interview sessions."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.interview_repo = InterviewRepositoryImpl(session)
        self.profile_repo = ProfileRepositoryImpl(session)
        self.answer_repo = InterviewAnswerRepositoryImpl(session)
        self.resume_analysis_service = ResumeAnalysisService(session)
        self.ai_service = get_ai_service()
    
    async def start_interview(
        self,
        user_id: str,
        interview_type: InterviewType,
        mode: InterviewMode,
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
            mode=mode,
            difficulty=difficulty,
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
        
        if interview.ended_at or (interview.status and interview.status != InterviewStatus.IN_PROGRESS):
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

        # Persist per-answer record
        await self.answer_repo.create(
            session_id=interview.id,
            user_id=user_id,
            question_number=question_number,
            question_text=current_question,
            answer_text=answer_text,
            evaluation=evaluation,
        )
        
        # Check if we should continue or complete
        is_complete = question_number >= MAX_INTERVIEW_QUESTIONS
        next_question = None
        
        if not is_complete:
            # Generate next question
            next_difficulty = self._normalize_difficulty(interview.difficulty)
            next_question = await self.ai_service.generate_interview_question(
                interview_type=interview.interview_type,
                difficulty=next_difficulty,
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
            # No answers, mark as abandoned
            return await self.interview_repo.complete_session(
                session_id=session_id,
                overall_score=0,
                technical_score=0,
                communication_score=0,
                confidence_score=0,
                feedback_summary="Interview ended without completing any questions.",
                improvement_areas=["Complete at least one question to receive feedback."],
                status=InterviewStatus.ABANDONED,
            )
        
        # Get student context
        student_context = await self._get_student_context(user_id)
        
        # Generate comprehensive feedback (AI)
        feedback = await self.ai_service.generate_feedback_summary(
            interview_type=interview.interview_type,
            conversation=answered_qa,
            student_context=student_context,
        )

        # Compute scores from evaluations (prefer stored answers)
        answer_rows = await self.answer_repo.list_by_session(session_id)
        evaluation_rows: List[Dict[str, Any]] = []
        if answer_rows:
            for row in answer_rows:
                evaluation_rows.append({
                    "relevance_score": row.relevance_score,
                    "clarity_score": row.clarity_score,
                    "depth_score": row.depth_score,
                    "confidence_score": row.confidence_score,
                })

        score_summary = self._compute_scores(evaluation_rows or answered_qa)
        
        # Complete session with scores
        completed_interview = await self.interview_repo.complete_session(
            session_id=session_id,
            overall_score=score_summary["overall_score"],
            technical_score=score_summary["technical_score"],
            communication_score=score_summary["communication_score"],
            confidence_score=score_summary["confidence_score"],
            feedback_summary=feedback.get("overall_assessment"),
            improvement_areas=feedback.get("improvement_suggestions"),
            status=InterviewStatus.COMPLETED,
        )
        
        # Update student's interview score in profile
        await self._update_profile_score(user_id, score_summary["overall_score"])
        
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

    async def get_answer_review(self, user_id: str, session_id: str):
        """Get per-question answer review for a session."""
        interview = await self.interview_repo.get_by_user_and_id(user_id, session_id)
        if not interview:
            raise ValueError("Interview session not found")
        return await self.answer_repo.list_by_session(session_id)
    
    async def get_user_stats(self, user_id: str) -> Dict[str, Any]:
        """Get interview statistics for user."""
        return await self.interview_repo.get_user_stats(user_id)
    
    async def _get_student_context(self, user_id: str) -> Dict[str, Any]:
        """Get comprehensive student context for AI."""
        context = {
            "profile": {},
            "skills": [],
            "resume_text": "",
            "resume_score": 0,
            "missing_skills": [],
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

            # Resume analysis context (if available)
            analysis = await self.resume_analysis_service.get_latest_analysis(user_id)
            if analysis:
                context["resume_score"] = analysis.resume_score or 0
                context["missing_skills"] = analysis.missing_skills or []
                extracted = analysis.extracted_skills or []
                if extracted:
                    context["skills"] = list(dict.fromkeys(context["skills"] + extracted))

            # Resume text for richer context
            resume_text = await self.resume_analysis_service.get_resume_text(user_id)
            if resume_text:
                context["resume_text"] = resume_text
                
        except Exception as e:
            logger.warning(f"Failed to load student context: {e}")
        
        return context

    def _compute_scores(self, answered_qa: List[Dict[str, Any]]) -> Dict[str, float]:
        """Compute overall and component scores from per-question evaluations."""
        relevance_scores: List[float] = []
        clarity_scores: List[float] = []
        depth_scores: List[float] = []
        confidence_scores: List[float] = []

        for qa in answered_qa:
            evaluation = qa.get("evaluation") if isinstance(qa, dict) and "evaluation" in qa else qa
            if not isinstance(evaluation, dict):
                continue
            try:
                relevance_scores.append(float(evaluation.get("relevance_score", 0) or 0))
                clarity_scores.append(float(evaluation.get("clarity_score", 0) or 0))
                depth_scores.append(float(evaluation.get("depth_score", 0) or 0))
                confidence_scores.append(float(evaluation.get("confidence_score", 0) or 0))
            except Exception:
                continue

        def _avg(values: List[float]) -> float:
            return sum(values) / len(values) if values else 0.0

        avg_relevance = _avg(relevance_scores)
        avg_clarity = _avg(clarity_scores)
        avg_depth = _avg(depth_scores)
        avg_confidence = _avg(confidence_scores)

        # Weighted overall score: Technical 50% (relevance), Clarity 30%, Depth 20%
        overall_score = round((avg_relevance * 0.5 + avg_clarity * 0.3 + avg_depth * 0.2) * 10, 1)
        technical_score = round(avg_relevance * 10, 1)
        communication_score = round(avg_clarity * 10, 1)
        confidence_score = round(avg_confidence * 10, 1)

        return {
            "overall_score": overall_score,
            "technical_score": technical_score,
            "communication_score": communication_score,
            "confidence_score": confidence_score,
        }

    def _normalize_difficulty(self, value: Any) -> DifficultyLevel:
        if isinstance(value, DifficultyLevel):
            return value
        if isinstance(value, str):
            try:
                return DifficultyLevel[value]
            except Exception:
                try:
                    return DifficultyLevel(value)
                except Exception:
                    return DifficultyLevel.MEDIUM
        return DifficultyLevel.MEDIUM
    
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

                # Update overall readiness (simple average for now)
                overall = (profile.aptitude_score + new_score + profile.coding_score) / 3
                await self.profile_repo.update(user_id, overall_readiness=round(overall, 1))

                logger.info(f"Updated interview score for user {user_id}: {new_score}")
        except Exception as e:
            logger.warning(f"Failed to update profile score: {e}")
