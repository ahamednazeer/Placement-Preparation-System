"""
Service layer for Aptitude Attempt management.
"""
from typing import List, Optional, Tuple, Dict, Any
from datetime import datetime
from uuid import uuid4, UUID
import random

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete, select

from app.infrastructure.repositories.aptitude_attempt_repo_impl import AptitudeAttemptRepositoryImpl
from app.infrastructure.repositories.aptitude_question_repo_impl import AptitudeQuestionRepositoryImpl
from app.infrastructure.repositories.profile_repo_impl import ProfileRepositoryImpl
from app.application.services.resume_analysis_service import ResumeAnalysisService
from app.infrastructure.database.models import AptitudeAttempt, AptitudeQuestion, AptitudeAttemptDetail
from app.core.constants import (
    AptitudeCategory,
    DifficultyLevel,
    QuestionApprovalStatus,
    AptitudeMode,
    AttemptStatus,
)

DEFAULT_QUESTION_TIME_LIMIT_SECONDS = 60


class AptitudeAttemptService:
    """Business logic for student aptitude test attempts."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = AptitudeAttemptRepositoryImpl(db)
        self.question_repo = AptitudeQuestionRepositoryImpl(db)
        self.profile_repo = ProfileRepositoryImpl(db)
        self.resume_service = ResumeAnalysisService(db)
    
    async def start_assessment(
        self,
        user_id: str,
        category: Optional[AptitudeCategory] = None,
        count: int = 10,
        difficulty: Optional[DifficultyLevel] = None,
        mode: AptitudeMode = AptitudeMode.PRACTICE,
        resume_question_count: Optional[int] = None,
        exclude_categories: Optional[List[AptitudeCategory]] = None,
    ) -> Tuple[AptitudeAttempt, List[dict]]:
        """
        Initialize a new assessment.
        Selects random questions and creates an attempt record.
        """
        timed_mode = self._is_timed_mode(mode)
        resume_based_count = 0
        resume_request = None
        if resume_question_count is not None:
            resume_request = max(0, min(resume_question_count, count))

        recent_question_ids, recent_generated_texts = await self._get_recent_attempt_context(user_id)

        # Resume-based question generation
        generated_questions: Dict[str, Dict[str, Any]] = {}
        selected_questions: List[AptitudeQuestion] = []

        if mode == AptitudeMode.RESUME_ONLY:
            resume_desired = resume_request if resume_request is not None else count
            if resume_desired <= 0:
                raise ValueError("Resume question count must be greater than 0")
            resume_text = await self.resume_service.get_resume_text(user_id)
            if not resume_text:
                raise ValueError("No resume uploaded for resume-only test")

            profile = await self.profile_repo.get_by_user_id(user_id)
            preferred_role = None
            if profile and profile.preferred_roles:
                preferred_role = profile.preferred_roles[0]
            skill_hints = await self.resume_service.get_resume_skill_hints(user_id, resume_text=resume_text)
            if not skill_hints:
                try:
                    await self.resume_service.analyze_and_store(user_id)
                    skill_hints = await self.resume_service.get_resume_skill_hints(user_id, resume_text=resume_text)
                except Exception:
                    pass
            generated_list = await self.resume_service.ai_service.generate_resume_based_questions(
                resume_text=resume_text,
                preferred_role=preferred_role,
                difficulty=difficulty or DifficultyLevel.MEDIUM,
                count=resume_desired,
                skill_hints=skill_hints,
                project_hints=None,
                avoid_questions=recent_generated_texts,
            )
            if len(generated_list) < resume_desired and skill_hints:
                generated_list.extend(
                    self._build_fallback_skill_questions(
                        skill_hints,
                        resume_desired - len(generated_list),
                    )
                )
            for item in generated_list:
                gen_id = f"gen_{uuid4()}"
                item["difficulty"] = (difficulty or DifficultyLevel.MEDIUM).value
                item["time_limit_seconds"] = self._effective_time_limit(
                    item.get("time_limit_seconds"),
                    timed_mode,
                )
                generated_questions[gen_id] = item
            resume_based_count = len(generated_questions)
            if resume_based_count == 0:
                raise ValueError("No resume skills/projects detected. Run Resume Analysis or upload a detailed resume.")
        else:
            # 1. Fetch questions based on selection
            questions: List[AptitudeQuestion] = []
            if category:
                questions = await self.question_repo.list_questions(
                    category=category,
                    difficulty=difficulty,
                    approval_status=QuestionApprovalStatus.APPROVED,
                    limit=count * 2 # Get more to randomize
                )
            else:
                questions = await self.question_repo.list_questions(
                    difficulty=difficulty,
                    approval_status=QuestionApprovalStatus.APPROVED,
                    limit=count * 3
                )

            if exclude_categories:
                questions = [q for q in questions if q.category not in exclude_categories]

            if len(questions) < count:
                # Not enough questions, just take what we have or raise
                pass

            random.shuffle(questions)

            if mode == AptitudeMode.TEST:
                resume_text = await self.resume_service.get_resume_text(user_id)
                if resume_text:
                    profile = await self.profile_repo.get_by_user_id(user_id)
                    preferred_role = None
                    if profile and profile.preferred_roles:
                        preferred_role = profile.preferred_roles[0]
                    skill_hints = await self.resume_service.get_resume_skill_hints(user_id, resume_text=resume_text)
                    if not skill_hints:
                        try:
                            await self.resume_service.analyze_and_store(user_id)
                            skill_hints = await self.resume_service.get_resume_skill_hints(user_id, resume_text=resume_text)
                        except Exception:
                            pass
                    resume_based_count = resume_request if resume_request is not None else min(3, max(1, count // 4))
                    resume_based_count = max(0, min(resume_based_count, count))
                    if resume_based_count > 0:
                        generated_list = await self.resume_service.ai_service.generate_resume_based_questions(
                            resume_text=resume_text,
                            preferred_role=preferred_role,
                            difficulty=difficulty or DifficultyLevel.MEDIUM,
                            count=resume_based_count,
                            skill_hints=skill_hints,
                            project_hints=None,
                            avoid_questions=recent_generated_texts,
                        )
                        if len(generated_list) < resume_based_count and skill_hints:
                            generated_list.extend(
                                self._build_fallback_skill_questions(
                                    skill_hints,
                                    resume_based_count - len(generated_list),
                                )
                            )
                        for item in generated_list:
                            gen_id = f"gen_{uuid4()}"
                            item["difficulty"] = (difficulty or DifficultyLevel.MEDIUM).value
                            item["time_limit_seconds"] = self._effective_time_limit(
                                item.get("time_limit_seconds"),
                                timed_mode,
                            )
                            generated_questions[gen_id] = item

            resume_based_count = len(generated_questions)
            bank_count = max(0, count - resume_based_count)
            filtered_questions = [q for q in questions if q.id not in recent_question_ids]
            if len(filtered_questions) >= bank_count:
                selected_questions = filtered_questions[:bank_count]
            else:
                selected_questions = questions[:bank_count]

        # Shuffle options per question (anti-cheat)
        option_orders: Dict[str, List[str]] = {}
        question_briefs: List[dict] = []
        for q in selected_questions:
            shuffled, order = self._shuffle_options(q.options)
            option_orders[q.id] = order
            effective_limit = self._effective_time_limit(q.time_limit_seconds, timed_mode)
            question_briefs.append(self._build_question_brief(q, shuffled, effective_limit))
        for qid, qdata in generated_questions.items():
            shuffled, order = self._shuffle_options(qdata["options"])
            option_orders[qid] = order
            question_briefs.append(self._build_generated_brief(qid, qdata, shuffled))

        random.shuffle(question_briefs)
        question_ids = [q["id"] for q in question_briefs]
        if not question_briefs:
            if mode == AptitudeMode.RESUME_ONLY:
                raise ValueError("Resume test could not start. No skills/projects detected from resume.")
            if resume_request and resume_based_count == 0:
                raise ValueError("Resume questions could not be generated and no approved questions are available.")
            raise ValueError("No approved aptitude questions available. Ask admin to approve questions.")

        # 2. Create attempt record
        attempt = await self.repo.create(
            user_id=user_id,
            total_questions=len(question_ids),
            category=category,
            difficulty=difficulty,
            mode=mode,
            status=AttemptStatus.IN_PROGRESS,
            question_ids=question_ids,
            option_orders=option_orders,
            generated_questions=generated_questions or None,
        )
        
        return attempt, question_briefs

    def _shuffle_options(self, options: Dict[str, str]) -> Tuple[Dict[str, str], List[str]]:
        keys = list(options.keys())
        random.shuffle(keys)
        ordered = {k: options[k] for k in keys}
        return ordered, keys

    def _apply_option_order(self, options: Dict[str, str], order: Optional[List[str]]) -> Dict[str, str]:
        if not order:
            return options
        return {k: options[k] for k in order if k in options}

    def _build_fallback_skill_questions(self, skill_hints: List[str], count: int) -> List[Dict[str, Any]]:
        if not skill_hints or count <= 0:
            return []
        question_bank: Dict[str, Dict[str, Any]] = {
            "python": {
                "question_text": "Which Python data structure is mutable?",
                "options": {"A": "tuple", "B": "list", "C": "str", "D": "bytes"},
                "correct_option": "B",
            },
            "java": {
                "question_text": "Which keyword is used to inherit a class in Java?",
                "options": {"A": "implements", "B": "extends", "C": "inherits", "D": "super"},
                "correct_option": "B",
            },
            "javascript": {
                "question_text": "Which keyword declares a block-scoped variable in JavaScript?",
                "options": {"A": "var", "B": "let", "C": "const", "D": "static"},
                "correct_option": "B",
            },
            "typescript": {
                "question_text": "Which TypeScript feature adds static typing to variables?",
                "options": {"A": "Decorators", "B": "Type annotations", "C": "Promises", "D": "Closures"},
                "correct_option": "B",
            },
            "node.js": {
                "question_text": "Which Node.js module is used to create an HTTP server?",
                "options": {"A": "http", "B": "fs", "C": "path", "D": "net"},
                "correct_option": "A",
            },
            "nginx": {
                "question_text": "NGINX is primarily used as a:",
                "options": {"A": "Relational database", "B": "Reverse proxy and web server", "C": "Message broker", "D": "CI server"},
                "correct_option": "B",
            },
            "couchdb": {
                "question_text": "CouchDB stores data in which format?",
                "options": {"A": "XML files", "B": "JSON documents", "C": "CSV tables", "D": "Binary blobs only"},
                "correct_option": "B",
            },
            "prometheus": {
                "question_text": "Prometheus is primarily used for:",
                "options": {"A": "Application monitoring and metrics", "B": "Authentication", "C": "Message queues", "D": "Object storage"},
                "correct_option": "A",
            },
            "grafana": {
                "question_text": "Grafana is mainly used to:",
                "options": {"A": "Run containers", "B": "Visualize metrics and dashboards", "C": "Compile code", "D": "Manage databases"},
                "correct_option": "B",
            },
            "influxdb": {
                "question_text": "InfluxDB is best suited for storing:",
                "options": {"A": "Time-series data", "B": "Graph data", "C": "Document data", "D": "Key-value caches"},
                "correct_option": "A",
            },
            "bash": {
                "question_text": "Which symbol is used to reference a variable in Bash?",
                "options": {"A": "&", "B": "$", "C": "#", "D": "@"},
                "correct_option": "B",
            },
            "github": {
                "question_text": "GitHub is primarily a platform for:",
                "options": {"A": "Code hosting and collaboration", "B": "Container orchestration", "C": "Database hosting", "D": "Monitoring"},
                "correct_option": "A",
            },
            "gitlab": {
                "question_text": "GitLab CI/CD pipelines are defined in which file?",
                "options": {"A": ".gitlab-ci.yml", "B": "Jenkinsfile", "C": "pipeline.yml", "D": ".gitlab.yml"},
                "correct_option": "A",
            },
            "react": {
                "question_text": "Which React hook manages component state in a function component?",
                "options": {"A": "useMemo", "B": "useState", "C": "useRef", "D": "useEffect"},
                "correct_option": "B",
            },
            "docker": {
                "question_text": "Which file contains Docker build instructions?",
                "options": {"A": "docker.yml", "B": "Dockerfile", "C": "compose.json", "D": "build.cfg"},
                "correct_option": "B",
            },
            "kubernetes": {
                "question_text": "Which Kubernetes object ensures a desired number of pod replicas?",
                "options": {"A": "Service", "B": "Deployment", "C": "ConfigMap", "D": "Namespace"},
                "correct_option": "B",
            },
            "aws": {
                "question_text": "Which AWS service provides object storage?",
                "options": {"A": "EC2", "B": "S3", "C": "RDS", "D": "Lambda"},
                "correct_option": "B",
            },
            "azure": {
                "question_text": "Which Azure service provides object storage?",
                "options": {"A": "Blob Storage", "B": "Azure Functions", "C": "Cosmos DB", "D": "AKS"},
                "correct_option": "A",
            },
            "postgresql": {
                "question_text": "Which SQL clause filters results after GROUP BY?",
                "options": {"A": "WHERE", "B": "HAVING", "C": "ORDER BY", "D": "LIMIT"},
                "correct_option": "B",
            },
            "mysql": {
                "question_text": "Which command creates an index in MySQL?",
                "options": {"A": "CREATE INDEX", "B": "ADD INDEX", "C": "MAKE INDEX", "D": "INDEX CREATE"},
                "correct_option": "A",
            },
            "mongodb": {
                "question_text": "Which MongoDB method inserts a single document?",
                "options": {"A": "insertMany()", "B": "insertOne()", "C": "add()", "D": "create()"},
                "correct_option": "B",
            },
            "redis": {
                "question_text": "Which Redis command sets a key's value?",
                "options": {"A": "GET", "B": "SET", "C": "PUT", "D": "ADD"},
                "correct_option": "B",
            },
            "git": {
                "question_text": "Which Git command creates a new branch and switches to it?",
                "options": {"A": "git branch new", "B": "git switch -c new", "C": "git checkout", "D": "git init new"},
                "correct_option": "B",
            },
            "jenkins": {
                "question_text": "Which file defines a Jenkins pipeline as code?",
                "options": {"A": "pipeline.yml", "B": "Jenkinsfile", "C": "jenkins.json", "D": "build.gradle"},
                "correct_option": "B",
            },
            "gitlab ci/cd": {
                "question_text": "Which file defines GitLab CI/CD pipelines?",
                "options": {"A": ".gitlab-ci.yml", "B": "Jenkinsfile", "C": "pipeline.yml", "D": ".gitlab.yml"},
                "correct_option": "A",
            },
            "fastapi": {
                "question_text": "Which FastAPI decorator defines a GET endpoint?",
                "options": {"A": "@app.get()", "B": "@app.route()", "C": "@app.fetch()", "D": "@app.read()"},
                "correct_option": "A",
            },
            "django": {
                "question_text": "Which Django file defines database models?",
                "options": {"A": "views.py", "B": "models.py", "C": "urls.py", "D": "settings.py"},
                "correct_option": "B",
            },
            "flask": {
                "question_text": "Which object represents the Flask application instance?",
                "options": {"A": "Flask(__name__)", "B": "App()", "C": "Server()", "D": "FlaskApp()"},
                "correct_option": "A",
            },
            "spring boot": {
                "question_text": "Which annotation marks the main Spring Boot application class?",
                "options": {"A": "@SpringBootApplication", "B": "@EnableSpring", "C": "@SpringMain", "D": "@SpringApp"},
                "correct_option": "A",
            },
            "linux": {
                "question_text": "Which command lists files in a directory?",
                "options": {"A": "ls", "B": "pwd", "C": "cat", "D": "touch"},
                "correct_option": "A",
            },
        }

        letters = ["A", "B", "C", "D"]
        questions: List[Dict[str, Any]] = []
        skill_pool = list(dict.fromkeys(skill_hints))
        available_entries: List[Dict[str, Any]] = []
        for skill in skill_pool:
            key = skill.lower()
            for candidate in question_bank.keys():
                if candidate in key:
                    entry = question_bank[candidate]
                    available_entries.append(entry)
                    break
        if not available_entries:
            return []
        random.shuffle(available_entries)
        for idx in range(count):
            entry = available_entries[idx % len(available_entries)]
            questions.append({
                "question_text": entry["question_text"],
                "options": entry["options"],
                "correct_option": entry["correct_option"],
                "explanation": None,
                "category": "RESUME",
                "marks": 1,
            })
        return questions

        letters = ["A", "B", "C", "D"]
        categories = list(category_descriptions.keys())
        questions: List[Dict[str, Any]] = []
        for idx in range(count):
            skill = skill_hints[idx % len(skill_hints)]
            category = classify(skill)
            correct = category_descriptions[category]
            distractor_categories = [c for c in categories if c != category]
            random.shuffle(distractor_categories)
            distractors = [category_descriptions[c] for c in distractor_categories[:3]]
            options_list = [correct] + distractors
            random.shuffle(options_list)
            options = {letters[i]: options_list[i] for i in range(4)}
            correct_option = next(k for k, v in options.items() if v == correct)
            questions.append({
                "question_text": f"{skill} is best described as:",
                "options": options,
                "correct_option": correct_option,
                "explanation": None,
                "category": "RESUME",
                "marks": 1,
            })
        return questions

    def _build_question_brief(
        self,
        q: AptitudeQuestion,
        options: Dict[str, str],
        time_limit_seconds: Optional[int] = None,
    ) -> dict:
        return {
            "id": q.id,
            "question_text": q.question_text,
            "options": options,
            "category": q.category.value,
            "difficulty": q.difficulty.value,
            "sub_topic": q.sub_topic,
            "marks": q.marks,
            "time_limit_seconds": time_limit_seconds if time_limit_seconds is not None else q.time_limit_seconds,
        }

    def _build_generated_brief(
        self,
        qid: str,
        qdata: Dict[str, Any],
        options: Dict[str, str],
        time_limit_seconds: Optional[int] = None,
    ) -> dict:
        return {
            "id": qid,
            "question_text": qdata.get("question_text"),
            "options": options,
            "category": qdata.get("category", "RESUME"),
            "difficulty": qdata.get("difficulty") or DifficultyLevel.MEDIUM.value,
            "sub_topic": None,
            "marks": qdata.get("marks") or 1,
            "time_limit_seconds": time_limit_seconds if time_limit_seconds is not None else qdata.get("time_limit_seconds"),
        }

    def _is_timed_mode(self, mode: Any) -> bool:
        mode_value = self._mode_value(mode)
        return mode_value in {AptitudeMode.TEST.value, AptitudeMode.RESUME_ONLY.value}

    def _effective_time_limit(self, raw_limit: Optional[int], timed: bool) -> Optional[int]:
        if raw_limit is None and timed:
            return DEFAULT_QUESTION_TIME_LIMIT_SECONDS
        return raw_limit

    def _normalize_saved_answers(self, answers: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
        normalized: Dict[str, Dict[str, Any]] = {}
        for qid, val in (answers or {}).items():
            if isinstance(val, dict):
                normalized[qid] = {
                    "selected": val.get("selected"),
                    "saved_at": val.get("saved_at"),
                }
            else:
                normalized[qid] = {
                    "selected": val,
                    "saved_at": None,
                }
        return normalized

    async def _build_question_time_limits(self, attempt: AptitudeAttempt) -> Dict[str, int]:
        limits: Dict[str, int] = {}
        if not attempt.question_ids:
            return limits
        timed = self._is_timed_mode(attempt.mode)
        for qid in attempt.question_ids:
            limit: Optional[int] = None
            if attempt.generated_questions and qid in attempt.generated_questions:
                limit = attempt.generated_questions[qid].get("time_limit_seconds")
            else:
                try:
                    UUID(str(qid))
                except (ValueError, TypeError):
                    question = None
                else:
                    question = await self.question_repo.get_by_id(qid)
                if question:
                    limit = question.time_limit_seconds
            limit = self._effective_time_limit(limit, timed) if timed else limit
            limits[qid] = int(limit or 0)
        return limits

    async def _build_question_deadlines(self, attempt: AptitudeAttempt) -> Dict[str, Optional[int]]:
        deadlines: Dict[str, Optional[int]] = {}
        if not attempt.question_ids:
            return deadlines
        limits = await self._build_question_time_limits(attempt)
        elapsed = 0
        for qid in attempt.question_ids:
            limit = limits.get(qid) or 0
            if limit <= 0:
                deadlines[qid] = None
                continue
            elapsed += limit
            deadlines[qid] = elapsed
        return deadlines

    def _mode_value(self, mode: Any) -> str:
        if isinstance(mode, AptitudeMode):
            return mode.value
        return str(mode)

    def _is_uuid(self, value: Any) -> bool:
        try:
            UUID(str(value))
            return True
        except (ValueError, TypeError):
            return False

    async def _get_question_safe(self, qid: Any) -> Optional[AptitudeQuestion]:
        if not self._is_uuid(qid):
            return None
        return await self.question_repo.get_by_id(str(qid))

    async def _get_recent_attempt_context(
        self,
        user_id: str,
        limit: int = 5,
    ) -> Tuple[set, List[str]]:
        attempts = await self.repo.list_by_user(user_id, limit=limit)
        recent_ids: set = set()
        recent_generated: List[str] = []
        for attempt in attempts:
            if attempt.question_ids:
                for qid in attempt.question_ids:
                    if self._is_uuid(qid):
                        recent_ids.add(str(qid))
            if attempt.generated_questions:
                for q in attempt.generated_questions.values():
                    text = (q or {}).get("question_text")
                    if text:
                        recent_generated.append(str(text))
        return recent_ids, recent_generated

    async def get_active_attempt(
        self,
        user_id: str,
    ) -> Tuple[Optional[AptitudeAttempt], List[dict], Dict[str, Optional[str]]]:
        attempt = await self.repo.get_active_attempt(user_id)
        if not attempt:
            return None, [], {}

        # Check for expiration in timed modes based on per-question limits
        if self._is_timed_mode(attempt.mode) and attempt.question_ids:
            deadlines = await self._build_question_deadlines(attempt)
            total_allowed = max([d for d in deadlines.values() if d], default=0)
            elapsed = int((datetime.utcnow() - attempt.started_at).total_seconds())
            if total_allowed > 0 and elapsed > total_allowed:
                await self.submit_assessment(attempt.id, user_id, {}, elapsed)
                raise ValueError("Session expired")

        question_briefs: List[dict] = []
        if attempt.question_ids:
            for qid in attempt.question_ids:
                q = await self._get_question_safe(qid)
                if not q:
                    if attempt.generated_questions and qid in attempt.generated_questions:
                        gen = attempt.generated_questions[qid]
                        order = attempt.option_orders.get(qid) if attempt.option_orders else None
                        options = self._apply_option_order(gen["options"], order)
                        effective_limit = self._effective_time_limit(
                            gen.get("time_limit_seconds"),
                            self._is_timed_mode(attempt.mode),
                        )
                        question_briefs.append(self._build_generated_brief(qid, gen, options, effective_limit))
                    continue
                order = attempt.option_orders.get(qid) if attempt.option_orders else None
                options = self._apply_option_order(q.options, order)
                effective_limit = self._effective_time_limit(q.time_limit_seconds, self._is_timed_mode(attempt.mode))
                question_briefs.append(self._build_question_brief(q, options, effective_limit))
        else:
            # fallback if older attempts lack question_ids
            for qid in attempt.answers.keys():
                q = await self._get_question_safe(qid)
                if q:
                    question_briefs.append(self._build_question_brief(q, q.options))

        raw_answers = attempt.answers or {}
        user_answers: Dict[str, Optional[str]] = {}
        for qid, val in raw_answers.items():
            if isinstance(val, dict):
                user_answers[qid] = val.get("selected")
            else:
                user_answers[qid] = val

        return attempt, question_briefs, user_answers

    async def get_attempt_briefs(
        self,
        attempt_id: str,
        user_id: str,
    ) -> Tuple[AptitudeAttempt, List[dict], Dict[str, Optional[str]]]:
        """Get questions and saved answers for a specific active attempt."""
        attempt = await self.repo.get_by_id(attempt_id)
        if not attempt or attempt.user_id != user_id:
            raise ValueError("Attempt not found")

        if attempt.completed_at:
            raise ValueError("Assessment already submitted")

        # Check for expiration in timed modes based on per-question limits
        if self._is_timed_mode(attempt.mode) and attempt.question_ids:
            deadlines = await self._build_question_deadlines(attempt)
            total_allowed = max([d for d in deadlines.values() if d], default=0)
            elapsed = int((datetime.utcnow() - attempt.started_at).total_seconds())
            if total_allowed > 0 and elapsed > total_allowed:
                await self.submit_assessment(attempt.id, user_id, {}, elapsed)
                raise ValueError("Session expired")

        question_briefs: List[dict] = []
        if attempt.question_ids:
            for qid in attempt.question_ids:
                q = await self._get_question_safe(qid)
                if not q:
                    if attempt.generated_questions and qid in attempt.generated_questions:
                        gen = attempt.generated_questions[qid]
                        order = attempt.option_orders.get(qid) if attempt.option_orders else None
                        options = self._apply_option_order(gen["options"], order)
                        effective_limit = self._effective_time_limit(
                            gen.get("time_limit_seconds"),
                            self._is_timed_mode(attempt.mode),
                        )
                        question_briefs.append(self._build_generated_brief(qid, gen, options, effective_limit))
                    continue
                order = attempt.option_orders.get(qid) if attempt.option_orders else None
                options = self._apply_option_order(q.options, order)
                effective_limit = self._effective_time_limit(q.time_limit_seconds, self._is_timed_mode(attempt.mode))
                question_briefs.append(self._build_question_brief(q, options, effective_limit))
        else:
            # fallback if older attempts lack question_ids
            for qid in attempt.answers.keys():
                q = await self._get_question_safe(qid)
                if q:
                    question_briefs.append(self._build_question_brief(q, q.options))

        raw_answers = attempt.answers or {}
        user_answers: Dict[str, Optional[str]] = {}
        for qid, val in raw_answers.items():
            if isinstance(val, dict):
                user_answers[qid] = val.get("selected")
            else:
                user_answers[qid] = val

        return attempt, question_briefs, user_answers
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

        # Merge autosaved answers with incoming answers (with server timestamps)
        stored_answers = self._normalize_saved_answers(attempt.answers or {})

        # Use server-side elapsed time to prevent client tampering
        elapsed_seconds = int((datetime.utcnow() - attempt.started_at).total_seconds())

        for qid, selected in (user_answers or {}).items():
            stored_answers[qid] = {
                "selected": selected,
                "saved_at": elapsed_seconds,
            }

        # Enforce per-question time locks in timed modes
        if self._is_timed_mode(attempt.mode) and attempt.question_ids:
            deadlines = await self._build_question_deadlines(attempt)
            for qid, payload in stored_answers.items():
                deadline = deadlines.get(qid)
                saved_at = payload.get("saved_at")
                if deadline and saved_at is not None and saved_at > deadline:
                    payload["selected"] = None

        merged_answers = {qid: payload.get("selected") for qid, payload in stored_answers.items()}

        # 1. Calculate Results
        correct_count = 0
        wrong_count = 0
        skipped_count = 0
        total_marks = 0
        earned_marks = 0
        results_answers = {}
        detail_rows: List[AptitudeAttemptDetail] = []
        
        question_ids = attempt.question_ids or list(merged_answers.keys())

        # We need to fetch the questions again to verify answers
        for q_id in question_ids:
            selected = merged_answers.get(q_id)
            question = await self._get_question_safe(q_id)
            generated = None if question else (attempt.generated_questions or {}).get(q_id)
            if not question and not generated:
                continue
                
            is_correct = False
            marks = (question.marks if question else generated.get("marks")) or 1
            total_marks += marks
            if selected:
                correct_opt = question.correct_option if question else generated.get("correct_option")
                is_correct = (selected.upper() == str(correct_opt).upper())
                if is_correct:
                    correct_count += 1
                    earned_marks += marks
                else:
                    wrong_count += 1
            else:
                skipped_count += 1
                
            results_answers[q_id] = {
                "selected": selected,
                "is_correct": is_correct,
                "correct_option": question.correct_option if question else generated.get("correct_option"),
                "category": question.category.value if question else generated.get("category", "RESUME"),
                "marks": marks,
            }
            order = attempt.option_orders.get(q_id) if attempt.option_orders else None
            presented_options = self._apply_option_order(
                question.options if question else generated.get("options", {}),
                order,
            )
            detail_rows.append(
                AptitudeAttemptDetail(
                    attempt_id=attempt_id,
                    question_id=question.id if question else None,
                    question_text=question.question_text if question else generated.get("question_text"),
                    options=presented_options,
                    generated=bool(generated) and question is None,
                    selected_option=selected,
                    correct_option=question.correct_option if question else generated.get("correct_option"),
                    is_correct=is_correct,
                    marks=marks,
                    category=question.category.value if question else generated.get("category", "RESUME"),
                )
            )

        # Handle questions that weren't in user_answers but were part of the test?
        # In this simple implementation, we assume user_answers contains all seen questions.
        
        score = (earned_marks / total_marks * 100) if total_marks > 0 else 0
        
        # 2. Update Attempt
        updated_attempt = await self.repo.update(
            attempt_id,
            completed_at=datetime.utcnow(),
            correct_answers=correct_count,
            wrong_answers=wrong_count,
            skipped=skipped_count,
            score=round(score, 1),
            time_taken_seconds=elapsed_seconds,
            answers=results_answers,
            status=AttemptStatus.COMPLETED,
        )

        # Store detailed rows
        await self.db.execute(
            delete(AptitudeAttemptDetail).where(AptitudeAttemptDetail.attempt_id == attempt_id)
        )
        if detail_rows:
            self.db.add_all(detail_rows)
            await self.db.commit()
        
        # 3. Update User Profile readiness score
        await self._sync_profile_aptitude_score(user_id)
        
        return updated_attempt

    async def autosave_answers(
        self,
        attempt_id: str,
        user_id: str,
        user_answers: Dict[str, Optional[str]],
    ) -> bool:
        """Autosave partial answers during an active attempt."""
        attempt = await self.repo.get_by_id(attempt_id)
        if not attempt or attempt.user_id != user_id:
            raise ValueError("Attempt not found")
        if attempt.completed_at:
            raise ValueError("Assessment already submitted")

        elapsed = int((datetime.utcnow() - attempt.started_at).total_seconds())
        deadlines: Dict[str, Optional[int]] = {}
        if self._is_timed_mode(attempt.mode) and attempt.question_ids:
            deadlines = await self._build_question_deadlines(attempt)
            total_allowed = max([d for d in deadlines.values() if d], default=0)
            if total_allowed > 0 and elapsed > total_allowed:
                raise ValueError("Session expired")

        existing = attempt.answers or {}
        for qid, selected in user_answers.items():
            deadline = deadlines.get(qid)
            if deadline and elapsed > deadline:
                continue
            current_payload = existing.get(qid)
            if not isinstance(current_payload, dict):
                current_payload = {}
            current_payload["selected"] = selected
            current_payload["saved_at"] = elapsed
            existing[qid] = current_payload

        await self.repo.update(attempt_id, answers=existing)
        return True

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
            
        # Get question details for review (from attempt details table)
        detailed_answers = []
        result = await self.db.execute(
            select(AptitudeAttemptDetail).where(AptitudeAttemptDetail.attempt_id == attempt_id)
        )
        detail_rows = list(result.scalars().all())
        for detail in detail_rows:
            if detail.question_id:
                question = await self.question_repo.get_by_id(detail.question_id)
            else:
                question = None
            if question:
                detailed_answers.append({
                    "id": detail.question_id,
                    "question_text": question.question_text,
                    "options": detail.options or question.options,
                    "correct_option": detail.correct_option,
                    "explanation": question.explanation,
                    "selected_option": detail.selected_option,
                    "is_correct": detail.is_correct,
                    "marks": detail.marks,
                    "category": detail.category,
                })
            elif detail.question_text:
                detailed_answers.append({
                    "id": detail.question_id or "generated",
                    "question_text": detail.question_text,
                    "options": detail.options or {},
                    "correct_option": detail.correct_option,
                    "explanation": None,
                    "selected_option": detail.selected_option,
                    "is_correct": detail.is_correct,
                    "marks": detail.marks,
                    "category": detail.category,
                })

        if not detail_rows and attempt.answers:
            for q_id, data in attempt.answers.items():
                question = await self._get_question_safe(q_id)
                if question:
                    detailed_answers.append({
                        "id": q_id,
                        "question_text": question.question_text,
                        "options": question.options,
                        "correct_option": question.correct_option,
                        "explanation": question.explanation,
                        "selected_option": data.get('selected'),
                        "is_correct": data.get('is_correct'),
                        "marks": data.get('marks') or question.marks if question else None,
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

    async def discard_attempt(self, attempt_id: str, user_id: str) -> bool:
        """Discard an active attempt without scoring."""
        attempt = await self.repo.get_by_id(attempt_id)
        if not attempt or attempt.user_id != user_id:
            raise ValueError("Attempt not found")
        if attempt.completed_at:
            raise ValueError("Assessment already submitted")
        await self.repo.delete_by_id(attempt_id)
        return True
