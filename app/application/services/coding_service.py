"""
Coding Service.
Business logic for coding practice problems and attempts.
"""
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.services.ai_service import get_ai_service
from app.application.services.code_runner import CodeRunner
from app.core.constants import DifficultyLevel, CodingLanguage
from app.infrastructure.database.models import CodingProblem, CodingAttempt
from app.infrastructure.repositories.coding_problem_repo_impl import CodingProblemRepositoryImpl
from app.infrastructure.repositories.coding_attempt_repo_impl import CodingAttemptRepositoryImpl
from app.infrastructure.repositories.profile_repo_impl import ProfileRepositoryImpl
from app.utils.logger import logger


class CodingService:
    """Service for coding problem generation and evaluation."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.problem_repo = CodingProblemRepositoryImpl(session)
        self.attempt_repo = CodingAttemptRepositoryImpl(session)
        self.profile_repo = ProfileRepositoryImpl(session)
        self.ai_service = get_ai_service()
        self.runner = CodeRunner()

    async def generate_problem(
        self,
        difficulty: DifficultyLevel,
        tags: Optional[List[str]] = None,
        topic: Optional[str] = None,
    ) -> CodingProblem:
        """Generate a new coding problem using Groq and persist it."""
        ai_payload = await self.ai_service.generate_coding_problem(
            difficulty=difficulty,
            tags=tags,
            topic=topic,
        )

        normalized = self._normalize_problem_payload(ai_payload, difficulty, tags)

        problem = await self.problem_repo.create(
            title=normalized["title"],
            description=normalized["description"],
            difficulty=difficulty,
            input_format=normalized.get("input_format"),
            output_format=normalized.get("output_format"),
            constraints=normalized.get("constraints"),
            test_cases=normalized["test_cases"],
            tags=normalized.get("tags") or [],
            time_limit_ms=normalized.get("time_limit_ms", 2000),
            memory_limit_mb=normalized.get("memory_limit_mb", 256),
        )
        logger.info(f"Generated coding problem {problem.id} ({problem.title})")
        return problem

    async def get_problem(self, problem_id: str) -> Optional[CodingProblem]:
        """Fetch a problem by ID."""
        return await self.problem_repo.get_by_id(problem_id)

    async def submit_attempt(
        self,
        user_id: str,
        problem_id: str,
        language: CodingLanguage,
        code: str,
    ) -> Tuple[CodingAttempt, Dict[str, Any]]:
        """Submit a coding attempt and evaluate by executing code."""
        problem = await self.problem_repo.get_by_id(problem_id)
        if not problem:
            raise ValueError("Problem not found")

        test_cases = list(problem.test_cases or [])
        run_result = self.runner.run(
            language=language,
            code=code,
            test_cases=test_cases,
            time_limit_ms=problem.time_limit_ms,
        )

        evaluation: Dict[str, Any] = {
            "verdict": run_result.verdict,
            "tests_total": run_result.tests_total,
            "tests_passed": run_result.tests_passed,
            "score": run_result.score,
            "feedback": run_result.feedback,
            "failed_cases": run_result.failed_cases,
            "complexity": {"time": "Unknown", "space": "Unknown"},
            "key_issues": [c.get("reason") for c in run_result.failed_cases] if run_result.failed_cases else [],
            "improvement_tips": [],
        }

        is_accepted = run_result.verdict == "ACCEPTED"
        error_message = None if is_accepted else run_result.feedback

        attempt = await self.attempt_repo.create(
            user_id=user_id,
            problem_id=problem_id,
            language=language,
            code=code,
            is_accepted=is_accepted,
            tests_passed=run_result.tests_passed,
            tests_total=run_result.tests_total,
            error_message=error_message,
            execution_time_ms=run_result.execution_time_ms,
        )

        await self._sync_profile_coding_score(user_id)

        return attempt, evaluation

    async def get_hint(
        self,
        problem_id: str,
        code: Optional[str],
        hint_level: str = "MEDIUM",
    ) -> str:
        """Generate a hint for a problem."""
        problem = await self.problem_repo.get_by_id(problem_id)
        if not problem:
            raise ValueError("Problem not found")

        payload = {
            "title": problem.title,
            "description": problem.description,
            "difficulty": problem.difficulty.value if hasattr(problem.difficulty, "value") else str(problem.difficulty),
            "input_format": problem.input_format,
            "output_format": problem.output_format,
            "constraints": problem.constraints,
            "tags": problem.tags or [],
        }
        return await self.ai_service.generate_coding_hint(
            problem=payload,
            code=code,
            hint_level=hint_level,
        )

    async def get_explanation(self, problem_id: str) -> Dict[str, Any]:
        """Generate a solution explanation for a problem."""
        problem = await self.problem_repo.get_by_id(problem_id)
        if not problem:
            raise ValueError("Problem not found")

        payload = {
            "title": problem.title,
            "description": problem.description,
            "difficulty": problem.difficulty.value if hasattr(problem.difficulty, "value") else str(problem.difficulty),
            "input_format": problem.input_format,
            "output_format": problem.output_format,
            "constraints": problem.constraints,
            "tags": problem.tags or [],
        }
        return await self.ai_service.generate_coding_explanation(problem=payload)

    async def _sync_profile_coding_score(self, user_id: str) -> None:
        """Update coding score and overall readiness based on recent attempts."""
        attempts = await self.attempt_repo.list_by_user(user_id, limit=5)
        if not attempts:
            return

        scores = []
        for attempt in attempts:
            total = attempt.tests_total or 0
            passed = attempt.tests_passed or 0
            if total > 0:
                scores.append((passed / total) * 100)

        if not scores:
            return

        avg_score = round(sum(scores) / len(scores), 1)
        await self.profile_repo.update(user_id, coding_score=avg_score)

        profile = await self.profile_repo.get_by_user_id(user_id)
        if profile:
            overall = (profile.aptitude_score + profile.interview_score + profile.coding_score) / 3
            await self.profile_repo.update(user_id, overall_readiness=round(overall, 1))

    def _normalize_problem_payload(
        self,
        payload: Dict[str, Any],
        difficulty: DifficultyLevel,
        request_tags: Optional[List[str]],
    ) -> Dict[str, Any]:
        title = str(payload.get("title") or "").strip()
        description = str(payload.get("description") or "").strip()

        if not title or not description:
            raise ValueError("AI response missing title or description")

        input_format = payload.get("input_format")
        output_format = payload.get("output_format")
        constraints = payload.get("constraints")

        test_cases_raw = payload.get("test_cases") or []
        if not isinstance(test_cases_raw, list):
            raise ValueError("AI response test_cases must be a list")

        test_cases: List[Dict[str, Any]] = []
        for case in test_cases_raw:
            if not isinstance(case, dict):
                continue
            input_text = str(case.get("input") or "").strip()
            expected_output = str(case.get("expected_output") or "").strip()
            if not input_text and not expected_output:
                continue
            test_cases.append({
                "input": input_text,
                "expected_output": expected_output,
                "is_sample": bool(case.get("is_sample", False)),
            })

        if not test_cases:
            raise ValueError("AI response contained no usable test cases")

        sample_count = sum(1 for c in test_cases if c.get("is_sample"))
        if sample_count < 2:
            for c in test_cases[:2]:
                c["is_sample"] = True

        tags = payload.get("tags") or []
        if isinstance(tags, str):
            tags = [t.strip() for t in tags.split(",") if t.strip()]
        if not isinstance(tags, list):
            tags = []

        if request_tags:
            merged = {str(t).strip() for t in tags if str(t).strip()}
            merged.update({str(t).strip() for t in request_tags if str(t).strip()})
            tags = sorted(merged)
        else:
            tags = [str(t).strip() for t in tags if str(t).strip()]

        def safe_int_field(value: Any, default: int) -> int:
            try:
                return int(value)
            except (TypeError, ValueError):
                return default

        time_limit_ms = safe_int_field(payload.get("time_limit_ms"), 2000)
        memory_limit_mb = safe_int_field(payload.get("memory_limit_mb"), 256)

        return {
            "title": title,
            "description": description,
            "difficulty": difficulty.value,
            "input_format": str(input_format).strip() if input_format else None,
            "output_format": str(output_format).strip() if output_format else None,
            "constraints": str(constraints).strip() if constraints else None,
            "test_cases": test_cases,
            "tags": tags,
            "time_limit_ms": time_limit_ms,
            "memory_limit_mb": memory_limit_mb,
        }
