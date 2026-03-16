"""
Coding API Pydantic Schemas.
"""
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

from app.core.constants import DifficultyLevel, CodingLanguage


class CodingTestCase(BaseModel):
    input: str
    expected_output: str
    is_sample: bool = False


class CodingProblemGenerateRequest(BaseModel):
    difficulty: DifficultyLevel = Field(default=DifficultyLevel.MEDIUM, description="Problem difficulty")
    tags: Optional[List[str]] = Field(default=None, description="Preferred tags (e.g., arrays, dp)")
    topic: Optional[str] = Field(default=None, description="Topic focus for the problem")


class CodingProblemResponse(BaseModel):
    id: str
    title: str
    description: str
    difficulty: str
    input_format: Optional[str] = None
    output_format: Optional[str] = None
    constraints: Optional[str] = None
    tags: List[str] = []
    time_limit_ms: int = 2000
    memory_limit_mb: int = 256
    sample_test_cases: List[CodingTestCase] = []


class CodingAttemptRequest(BaseModel):
    problem_id: str = Field(..., description="Coding problem ID")
    language: CodingLanguage = Field(..., description="Programming language")
    code: str = Field(..., min_length=1, description="User solution code")


class CodingHintRequest(BaseModel):
    code: Optional[str] = Field(default=None, description="Optional user code to personalize hint")
    hint_level: Optional[str] = Field(default="MEDIUM", description="Hint level: LIGHT|MEDIUM|DETAILED")


class CodingHintResponse(BaseModel):
    hint: str


class CodingExplanationResponse(BaseModel):
    approach: str
    pseudocode: str
    complexity: Dict[str, Any]
    edge_cases: List[str] = []


class CodingEvaluationResponse(BaseModel):
    verdict: str
    score: int = 0
    tests_total: int = 0
    tests_passed: int = 0
    feedback: Optional[str] = None
    key_issues: List[str] = []
    improvement_tips: List[str] = []
    complexity: Optional[Dict[str, Any]] = None
    failed_cases: Optional[List[Dict[str, Any]]] = None


class CodingAttemptResponse(BaseModel):
    attempt_id: str
    is_accepted: bool
    evaluation: CodingEvaluationResponse


class CodingStatsResponse(BaseModel):
    total_attempts: int = 0
    average_score: float = 0
    best_score: float = 0


def problem_to_response(problem) -> CodingProblemResponse:
    """Convert CodingProblem model to response."""
    sample_cases = []
    for case in problem.test_cases or []:
        if case.get("is_sample"):
            sample_cases.append(CodingTestCase(
                input=str(case.get("input") or ""),
                expected_output=str(case.get("expected_output") or ""),
                is_sample=True,
            ))
    difficulty_value = problem.difficulty.value if hasattr(problem.difficulty, "value") else str(problem.difficulty)
    return CodingProblemResponse(
        id=problem.id,
        title=problem.title,
        description=problem.description,
        difficulty=difficulty_value,
        input_format=problem.input_format,
        output_format=problem.output_format,
        constraints=problem.constraints,
        tags=problem.tags or [],
        time_limit_ms=problem.time_limit_ms,
        memory_limit_mb=problem.memory_limit_mb,
        sample_test_cases=sample_cases,
    )
