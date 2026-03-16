"""
Coding Problem Repository Implementation.
Data access layer for coding practice problems.
"""
from typing import List, Optional
from uuid import uuid4

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import DifficultyLevel
from app.infrastructure.database.models import CodingProblem


class CodingProblemRepositoryImpl:
    """Repository for coding problem operations."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        title: str,
        description: str,
        difficulty: DifficultyLevel,
        input_format: Optional[str],
        output_format: Optional[str],
        constraints: Optional[str],
        test_cases: List[dict],
        tags: Optional[List[str]] = None,
        time_limit_ms: int = 2000,
        memory_limit_mb: int = 256,
    ) -> CodingProblem:
        """Create a new coding problem."""
        problem = CodingProblem(
            id=str(uuid4()),
            title=title,
            description=description,
            difficulty=difficulty,
            input_format=input_format,
            output_format=output_format,
            constraints=constraints,
            test_cases=test_cases,
            tags=tags or [],
            time_limit_ms=time_limit_ms,
            memory_limit_mb=memory_limit_mb,
            is_active=True,
        )
        self.session.add(problem)
        await self.session.commit()
        await self.session.refresh(problem)
        return problem

    async def get_by_id(self, problem_id: str) -> Optional[CodingProblem]:
        """Get problem by ID."""
        result = await self.session.execute(
            select(CodingProblem).where(CodingProblem.id == problem_id)
        )
        return result.scalar_one_or_none()

    async def list_active(
        self,
        difficulty: Optional[DifficultyLevel] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> List[CodingProblem]:
        """List active coding problems with optional difficulty filter."""
        query = select(CodingProblem).where(CodingProblem.is_active.is_(True))
        if difficulty:
            query = query.where(CodingProblem.difficulty == difficulty)
        query = query.order_by(desc(CodingProblem.created_at)).limit(limit).offset(offset)
        result = await self.session.execute(query)
        return list(result.scalars().all())
