"""
Repository implementation for Aptitude Questions.
"""
from typing import List, Optional
from uuid import uuid4

from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import AptitudeQuestion
from app.core.constants import AptitudeCategory, DifficultyLevel


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
            created_by=created_by,
            is_active=True,
        )
        self.db.add(question)
        await self.db.commit()
        await self.db.refresh(question)
        return question
    
    async def bulk_create(self, questions: List[dict], created_by: Optional[str] = None) -> List[AptitudeQuestion]:
        """Bulk create aptitude questions."""
        created = []
        for q in questions:
            question = AptitudeQuestion(
                id=str(uuid4()),
                question_text=q["question_text"],
                options=q["options"],
                correct_option=q["correct_option"].upper(),
                category=AptitudeCategory(q["category"]),
                difficulty=DifficultyLevel(q["difficulty"]),
                explanation=q.get("explanation"),
                created_by=created_by,
                is_active=True,
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
        is_active: Optional[bool] = True,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[AptitudeQuestion]:
        """List questions with optional filters."""
        query = select(AptitudeQuestion)
        
        conditions = []
        if category:
            conditions.append(AptitudeQuestion.category == category)
        if difficulty:
            conditions.append(AptitudeQuestion.difficulty == difficulty)
        if is_active is not None:
            conditions.append(AptitudeQuestion.is_active == is_active)
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
        is_active: Optional[bool] = True,
    ) -> int:
        """Count questions with filters."""
        query = select(func.count(AptitudeQuestion.id))
        
        conditions = []
        if category:
            conditions.append(AptitudeQuestion.category == category)
        if difficulty:
            conditions.append(AptitudeQuestion.difficulty == difficulty)
        if is_active is not None:
            conditions.append(AptitudeQuestion.is_active == is_active)
        
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
            count = await self.count_questions(category=cat, is_active=True)
            category_counts[cat.value] = count
        
        # Count by difficulty
        difficulty_counts = {}
        for diff in DifficultyLevel:
            count = await self.count_questions(difficulty=diff, is_active=True)
            difficulty_counts[diff.value] = count
        
        total = await self.count_questions(is_active=True)
        
        return {
            "total": total,
            "by_category": category_counts,
            "by_difficulty": difficulty_counts,
        }
