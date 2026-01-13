"""
Service layer for Aptitude Attempt management.
"""
from typing import List, Optional, Tuple, Dict, Any
from datetime import datetime
import random

from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.repositories.aptitude_attempt_repo_impl import AptitudeAttemptRepositoryImpl
from app.infrastructure.repositories.aptitude_question_repo_impl import AptitudeQuestionRepositoryImpl
from app.infrastructure.repositories.profile_repo_impl import ProfileRepositoryImpl
from app.infrastructure.database.models import AptitudeAttempt, AptitudeQuestion
from app.core.constants import AptitudeCategory, DifficultyLevel, ProfileStatus


class AptitudeAttemptService:
    """Business logic for student aptitude test attempts."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = AptitudeAttemptRepositoryImpl(db)
        self.question_repo = AptitudeQuestionRepositoryImpl(db)
        self.profile_repo = ProfileRepositoryImpl(db)
    
    async def start_assessment(
        self,
        user_id: str,
        category: Optional[AptitudeCategory] = None,
        count: int = 10,
    ) -> Tuple[AptitudeAttempt, List[AptitudeQuestion]]:
        """
        Initialize a new assessment.
        Selects random questions and creates an attempt record.
        """
        # 1. Fetch questions based on selection
        # For mixed mode, we distribute across categories
        questions = []
        if category:
            questions = await self.question_repo.list_questions(
                category=category, 
                limit=count * 2 # Get more to randomize
            )
        else:
            # Simple random fetch for all categories
            questions = await self.question_repo.list_questions(limit=count * 3)
            
        if len(questions) < count:
            # Not enough questions, just take what we have or raise
            pass
            
        random.shuffle(questions)
        selected_questions = questions[:count]
        
        # 2. Create attempt record
        attempt = await self.repo.create(
            user_id=user_id,
            total_questions=len(selected_questions),
            category=category
        )
        
        return attempt, selected_questions

    async def submit_assessment(
        self,
        attempt_id: str,
        user_id: str,
        user_answers: Dict[str, str], # question_id -> selected_option
        time_taken_seconds: int
    ) -> AptitudeAttempt:
        """
        Submit answers, calculate score, and update profile.
        """
        attempt = await self.repo.get_by_id(attempt_id)
        if not attempt or attempt.user_id != user_id:
            raise ValueError("Attempt not found")
            
        if attempt.completed_at:
            raise ValueError("Assessment already submitted")

        # 1. Calculate Results
        correct_count = 0
        wrong_count = 0
        skipped_count = 0
        results_answers = {}
        
        # We need to fetch the questions again to verify answers
        for q_id, selected in user_answers.items():
            question = await self.question_repo.get_by_id(q_id)
            if not question:
                continue
                
            is_correct = False
            if selected:
                is_correct = (selected.upper() == question.correct_option.upper())
                if is_correct:
                    correct_count += 1
                else:
                    wrong_count += 1
            else:
                skipped_count += 1
                
            results_answers[q_id] = {
                "selected": selected,
                "is_correct": is_correct,
                "correct_option": question.correct_option,
                "category": question.category.value
            }

        # Handle questions that weren't in user_answers but were part of the test?
        # In this simple implementation, we assume user_answers contains all seen questions.
        
        score = (correct_count / attempt.total_questions * 100) if attempt.total_questions > 0 else 0
        
        # 2. Update Attempt
        updated_attempt = await self.repo.update(
            attempt_id,
            completed_at=datetime.utcnow(),
            correct_answers=correct_count,
            wrong_answers=wrong_count,
            skipped=skipped_count,
            score=round(score, 1),
            time_taken_seconds=time_taken_seconds,
            answers=results_answers
        )
        
        # 3. Update User Profile readiness score
        await self._sync_profile_aptitude_score(user_id)
        
        return updated_attempt

    async def _sync_profile_aptitude_score(self, user_id: str):
        """Update the student's overall aptitude score in their profile."""
        attempts = await self.repo.list_by_user(user_id, limit=5) # Average of last 5
        completed_attempts = [a for a in attempts if a.completed_at]
        
        if not completed_attempts:
            return
            
        avg_score = sum(a.score for a in completed_attempts) / len(completed_attempts)
        
        # Update profile
        await self.profile_repo.update(
            user_id, 
            aptitude_score=round(avg_score, 1)
        )
        
        # Calculate overall readiness (placeholder logic, usually done in profile service)
        profile = await self.profile_repo.get_by_user_id(user_id)
        if profile:
            overall = (profile.aptitude_score + profile.interview_score + profile.coding_score) / 3
            await self.profile_repo.update(user_id, overall_readiness=round(overall, 1))

    async def get_test_history(self, user_id: str) -> List[AptitudeAttempt]:
        return await self.repo.list_by_user(user_id)
        
    async def get_attempt_details(self, attempt_id: str, user_id: str) -> Dict[str, Any]:
        attempt = await self.repo.get_by_id(attempt_id)
        if not attempt or attempt.user_id != user_id:
            return None
            
        # Get question details for review
        detailed_answers = []
        for q_id, data in attempt.answers.items():
            question = await self.question_repo.get_by_id(q_id)
            if question:
                detailed_answers.append({
                    "id": q_id,
                    "question_text": question.question_text,
                    "options": question.options,
                    "correct_option": question.correct_option,
                    "explanation": question.explanation,
                    "selected_option": data.get('selected'),
                    "is_correct": data.get('is_correct'),
                    "category": question.category.value
                })
                
        return {
            "attempt": attempt,
            "detailed_answers": detailed_answers
        }

    async def get_student_dashboard_stats(self, user_id: str) -> Dict[str, Any]:
        stats = await self.repo.get_overall_stats(user_id)
        analysis = await self.repo.get_topic_analysis(user_id)
        return {
            "stats": stats,
            "topic_analysis": analysis
        }
