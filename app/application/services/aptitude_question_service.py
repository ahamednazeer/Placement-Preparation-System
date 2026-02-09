"""
Service layer for Aptitude Question management.
"""
import csv
import io
from datetime import datetime
from typing import List, Optional, Tuple, Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.repositories.aptitude_question_repo_impl import AptitudeQuestionRepositoryImpl
from app.infrastructure.repositories.aptitude_question_version_repo_impl import AptitudeQuestionVersionRepositoryImpl
from app.infrastructure.repositories.aptitude_question_audit_repo_impl import AptitudeQuestionAuditRepositoryImpl
from app.infrastructure.database.models import AptitudeQuestion
from app.core.constants import AptitudeCategory, DifficultyLevel, QuestionStatus, QuestionApprovalStatus, UserRole
from app.utils.logger import logger
from app.application.services.ai_service import get_ai_service


class AptitudeQuestionService:
    """Business logic for aptitude question management."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = AptitudeQuestionRepositoryImpl(db)
        self.version_repo = AptitudeQuestionVersionRepositoryImpl(db)
        self.audit_repo = AptitudeQuestionAuditRepositoryImpl(db)
    
    async def create_question(
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
        created_by_role: Optional[UserRole] = None,
        created_by: Optional[str] = None,
    ) -> AptitudeQuestion:
        """Create a new question with validation."""
        # Validate options format
        self._validate_options(options)
        self._validate_correct_option(correct_option, options)
        self._validate_marks(marks)
        self._validate_time_limit(time_limit_seconds)
        
        # Duplicate check (same text/category/difficulty)
        if await self.repo.exists_duplicate(question_text, category, difficulty):
            raise ValueError("Duplicate question detected")
        
        submitted_for_approval = created_by_role == UserRole.PLACEMENT_OFFICER and status == QuestionStatus.ACTIVE

        approval_status = QuestionApprovalStatus.APPROVED
        approved_by = created_by if created_by_role == UserRole.ADMIN else None
        approved_at = datetime.utcnow() if created_by_role == UserRole.ADMIN else None
        
        # Officers must go through approval workflow
        if created_by_role == UserRole.PLACEMENT_OFFICER:
            if status == QuestionStatus.ACTIVE:
                approval_status = QuestionApprovalStatus.PENDING
            else:
                approval_status = QuestionApprovalStatus.DRAFT
        
        question = await self.repo.create(
            question_text=question_text.strip(),
            options=options,
            correct_option=correct_option.upper(),
            category=category,
            difficulty=difficulty,
            explanation=explanation.strip() if explanation else None,
            sub_topic=sub_topic.strip() if sub_topic else None,
            role_tag=role_tag.strip() if role_tag else None,
            marks=marks,
            time_limit_seconds=time_limit_seconds,
            status=status,
            approval_status=approval_status,
            approved_by=approved_by,
            approved_at=approved_at,
            created_by=created_by,
        )
        await self.audit_repo.create(
            action="CREATE",
            question_id=question.id,
            actor_id=created_by,
            before_data=None,
            after_data=self._snapshot(question),
        )
        if submitted_for_approval:
            await self.audit_repo.create(
                action="SUBMIT_FOR_APPROVAL",
                question_id=question.id,
                actor_id=created_by,
                before_data=None,
                after_data=self._snapshot(question),
            )
        logger.info(f"Aptitude question created: {question.id}")
        return question

    def _normalize_ai_question(
        self,
        raw: Any,
        fallback_sub_topic: Optional[str],
        fallback_role_tag: Optional[str],
    ) -> dict:
        if not isinstance(raw, dict):
            raise ValueError("AI question is not a JSON object")

        question_text = str(raw.get("question_text", "")).strip()
        if len(question_text) < 10:
            raise ValueError("Question text is too short")

        options_raw = raw.get("options")
        options: dict
        if isinstance(options_raw, list) and len(options_raw) == 4:
            options = {k: str(v).strip() for k, v in zip(["A", "B", "C", "D"], options_raw)}
        elif isinstance(options_raw, dict):
            options = {str(k).strip().upper(): str(v).strip() for k, v in options_raw.items()}
        else:
            raise ValueError("Options must be a dict with A-D or a list of 4 items")

        required_keys = {"A", "B", "C", "D"}
        if set(options.keys()) != required_keys:
            raise ValueError("Options must contain exactly A, B, C, D")

        correct_option = raw.get("correct_option") or raw.get("answer")
        if not correct_option:
            raise ValueError("Correct option is missing")

        correct_option_str = str(correct_option).strip()
        correct_key = correct_option_str.upper()
        if correct_key not in options:
            # Try matching by option text
            match_key = None
            for key, value in options.items():
                if value.strip().lower() == correct_option_str.lower():
                    match_key = key
                    break
            if not match_key:
                raise ValueError("Correct option does not match options")
            correct_key = match_key

        explanation = raw.get("explanation") or raw.get("reason")
        if explanation:
            explanation = str(explanation).strip()

        sub_topic = raw.get("sub_topic") or fallback_sub_topic
        role_tag = raw.get("role_tag") or fallback_role_tag

        return {
            "question_text": question_text,
            "options": options,
            "correct_option": correct_key,
            "explanation": explanation,
            "sub_topic": str(sub_topic).strip() if sub_topic else None,
            "role_tag": str(role_tag).strip() if role_tag else None,
        }

    async def generate_questions_with_ai(
        self,
        category: AptitudeCategory,
        difficulty: DifficultyLevel,
        count: int,
        sub_topic: Optional[str] = None,
        role_tag: Optional[str] = None,
        marks: int = 1,
        time_limit_seconds: Optional[int] = None,
        status: QuestionStatus = QuestionStatus.DRAFT,
        instructions: Optional[str] = None,
        created_by_role: Optional[UserRole] = None,
        created_by: Optional[str] = None,
    ) -> Tuple[List[AptitudeQuestion], List[str]]:
        ai_service = get_ai_service()
        raw_questions = await ai_service.generate_aptitude_questions(
            category=category,
            difficulty=difficulty,
            count=count,
            sub_topic=sub_topic,
            role_tag=role_tag,
            marks=marks,
            time_limit_seconds=time_limit_seconds,
            instructions=instructions,
        )

        created: List[AptitudeQuestion] = []
        errors: List[str] = []

        for idx, raw in enumerate(raw_questions):
            try:
                normalized = self._normalize_ai_question(raw, sub_topic, role_tag)
                question = await self.create_question(
                    question_text=normalized["question_text"],
                    options=normalized["options"],
                    correct_option=normalized["correct_option"],
                    category=category,
                    difficulty=difficulty,
                    explanation=normalized.get("explanation"),
                    sub_topic=normalized.get("sub_topic"),
                    role_tag=normalized.get("role_tag"),
                    marks=marks,
                    time_limit_seconds=time_limit_seconds,
                    status=status,
                    created_by_role=created_by_role,
                    created_by=created_by,
                )
                created.append(question)
            except Exception as e:
                errors.append(f"Q{idx + 1}: {str(e)}")

        return created, errors
    
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
    
    def _validate_marks(self, marks: int) -> None:
        if marks < 1 or marks > 10:
            raise ValueError("Marks must be between 1 and 10")
    
    def _validate_time_limit(self, time_limit_seconds: Optional[int]) -> None:
        if time_limit_seconds is None:
            return
        if time_limit_seconds < 10 or time_limit_seconds > 3600:
            raise ValueError("Time limit must be between 10 and 3600 seconds")
    
    async def get_question(self, question_id: str) -> Optional[AptitudeQuestion]:
        """Get question by ID."""
        return await self.repo.get_by_id(question_id)
    
    async def list_questions(
        self,
        category: Optional[str] = None,
        difficulty: Optional[str] = None,
        status: Optional[str] = None,
        approval_status: Optional[str] = None,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
        include_inactive: bool = False,
    ) -> Tuple[List[AptitudeQuestion], int]:
        """List questions with pagination."""
        cat = AptitudeCategory(category) if category else None
        diff = DifficultyLevel(difficulty) if difficulty else None
        stat = QuestionStatus(status) if status else None
        appr = QuestionApprovalStatus(approval_status) if approval_status else None
        
        offset = (page - 1) * page_size
        
        questions = await self.repo.list_questions(
            category=cat,
            difficulty=diff,
            status=stat,
            is_active=None if include_inactive else True,
            approval_status=appr,
            search=search,
            limit=page_size,
            offset=offset,
        )
        total = await self.repo.count_questions(
            category=cat,
            difficulty=diff,
            status=stat,
            is_active=None if include_inactive else True,
            approval_status=appr,
        )
        
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
        sub_topic: Optional[str] = None,
        role_tag: Optional[str] = None,
        marks: Optional[int] = None,
        time_limit_seconds: Optional[int] = None,
        status: Optional[QuestionStatus] = None,
        created_by_role: Optional[UserRole] = None,
        changed_by: Optional[str] = None,
        change_reason: Optional[str] = None,
    ) -> Optional[AptitudeQuestion]:
        """Update a question."""
        if options:
            self._validate_options(options)
            if correct_option:
                self._validate_correct_option(correct_option, options)
        if marks is not None:
            self._validate_marks(marks)
        if time_limit_seconds is not None:
            self._validate_time_limit(time_limit_seconds)
        
        existing = await self.repo.get_by_id(question_id)
        if not existing:
            return None
        
        # Version snapshot (before update)
        version = await self.version_repo.create(
            question_id=existing.id,
            version_number=existing.version_number,
            snapshot=self._snapshot(existing),
            changed_by=changed_by,
            change_reason=change_reason,
        )
        
        new_version = existing.version_number + 1
        
        # Approval workflow: officer edits require re-approval
        submitted_for_approval = created_by_role == UserRole.PLACEMENT_OFFICER and status == QuestionStatus.ACTIVE
        approval_status = None
        approved_by = None
        approved_at = None
        clear_approval = False
        if created_by_role == UserRole.PLACEMENT_OFFICER:
            if status == QuestionStatus.ACTIVE:
                approval_status = QuestionApprovalStatus.PENDING
            else:
                approval_status = QuestionApprovalStatus.DRAFT
            clear_approval = True
        elif created_by_role == UserRole.ADMIN:
            if status == QuestionStatus.ACTIVE:
                approval_status = QuestionApprovalStatus.APPROVED
                approved_by = changed_by
                approved_at = datetime.utcnow()
        
        question = await self.repo.update(
            question_id=question_id,
            question_text=question_text.strip() if question_text else None,
            options=options,
            correct_option=correct_option.upper() if correct_option else None,
            category=category,
            difficulty=difficulty,
            explanation=explanation.strip() if explanation else None,
            sub_topic=sub_topic.strip() if sub_topic else None,
            role_tag=role_tag.strip() if role_tag else None,
            marks=marks,
            time_limit_seconds=time_limit_seconds,
            status=status,
            approval_status=approval_status,
            approved_by=approved_by,
            approved_at=approved_at,
            clear_approval=clear_approval,
            version_number=new_version,
            previous_version_id=version.id,
        )
        if question:
            await self.audit_repo.create(
                action="UPDATE",
                question_id=question.id,
                actor_id=changed_by,
                before_data=self._snapshot(existing),
                after_data=self._snapshot(question),
            )
            if submitted_for_approval:
                await self.audit_repo.create(
                    action="SUBMIT_FOR_APPROVAL",
                    question_id=question.id,
                    actor_id=changed_by,
                    before_data=self._snapshot(existing),
                    after_data=self._snapshot(question),
                )
            logger.info(f"Aptitude question updated: {question.id} v{new_version}")
        return question
    
    async def delete_question(self, question_id: str, actor_id: Optional[str] = None) -> bool:
        """Soft delete a question."""
        existing = await self.repo.get_by_id(question_id)
        deleted = await self.repo.delete(question_id)
        if deleted:
            await self.audit_repo.create(
                action="ARCHIVE",
                question_id=question_id,
                actor_id=actor_id,
                before_data=self._snapshot(existing) if existing else None,
                after_data=None,
            )
            logger.info(f"Aptitude question archived: {question_id}")
        return deleted
    
    async def parse_csv(self, csv_content: str) -> Tuple[List[dict], List[str]]:
        """Parse CSV content into question data.
        
        Expected CSV format:
        question_text,option_a,option_b,option_c,option_d,correct_option,category,difficulty,explanation,sub_topic,marks,status,time_limit_seconds,role_tag,approval_status
        """
        questions = []
        errors = []
        
        reader = csv.DictReader(io.StringIO(csv_content))
        
        for i, row in enumerate(reader, start=2):  # Start at 2 (header is row 1)
            try:
                # Normalize keys (handle different casing)
                row = {k.lower().strip(): v.strip() for k, v in row.items() if k}
                
                marks_raw = row.get("marks")
                try:
                    marks_val = int(marks_raw) if marks_raw else 1
                except Exception:
                    marks_val = 1
                
                time_raw = row.get("time_limit_seconds") or row.get("time_limit")
                try:
                    time_val = int(time_raw) if time_raw else None
                except Exception:
                    time_val = None
                
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
                    "sub_topic": row.get("sub_topic") or row.get("subtopic") or None,
                    "marks": marks_val,
                    "status": (row.get("status") or "ACTIVE").upper(),
                    "time_limit_seconds": time_val,
                    "role_tag": row.get("role_tag") or row.get("role") or None,
                    "approval_status": (row.get("approval_status") or "APPROVED").upper(),
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
                
                # Validate status
                try:
                    QuestionStatus(question["status"])
                except ValueError:
                    question["status"] = "ACTIVE"
                
                # Validate approval status
                try:
                    QuestionApprovalStatus(question["approval_status"])
                except ValueError:
                    question["approval_status"] = "APPROVED"
                
                # Validate marks / time limit
                try:
                    self._validate_marks(int(question["marks"]))
                except Exception:
                    question["marks"] = 1
                try:
                    self._validate_time_limit(question["time_limit_seconds"])
                except Exception:
                    question["time_limit_seconds"] = None
                
                questions.append(question)
                
            except Exception as e:
                errors.append(f"Row {i}: {str(e)}")
        
        if errors and len(errors) > 5:
            errors = errors[:5] + [f"... and {len(errors) - 5} more errors"]
        
        return questions, errors
    
    async def bulk_upload(
        self,
        csv_content: str,
        created_by: Optional[str] = None,
        created_by_role: Optional[UserRole] = None,
    ) -> Tuple[int, List[str]]:
        """Bulk upload questions from CSV content."""
        questions, errors = await self.parse_csv(csv_content)
        
        if not questions:
            return 0, errors or ["No valid questions found in CSV"]
        
        if created_by_role == UserRole.PLACEMENT_OFFICER:
            for q in questions:
                current_status = q.get("status")
                if current_status == QuestionStatus.ACTIVE or str(current_status) == QuestionStatus.ACTIVE.value:
                    q["approval_status"] = QuestionApprovalStatus.PENDING
                else:
                    q["approval_status"] = QuestionApprovalStatus.DRAFT
        
        created = await self.repo.bulk_create(questions, created_by=created_by)
        for q in created:
            await self.audit_repo.create(
                action="BULK_CREATE",
                question_id=q.id,
                actor_id=created_by,
                before_data=None,
                after_data=self._snapshot(q),
            )
            if getattr(q, "approval_status", None) == QuestionApprovalStatus.PENDING:
                await self.audit_repo.create(
                    action="SUBMIT_FOR_APPROVAL",
                    question_id=q.id,
                    actor_id=created_by,
                    before_data=None,
                    after_data=self._snapshot(q),
                )
        
        return len(created), errors

    async def approve_question(self, question_id: str, approver_id: str) -> Optional[AptitudeQuestion]:
        """Approve a question."""
        question = await self.repo.update(
            question_id=question_id,
            approval_status=QuestionApprovalStatus.APPROVED,
            approved_by=approver_id,
            approved_at=datetime.utcnow(),
            status=QuestionStatus.ACTIVE,
        )
        if question:
            await self.audit_repo.create(
                action="APPROVE",
                question_id=question_id,
                actor_id=approver_id,
                before_data=None,
                after_data=self._snapshot(question),
            )
        return question
    
    async def reject_question(self, question_id: str, approver_id: str) -> Optional[AptitudeQuestion]:
        """Reject a question."""
        question = await self.repo.update(
            question_id=question_id,
            approval_status=QuestionApprovalStatus.REJECTED,
            approved_by=approver_id,
            approved_at=datetime.utcnow(),
            status=QuestionStatus.DRAFT,
        )
        if question:
            await self.audit_repo.create(
                action="REJECT",
                question_id=question_id,
                actor_id=approver_id,
                before_data=None,
                after_data=self._snapshot(question),
            )
        return question

    async def get_versions(
        self,
        question_id: str,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Any], int]:
        offset = (page - 1) * page_size
        versions = await self.version_repo.list_by_question_id(question_id, limit=page_size, offset=offset)
        total = await self.version_repo.count_by_question_id(question_id)
        return versions, total
    
    async def get_audit_logs(
        self,
        question_id: Optional[str] = None,
        action: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Any], int]:
        offset = (page - 1) * page_size
        logs = await self.audit_repo.list(question_id=question_id, action=action, limit=page_size, offset=offset)
        total = await self.audit_repo.count(question_id=question_id, action=action)
        return logs, total

    def _snapshot(self, question: AptitudeQuestion) -> dict:
        """Create a snapshot of question fields for audit/versioning."""
        if not question:
            return {}
        return {
            "id": question.id,
            "question_text": question.question_text,
            "options": question.options,
            "correct_option": question.correct_option,
            "category": question.category.value if question.category else None,
            "difficulty": question.difficulty.value if question.difficulty else None,
            "explanation": question.explanation,
            "sub_topic": question.sub_topic,
            "role_tag": question.role_tag,
            "marks": question.marks,
            "time_limit_seconds": question.time_limit_seconds,
            "status": question.status.value if question.status else None,
            "approval_status": question.approval_status.value if question.approval_status else None,
            "approved_by": question.approved_by,
            "approved_at": question.approved_at.isoformat() if question.approved_at else None,
            "version_number": question.version_number,
            "previous_version_id": question.previous_version_id,
            "is_active": question.is_active,
            "created_by": question.created_by,
            "created_at": question.created_at.isoformat() if question.created_at else None,
            "updated_at": question.updated_at.isoformat() if question.updated_at else None,
        }
    
    async def get_stats(self) -> dict:
        """Get question statistics."""
        return await self.repo.get_stats()
