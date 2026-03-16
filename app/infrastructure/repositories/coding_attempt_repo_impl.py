"""
Coding Attempt Repository Implementation.
Data access layer for coding attempts.
"""
from typing import List, Optional
from uuid import uuid4

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import CodingLanguage
from app.infrastructure.database.models import CodingAttempt


class CodingAttemptRepositoryImpl:
    """Repository for coding attempt operations."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        user_id: str,
        problem_id: str,
        language: CodingLanguage,
        code: str,
        is_accepted: bool,
        tests_passed: int,
        tests_total: int,
        error_message: Optional[str] = None,
        execution_time_ms: Optional[int] = None,
        memory_used_mb: Optional[float] = None,
    ) -> CodingAttempt:
        """Create a new coding attempt."""
        attempt = CodingAttempt(
            id=str(uuid4()),
            user_id=user_id,
            problem_id=problem_id,
            language=language,
            code=code,
            is_accepted=is_accepted,
            tests_passed=tests_passed,
            tests_total=tests_total,
            execution_time_ms=execution_time_ms,
            memory_used_mb=memory_used_mb,
            error_message=error_message,
        )
        self.session.add(attempt)
        await self.session.commit()
        await self.session.refresh(attempt)
        return attempt

    async def list_by_user_and_problem(
        self,
        user_id: str,
        problem_id: str,
        limit: int = 10,
        offset: int = 0,
    ) -> List[CodingAttempt]:
        """List recent attempts for a problem by user."""
        result = await self.session.execute(
            select(CodingAttempt)
            .where(
                CodingAttempt.user_id == user_id,
                CodingAttempt.problem_id == problem_id,
            )
            .order_by(desc(CodingAttempt.submitted_at))
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all())

    async def list_by_user(
        self,
        user_id: str,
        limit: int = 10,
        offset: int = 0,
    ) -> List[CodingAttempt]:
        """List recent attempts by user."""
        result = await self.session.execute(
            select(CodingAttempt)
            .where(CodingAttempt.user_id == user_id)
            .order_by(desc(CodingAttempt.submitted_at))
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all())

    async def get_overall_stats(self, user_id: str) -> dict:
        """Compute overall coding stats for a user."""
        attempts = await self.list_by_user(user_id, limit=100)
        scored = []
        for attempt in attempts:
            total = attempt.tests_total or 0
            passed = attempt.tests_passed or 0
            if total > 0:
                scored.append((passed / total) * 100)
        if not scored:
            return {"total_attempts": 0, "average_score": 0, "best_score": 0}
        avg_score = round(sum(scored) / len(scored), 1)
        best_score = round(max(scored), 1)
        return {
            "total_attempts": len(scored),
            "average_score": avg_score,
            "best_score": best_score,
        }
