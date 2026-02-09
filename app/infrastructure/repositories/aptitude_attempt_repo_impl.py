"""
Repository implementation for Aptitude Attempts.
"""
from typing import List, Optional, Dict, Any
from uuid import uuid4
from datetime import datetime

from sqlalchemy import select, func, and_, cast, String
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete

from app.infrastructure.database.models import AptitudeAttempt, User
from app.core.constants import AptitudeCategory, DifficultyLevel, AptitudeMode, AttemptStatus


class AptitudeAttemptRepositoryImpl:
    """Repository for student aptitude test attempts."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create(
        self,
        user_id: str,
        total_questions: int,
        category: Optional[AptitudeCategory] = None,
        difficulty: Optional[DifficultyLevel] = None,
        mode: AptitudeMode = AptitudeMode.PRACTICE,
        status: AttemptStatus = AttemptStatus.IN_PROGRESS,
        question_ids: Optional[list] = None,
        option_orders: Optional[dict] = None,
        generated_questions: Optional[dict] = None,
        started_at: Optional[datetime] = None,
    ) -> AptitudeAttempt:
        """Create a new aptitude attempt."""
        attempt = AptitudeAttempt(
            id=str(uuid4()),
            user_id=user_id,
            total_questions=total_questions,
            category=category,
            difficulty=difficulty,
            mode=mode,
            status=status,
            question_ids=question_ids,
            option_orders=option_orders,
            generated_questions=generated_questions,
            started_at=started_at or datetime.utcnow(),
            answers={},
            score=0.0,
            correct_answers=0,
            wrong_answers=0,
            skipped=0,
            time_taken_seconds=0
        )
        self.db.add(attempt)
        await self.db.commit()
        await self.db.refresh(attempt)
        return attempt
    
    async def update(self, attempt_id: str, **kwargs) -> Optional[AptitudeAttempt]:
        """Update an existing attempt."""
        result = await self.db.execute(
            select(AptitudeAttempt).where(AptitudeAttempt.id == attempt_id)
        )
        attempt = result.scalar_one_or_none()
        
        if not attempt:
            return None
            
        for key, value in kwargs.items():
            if hasattr(attempt, key):
                setattr(attempt, key, value)
        
        await self.db.commit()
        await self.db.refresh(attempt)
        return attempt
    
    async def get_by_id(self, attempt_id: str) -> Optional[AptitudeAttempt]:
        """Get attempt by ID."""
        result = await self.db.execute(
            select(AptitudeAttempt).where(AptitudeAttempt.id == attempt_id)
        )
        return result.scalar_one_or_none()
    
    async def list_by_user(self, user_id: str, limit: int = 50, offset: int = 0) -> List[AptitudeAttempt]:
        """List attempts for a user."""
        query = (
            select(AptitudeAttempt)
            .where(AptitudeAttempt.user_id == user_id)
            .order_by(AptitudeAttempt.started_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_active_attempt(self, user_id: str) -> Optional[AptitudeAttempt]:
        """Get the most recent active attempt for a user."""
        query = (
            select(AptitudeAttempt)
            .where(
                AptitudeAttempt.user_id == user_id,
                AptitudeAttempt.completed_at.is_(None),
                cast(AptitudeAttempt.status, String) == AttemptStatus.IN_PROGRESS.value,
            )
            .order_by(AptitudeAttempt.started_at.desc())
            .limit(1)
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_topic_analysis(self, user_id: str) -> Dict[str, Any]:
        """
        Analyze performance across different categories based on all attempts.
        Returns a dict mapping categories to performance metrics.
        """
        attempts = await self.list_by_user(user_id, limit=100)
        
        analysis = {} # category -> {correct, total}
        
        for attempt in attempts:
            if not attempt.answers:
                continue
                
            for q_id, data in attempt.answers.items():
                cat = data.get('category', 'GENERAL')
                if cat not in analysis:
                    analysis[cat] = {'correct': 0, 'total': 0}
                
                weight = data.get('marks', 1) or 1
                analysis[cat]['total'] += weight
                if data.get('is_correct'):
                    analysis[cat]['correct'] += weight
                    
        # Calculate percentage for each topic
        final_analysis = []
        for cat, stats in analysis.items():
            percentage = (stats['correct'] / stats['total'] * 100) if stats['total'] > 0 else 0
            final_analysis.append({
                "category": cat,
                "correct": stats['correct'],
                "total": stats['total'],
                "accuracy": round(percentage, 1)
            })
            
        return final_analysis

    async def get_overall_stats(self, user_id: str) -> Dict[str, Any]:
        """Get high-level stats for the student dashboard."""
        query = select(
            func.count(AptitudeAttempt.id).label('total_attempts'),
            func.avg(AptitudeAttempt.score).label('avg_score'),
            func.max(AptitudeAttempt.score).label('best_score')
        ).where(and_(
            AptitudeAttempt.user_id == user_id,
            AptitudeAttempt.completed_at.is_not(None)
        ))
        
        result = await self.db.execute(query)
        row = result.first()
        
        return {
            "total_attempts": row.total_attempts or 0,
            "average_score": round(float(row.avg_score or 0), 1),
            "best_score": round(float(row.best_score or 0), 1)
        }

    async def delete_by_id(self, attempt_id: str) -> bool:
        """Delete an attempt by ID."""
        await self.db.execute(
            delete(AptitudeAttempt).where(AptitudeAttempt.id == attempt_id)
        )
        await self.db.commit()
        return True
