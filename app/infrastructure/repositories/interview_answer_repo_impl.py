"""
Interview Answer Repository Implementation.
Stores per-question interview answers and evaluations.
"""
from datetime import datetime
from typing import List, Optional, Dict, Any
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import InterviewAnswer


class InterviewAnswerRepositoryImpl:
    """Repository for interview answers."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        session_id: str,
        user_id: str,
        question_number: int,
        question_text: str,
        answer_text: str,
        evaluation: Optional[Dict[str, Any]] = None,
    ) -> InterviewAnswer:
        """Create a new interview answer entry."""
        evaluation = evaluation or {}
        answer = InterviewAnswer(
            id=str(uuid4()),
            session_id=session_id,
            user_id=user_id,
            question_number=question_number,
            question_text=question_text,
            answer_text=answer_text,
            evaluation=evaluation,
            overall_score=float(evaluation.get("overall_score", 0) or 0),
            relevance_score=float(evaluation.get("relevance_score", 0) or 0),
            clarity_score=float(evaluation.get("clarity_score", 0) or 0),
            depth_score=float(evaluation.get("depth_score", 0) or 0),
            confidence_score=float(evaluation.get("confidence_score", 0) or 0),
            feedback=evaluation.get("feedback"),
            strengths=evaluation.get("strengths") or [],
            improvements=evaluation.get("improvements") or [],
            answered_at=datetime.utcnow(),
        )
        self.session.add(answer)
        await self.session.flush()
        await self.session.refresh(answer)
        return answer

    async def list_by_session(self, session_id: str) -> List[InterviewAnswer]:
        """List answers for a session ordered by question number."""
        result = await self.session.execute(
            select(InterviewAnswer)
            .where(InterviewAnswer.session_id == session_id)
            .order_by(InterviewAnswer.question_number.asc())
        )
        return list(result.scalars().all())
