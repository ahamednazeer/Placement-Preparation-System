"""
Interview Repository Implementation.
Data access layer for interview sessions.
"""
from datetime import datetime
from typing import List, Optional, Dict, Any
from uuid import uuid4

from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import InterviewSession
from app.core.constants import InterviewType, InterviewMode, DifficultyLevel, InterviewStatus


class InterviewRepositoryImpl:
    """Repository for interview session data access."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create(
        self,
        user_id: str,
        interview_type: InterviewType,
        mode: InterviewMode,
        difficulty: DifficultyLevel,
        target_role: Optional[str] = None,
        target_company: Optional[str] = None,
    ) -> InterviewSession:
        """Create a new interview session."""
        session = InterviewSession(
            id=str(uuid4()),
            user_id=user_id,
            interview_type=interview_type,
            mode=mode,
            difficulty=difficulty,
            status=InterviewStatus.IN_PROGRESS,
            target_role=target_role,
            target_company=target_company,
            conversation=[],
            overall_score=0.0,
            started_at=datetime.utcnow(),
        )
        self.session.add(session)
        await self.session.commit()
        await self.session.refresh(session)
        return session
    
    async def get_by_id(self, session_id: str) -> Optional[InterviewSession]:
        """Get interview session by ID."""
        result = await self.session.execute(
            select(InterviewSession).where(InterviewSession.id == session_id)
        )
        return result.scalar_one_or_none()
    
    async def get_by_user_and_id(
        self, user_id: str, session_id: str
    ) -> Optional[InterviewSession]:
        """Get interview session by ID ensuring it belongs to the user."""
        result = await self.session.execute(
            select(InterviewSession).where(
                InterviewSession.id == session_id,
                InterviewSession.user_id == user_id
            )
        )
        return result.scalar_one_or_none()
    
    async def list_by_user(
        self,
        user_id: str,
        limit: int = 20,
        offset: int = 0,
    ) -> List[InterviewSession]:
        """List interview sessions for a user with pagination."""
        result = await self.session.execute(
            select(InterviewSession)
            .where(InterviewSession.user_id == user_id)
            .order_by(desc(InterviewSession.started_at))
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all())
    
    async def count_by_user(self, user_id: str) -> int:
        """Count total interview sessions for a user."""
        result = await self.session.execute(
            select(func.count(InterviewSession.id))
            .where(InterviewSession.user_id == user_id)
        )
        return result.scalar() or 0
    
    async def update_conversation(
        self,
        session_id: str,
        conversation: List[Dict[str, Any]],
    ) -> Optional[InterviewSession]:
        """Update the conversation history."""
        interview = await self.get_by_id(session_id)
        if not interview:
            return None
        
        interview.conversation = conversation
        await self.session.commit()
        await self.session.refresh(interview)
        return interview
    
    async def complete_session(
        self,
        session_id: str,
        overall_score: float,
        technical_score: Optional[float] = None,
        communication_score: Optional[float] = None,
        confidence_score: Optional[float] = None,
        feedback_summary: Optional[str] = None,
        improvement_areas: Optional[List[str]] = None,
        status: InterviewStatus = InterviewStatus.COMPLETED,
    ) -> Optional[InterviewSession]:
        """Mark session as complete with final scores and feedback."""
        interview = await self.get_by_id(session_id)
        if not interview:
            return None
        
        interview.overall_score = overall_score
        interview.technical_score = technical_score
        interview.communication_score = communication_score
        interview.confidence_score = confidence_score
        interview.feedback_summary = feedback_summary
        interview.improvement_areas = improvement_areas
        interview.ended_at = datetime.utcnow()
        interview.status = status
        
        await self.session.commit()
        await self.session.refresh(interview)
        return interview
    
    async def get_user_stats(self, user_id: str) -> Dict[str, Any]:
        """Get interview statistics for a user."""
        # Get count of completed interviews
        completed_count = await self.session.execute(
            select(func.count(InterviewSession.id))
            .where(
                InterviewSession.user_id == user_id,
                InterviewSession.status == InterviewStatus.COMPLETED
            )
        )
        
        # Get average score
        avg_score = await self.session.execute(
            select(func.avg(InterviewSession.overall_score))
            .where(
                InterviewSession.user_id == user_id,
                InterviewSession.status == InterviewStatus.COMPLETED
            )
        )
        
        # Get best score
        best_score = await self.session.execute(
            select(func.max(InterviewSession.overall_score))
            .where(
                InterviewSession.user_id == user_id,
                InterviewSession.status == InterviewStatus.COMPLETED
            )
        )
        
        return {
            "completed_interviews": completed_count.scalar() or 0,
            "average_score": round(avg_score.scalar() or 0, 1),
            "best_score": round(best_score.scalar() or 0, 1),
        }
