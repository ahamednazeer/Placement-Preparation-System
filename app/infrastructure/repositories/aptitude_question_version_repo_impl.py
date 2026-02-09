"""
Repository for aptitude question versions.
"""
from typing import Optional
from uuid import uuid4

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import AptitudeQuestionVersion


class AptitudeQuestionVersionRepositoryImpl:
    """Create and fetch question versions."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create(
        self,
        question_id: str,
        version_number: int,
        snapshot: dict,
        changed_by: Optional[str] = None,
        change_reason: Optional[str] = None,
    ) -> AptitudeQuestionVersion:
        version = AptitudeQuestionVersion(
            id=str(uuid4()),
            question_id=question_id,
            version_number=version_number,
            snapshot=snapshot,
            changed_by=changed_by,
            change_reason=change_reason,
        )
        self.db.add(version)
        await self.db.flush()
        await self.db.refresh(version)
        return version

    async def list_by_question_id(
        self,
        question_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> list[AptitudeQuestionVersion]:
        result = await self.db.execute(
            select(AptitudeQuestionVersion)
            .where(AptitudeQuestionVersion.question_id == question_id)
            .order_by(AptitudeQuestionVersion.changed_at.desc())
            .offset(offset)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def count_by_question_id(self, question_id: str) -> int:
        result = await self.db.execute(
            select(func.count(AptitudeQuestionVersion.id))
            .where(AptitudeQuestionVersion.question_id == question_id)
        )
        return result.scalar() or 0
