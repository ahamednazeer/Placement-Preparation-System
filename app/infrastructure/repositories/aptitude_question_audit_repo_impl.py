"""
Repository for aptitude question audit logs.
"""
from typing import Optional
from uuid import uuid4

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import AptitudeQuestionAuditLog


class AptitudeQuestionAuditRepositoryImpl:
    """Create audit log entries."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create(
        self,
        action: str,
        question_id: Optional[str] = None,
        actor_id: Optional[str] = None,
        before_data: Optional[dict] = None,
        after_data: Optional[dict] = None,
    ) -> AptitudeQuestionAuditLog:
        log = AptitudeQuestionAuditLog(
            id=str(uuid4()),
            question_id=question_id,
            action=action,
            actor_id=actor_id,
            before_data=before_data,
            after_data=after_data,
        )
        self.db.add(log)
        await self.db.flush()
        await self.db.refresh(log)
        return log

    async def list(
        self,
        question_id: Optional[str] = None,
        action: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[AptitudeQuestionAuditLog]:
        query = select(AptitudeQuestionAuditLog)
        if question_id:
            query = query.where(AptitudeQuestionAuditLog.question_id == question_id)
        if action:
            query = query.where(AptitudeQuestionAuditLog.action == action)
        query = query.order_by(AptitudeQuestionAuditLog.created_at.desc()).offset(offset).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def count(
        self,
        question_id: Optional[str] = None,
        action: Optional[str] = None,
    ) -> int:
        query = select(func.count(AptitudeQuestionAuditLog.id))
        if question_id:
            query = query.where(AptitudeQuestionAuditLog.question_id == question_id)
        if action:
            query = query.where(AptitudeQuestionAuditLog.action == action)
        result = await self.db.execute(query)
        return result.scalar() or 0
