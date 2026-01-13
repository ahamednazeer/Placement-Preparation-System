"""
Service layer for Aptitude Question management.
"""
import csv
import io
from typing import List, Optional, Tuple

from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.repositories.aptitude_question_repo_impl import AptitudeQuestionRepositoryImpl
from app.infrastructure.database.models import AptitudeQuestion
from app.core.constants import AptitudeCategory, DifficultyLevel


class AptitudeQuestionService:
    """Business logic for aptitude question management."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = AptitudeQuestionRepositoryImpl(db)
    
    async def create_question(
        self,
        question_text: str,
        options: dict,
        correct_option: str,
        category: AptitudeCategory,
        difficulty: DifficultyLevel,
        explanation: Optional[str] = None,
        created_by: Optional[str] = None,
    ) -> AptitudeQuestion:
        """Create a new question with validation."""
        # Validate options format
        self._validate_options(options)
        self._validate_correct_option(correct_option, options)
        
        return await self.repo.create(
            question_text=question_text.strip(),
            options=options,
            correct_option=correct_option.upper(),
            category=category,
            difficulty=difficulty,
            explanation=explanation.strip() if explanation else None,
            created_by=created_by,
        )
    
    def _validate_options(self, options: dict) -> None:
        """Validate options format."""
        required_keys = {"A", "B", "C", "D"}
        if not isinstance(options, dict):
            raise ValueError("Options must be a dictionary")
        if set(options.keys()) != required_keys:
            raise ValueError("Options must contain exactly keys A, B, C, D")
        for key, value in options.items():
            if not value or not isinstance(value, str) or not value.strip():
                raise ValueError(f"Option {key} cannot be empty")
    
    def _validate_correct_option(self, correct_option: str, options: dict) -> None:
        """Validate correct option is valid."""
        if correct_option.upper() not in options:
            raise ValueError(f"Correct option '{correct_option}' is not in options")
    
    async def get_question(self, question_id: str) -> Optional[AptitudeQuestion]:
        """Get question by ID."""
        return await self.repo.get_by_id(question_id)
    
    async def list_questions(
        self,
        category: Optional[str] = None,
        difficulty: Optional[str] = None,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[List[AptitudeQuestion], int]:
        """List questions with pagination."""
        cat = AptitudeCategory(category) if category else None
        diff = DifficultyLevel(difficulty) if difficulty else None
        
        offset = (page - 1) * page_size
        questions = await self.repo.list_questions(
            category=cat,
            difficulty=diff,
            search=search,
            limit=page_size,
            offset=offset,
        )
        total = await self.repo.count_questions(category=cat, difficulty=diff)
        
        return questions, total
    
    async def update_question(
        self,
        question_id: str,
        question_text: Optional[str] = None,
        options: Optional[dict] = None,
        correct_option: Optional[str] = None,
        category: Optional[AptitudeCategory] = None,
        difficulty: Optional[DifficultyLevel] = None,
        explanation: Optional[str] = None,
    ) -> Optional[AptitudeQuestion]:
        """Update a question."""
        if options:
            self._validate_options(options)
            if correct_option:
                self._validate_correct_option(correct_option, options)
        
        return await self.repo.update(
            question_id=question_id,
            question_text=question_text.strip() if question_text else None,
            options=options,
            correct_option=correct_option.upper() if correct_option else None,
            category=category,
            difficulty=difficulty,
            explanation=explanation.strip() if explanation else None,
        )
    
    async def delete_question(self, question_id: str) -> bool:
        """Soft delete a question."""
        return await self.repo.delete(question_id)
    
    async def parse_csv(self, csv_content: str) -> List[dict]:
        """Parse CSV content into question data.
        
        Expected CSV format:
        question_text,option_a,option_b,option_c,option_d,correct_option,category,difficulty,explanation
        """
        questions = []
        errors = []
        
        reader = csv.DictReader(io.StringIO(csv_content))
        
        for i, row in enumerate(reader, start=2):  # Start at 2 (header is row 1)
            try:
                # Normalize keys (handle different casing)
                row = {k.lower().strip(): v.strip() for k, v in row.items() if k}
                
                question = {
                    "question_text": row.get("question_text") or row.get("question") or "",
                    "options": {
                        "A": row.get("option_a") or row.get("a") or "",
                        "B": row.get("option_b") or row.get("b") or "",
                        "C": row.get("option_c") or row.get("c") or "",
                        "D": row.get("option_d") or row.get("d") or "",
                    },
                    "correct_option": (row.get("correct_option") or row.get("answer") or "A").upper(),
                    "category": (row.get("category") or row.get("topic") or "QUANTITATIVE").upper(),
                    "difficulty": (row.get("difficulty") or row.get("level") or "MEDIUM").upper(),
                    "explanation": row.get("explanation") or row.get("hint") or None,
                }
                
                # Validate
                if not question["question_text"]:
                    errors.append(f"Row {i}: Missing question text")
                    continue
                
                if question["correct_option"] not in ["A", "B", "C", "D"]:
                    errors.append(f"Row {i}: Invalid correct option '{question['correct_option']}'")
                    continue
                
                # Validate category
                try:
                    AptitudeCategory(question["category"])
                except ValueError:
                    # Map common variations
                    cat_map = {
                        "QUANT": "QUANTITATIVE",
                        "LOGIC": "LOGICAL",
                        "TECH": "TECHNICAL",
                        "DATA": "DATA_INTERPRETATION",
                    }
                    question["category"] = cat_map.get(question["category"], "QUANTITATIVE")
                
                # Validate difficulty
                try:
                    DifficultyLevel(question["difficulty"])
                except ValueError:
                    question["difficulty"] = "MEDIUM"
                
                questions.append(question)
                
            except Exception as e:
                errors.append(f"Row {i}: {str(e)}")
        
        if errors and len(errors) > 5:
            errors = errors[:5] + [f"... and {len(errors) - 5} more errors"]
        
        return questions, errors
    
    async def bulk_upload(self, csv_content: str, created_by: Optional[str] = None) -> Tuple[int, List[str]]:
        """Bulk upload questions from CSV content."""
        questions, errors = await self.parse_csv(csv_content)
        
        if not questions:
            return 0, errors or ["No valid questions found in CSV"]
        
        created = await self.repo.bulk_create(questions, created_by=created_by)
        
        return len(created), errors
    
    async def get_stats(self) -> dict:
        """Get question statistics."""
        return await self.repo.get_stats()
