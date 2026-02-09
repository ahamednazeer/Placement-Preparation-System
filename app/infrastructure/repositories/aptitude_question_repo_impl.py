"""
Repository implementation for Aptitude Questions.
"""
from typing import List, Optional
from uuid import uuid4

from sqlalchemy import select, func, and_, or_, cast, String
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import AptitudeQuestion
from app.core.constants import AptitudeCategory, DifficultyLevel, QuestionStatus, QuestionApprovalStatus


class AptitudeQuestionRepositoryImpl:
    """Repository for aptitude question CRUD operations."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create(
        self,
        question_text: str,
        options: dict,
        correct_option: str,
        category: AptitudeCategory,
        difficulty: DifficultyLevel,
        explanation: Optional[str] = None,
        sub_topic: Optional[str] = None,
        role_tag: Optional[str] = None,
        marks: int = 1,
        time_limit_seconds: Optional[int] = None,
        status: QuestionStatus = QuestionStatus.ACTIVE,
        approval_status: QuestionApprovalStatus = QuestionApprovalStatus.APPROVED,
        approved_by: Optional[str] = None,
        approved_at: Optional[object] = None,
        version_number: int = 1,
        previous_version_id: Optional[str] = None,
        created_by: Optional[str] = None,
    ) -> AptitudeQuestion:
        """Create a new aptitude question."""
        question = AptitudeQuestion(
            id=str(uuid4()),
            question_text=question_text,
            options=options,
            correct_option=correct_option.upper(),
            category=category,
            difficulty=difficulty,
            explanation=explanation,
            sub_topic=sub_topic,
            role_tag=role_tag,
            marks=marks,
            time_limit_seconds=time_limit_seconds,
            status=status,
            approval_status=approval_status,
            approved_by=approved_by,
            approved_at=approved_at,
            version_number=version_number,
            previous_version_id=previous_version_id,
            created_by=created_by,
            is_active=(status == QuestionStatus.ACTIVE),
        )
        self.db.add(question)
        await self.db.commit()
        await self.db.refresh(question)
        return question
    
    async def bulk_create(self, questions: List[dict], created_by: Optional[str] = None) -> List[AptitudeQuestion]:
        """Bulk create aptitude questions."""
        created = []
        for q in questions:
            status = QuestionStatus(q.get("status", QuestionStatus.ACTIVE))
            approval_status = QuestionApprovalStatus(q.get("approval_status", QuestionApprovalStatus.APPROVED))
            question = AptitudeQuestion(
                id=str(uuid4()),
                question_text=q["question_text"],
                options=q["options"],
                correct_option=q["correct_option"].upper(),
                category=AptitudeCategory(q["category"]),
                difficulty=DifficultyLevel(q["difficulty"]),
                explanation=q.get("explanation"),
                sub_topic=q.get("sub_topic"),
                role_tag=q.get("role_tag"),
                marks=q.get("marks", 1),
                time_limit_seconds=q.get("time_limit_seconds"),
                status=status,
                approval_status=approval_status,
                approved_by=q.get("approved_by"),
                approved_at=q.get("approved_at"),
                version_number=q.get("version_number", 1),
                previous_version_id=q.get("previous_version_id"),
                created_by=created_by,
                is_active=(status == QuestionStatus.ACTIVE),
            )
            self.db.add(question)
            created.append(question)
        
        await self.db.commit()
        for q in created:
            await self.db.refresh(q)
        return created
    
    async def get_by_id(self, question_id: str) -> Optional[AptitudeQuestion]:
        """Get question by ID."""
        result = await self.db.execute(
            select(AptitudeQuestion).where(AptitudeQuestion.id == question_id)
        )
        return result.scalar_one_or_none()
    
    async def list_questions(
        self,
        category: Optional[AptitudeCategory] = None,
        difficulty: Optional[DifficultyLevel] = None,
        status: Optional[QuestionStatus] = None,
        is_active: Optional[bool] = True,
        approval_status: Optional[QuestionApprovalStatus] = None,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[AptitudeQuestion]:
        """List questions with optional filters."""
        query = select(AptitudeQuestion)
        
        def status_value(value: Optional[QuestionStatus | str]) -> Optional[str]:
            if value is None:
                return None
            if isinstance(value, QuestionStatus):
                return value.value
            return str(value)

        def approval_value(value: Optional[QuestionApprovalStatus | str]) -> Optional[str]:
            if value is None:
                return None
            if isinstance(value, QuestionApprovalStatus):
                return value.value
            return str(value)

        conditions = []
        if category:
            conditions.append(AptitudeQuestion.category == category)
        if difficulty:
            conditions.append(AptitudeQuestion.difficulty == difficulty)
        if status is not None:
            status_val = status_value(status)
            conditions.append(cast(AptitudeQuestion.status, String) == status_val)
        elif is_active is not None:
            # Backward-compatible: include legacy rows without status
            if is_active:
                conditions.append(
                    or_(
                        cast(AptitudeQuestion.status, String) == QuestionStatus.ACTIVE.value,
                        AptitudeQuestion.status.is_(None)
                    )
                )
            else:
                conditions.append(
                    or_(
                        cast(AptitudeQuestion.status, String) == QuestionStatus.ARCHIVED.value,
                        AptitudeQuestion.status.is_(None)
                    )
                )
            conditions.append(AptitudeQuestion.is_active == is_active)
        if approval_status is not None:
            approval_val = approval_value(approval_status)
            conditions.append(cast(AptitudeQuestion.approval_status, String) == approval_val)
        if search:
            conditions.append(AptitudeQuestion.question_text.ilike(f"%{search}%"))
        
        if conditions:
            query = query.where(and_(*conditions))
        
        query = query.order_by(AptitudeQuestion.created_at.desc()).offset(offset).limit(limit)
        
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    async def count_questions(
        self,
        category: Optional[AptitudeCategory] = None,
        difficulty: Optional[DifficultyLevel] = None,
        status: Optional[QuestionStatus] = None,
        is_active: Optional[bool] = True,
        approval_status: Optional[QuestionApprovalStatus] = None,
    ) -> int:
        """Count questions with filters."""
        query = select(func.count(AptitudeQuestion.id))
        
        def status_value(value: Optional[QuestionStatus | str]) -> Optional[str]:
            if value is None:
                return None
            if isinstance(value, QuestionStatus):
                return value.value
            return str(value)

        def approval_value(value: Optional[QuestionApprovalStatus | str]) -> Optional[str]:
            if value is None:
                return None
            if isinstance(value, QuestionApprovalStatus):
                return value.value
            return str(value)

        conditions = []
        if category:
            conditions.append(AptitudeQuestion.category == category)
        if difficulty:
            conditions.append(AptitudeQuestion.difficulty == difficulty)
        if status is not None:
            status_val = status_value(status)
            conditions.append(cast(AptitudeQuestion.status, String) == status_val)
        elif is_active is not None:
            if is_active:
                conditions.append(
                    or_(
                        cast(AptitudeQuestion.status, String) == QuestionStatus.ACTIVE.value,
                        AptitudeQuestion.status.is_(None)
                    )
                )
            else:
                conditions.append(
                    or_(
                        cast(AptitudeQuestion.status, String) == QuestionStatus.ARCHIVED.value,
                        AptitudeQuestion.status.is_(None)
                    )
                )
            conditions.append(AptitudeQuestion.is_active == is_active)
        if approval_status is not None:
            approval_val = approval_value(approval_status)
            conditions.append(cast(AptitudeQuestion.approval_status, String) == approval_val)
        
        if conditions:
            query = query.where(and_(*conditions))
        
        result = await self.db.execute(query)
        return result.scalar() or 0
    
    async def update(
        self,
        question_id: str,
        question_text: Optional[str] = None,
        options: Optional[dict] = None,
        correct_option: Optional[str] = None,
        category: Optional[AptitudeCategory] = None,
        difficulty: Optional[DifficultyLevel] = None,
        explanation: Optional[str] = None,
        sub_topic: Optional[str] = None,
        role_tag: Optional[str] = None,
        marks: Optional[int] = None,
        time_limit_seconds: Optional[int] = None,
        status: Optional[QuestionStatus] = None,
        approval_status: Optional[QuestionApprovalStatus] = None,
        approved_by: Optional[str] = None,
        approved_at: Optional[object] = None,
        clear_approval: bool = False,
        version_number: Optional[int] = None,
        previous_version_id: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> Optional[AptitudeQuestion]:
        """Update an existing question."""
        question = await self.get_by_id(question_id)
        if not question:
            return None
        
        if question_text is not None:
            question.question_text = question_text
        if options is not None:
            question.options = options
        if correct_option is not None:
            question.correct_option = correct_option.upper()
        if category is not None:
            question.category = category
        if difficulty is not None:
            question.difficulty = difficulty
        if explanation is not None:
            question.explanation = explanation
        if sub_topic is not None:
            question.sub_topic = sub_topic
        if role_tag is not None:
            question.role_tag = role_tag
        if marks is not None:
            question.marks = marks
        if time_limit_seconds is not None:
            question.time_limit_seconds = time_limit_seconds
        if status is not None:
            question.status = status
            question.is_active = (status == QuestionStatus.ACTIVE)
        if approval_status is not None:
            question.approval_status = approval_status
        if clear_approval:
            question.approved_by = None
            question.approved_at = None
        else:
            if approved_by is not None:
                question.approved_by = approved_by
            if approved_at is not None:
                question.approved_at = approved_at
        if version_number is not None:
            question.version_number = version_number
        if previous_version_id is not None:
            question.previous_version_id = previous_version_id
        if is_active is not None:
            question.is_active = is_active
        
        await self.db.commit()
        await self.db.refresh(question)
        return question
    
    async def delete(self, question_id: str) -> bool:
        """Soft delete a question (set is_active=False)."""
        question = await self.get_by_id(question_id)
        if not question:
            return False
        
        question.is_active = False
        question.status = QuestionStatus.ARCHIVED
        await self.db.commit()
        return True
    
    async def hard_delete(self, question_id: str) -> bool:
        """Permanently delete a question."""
        question = await self.get_by_id(question_id)
        if not question:
            return False
        
        await self.db.delete(question)
        await self.db.commit()
        return True
    
    async def get_stats(self) -> dict:
        """Get question statistics by category and difficulty."""
        # Count by category
        category_counts = {}
        for cat in AptitudeCategory:
            count = await self.count_questions(category=cat, status=QuestionStatus.ACTIVE)
            category_counts[cat.value] = count
        
        # Count by difficulty
        difficulty_counts = {}
        for diff in DifficultyLevel:
            count = await self.count_questions(difficulty=diff, status=QuestionStatus.ACTIVE)
            difficulty_counts[diff.value] = count
        
        total = await self.count_questions(status=QuestionStatus.ACTIVE)
        
        return {
            "total": total,
            "by_category": category_counts,
            "by_difficulty": difficulty_counts,
        }

    async def exists_duplicate(
        self,
        question_text: str,
        category: AptitudeCategory,
        difficulty: DifficultyLevel,
    ) -> bool:
        """Check for duplicate questions by normalized text and tags."""
        normalized = " ".join(question_text.lower().split())
        result = await self.db.execute(
            select(func.count(AptitudeQuestion.id)).where(
                and_(
                    func.lower(AptitudeQuestion.question_text) == normalized,
                    AptitudeQuestion.category == category,
                    AptitudeQuestion.difficulty == difficulty,
                )
            )
        )
        return (result.scalar() or 0) > 0
