"""
Lightweight code runner for coding practice.
Executes user code against test cases with time limits.
"""
from __future__ import annotations

import os
import subprocess
import tempfile
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from app.core.constants import CodingLanguage


@dataclass
class RunResult:
    verdict: str
    tests_total: int
    tests_passed: int
    score: int
    feedback: str
    failed_cases: List[Dict[str, Any]]
    execution_time_ms: Optional[int] = None


class CodeRunner:
    """Execute code safely with timeouts and simple output comparison."""

    def __init__(self, compile_timeout_sec: int = 10):
        self.compile_timeout_sec = compile_timeout_sec

    def run(
        self,
        language: CodingLanguage,
        code: str,
        test_cases: List[Dict[str, Any]],
        time_limit_ms: int = 2000,
    ) -> RunResult:
        if not test_cases:
            return RunResult(
                verdict="PARTIAL",
                tests_total=0,
                tests_passed=0,
                score=0,
                feedback="No test cases provided for evaluation.",
                failed_cases=[],
                execution_time_ms=0,
            )

        with tempfile.TemporaryDirectory() as tmpdir:
            source_path = self._write_source(tmpdir, language, code)
            compile_result = self._compile_if_needed(tmpdir, language, source_path)
            if compile_result:
                return compile_result

            run_cmd = self._get_run_command(language, tmpdir)

            tests_total = len(test_cases)
            tests_passed = 0
            failed_cases: List[Dict[str, Any]] = []
            timings: List[float] = []

            for case in test_cases:
                case_input = str(case.get("input") or "")
                expected = str(case.get("expected_output") or "")

                try:
                    start = time.perf_counter()
                    completed = subprocess.run(
                        run_cmd,
                        input=case_input,
                        text=True,
                        capture_output=True,
                        cwd=tmpdir,
                        timeout=max(0.5, time_limit_ms / 1000),
                    )
                    elapsed = (time.perf_counter() - start) * 1000
                    timings.append(elapsed)

                    if completed.returncode != 0:
                        return RunResult(
                            verdict="RUNTIME_ERROR",
                            tests_total=tests_total,
                            tests_passed=tests_passed,
                            score=self._score(tests_passed, tests_total),
                            feedback=self._truncate(
                                completed.stderr or "Runtime error"
                            ),
                            failed_cases=[
                                {
                                    "input": case_input,
                                    "expected_output": expected,
                                    "actual_output": self._truncate(completed.stdout),
                                    "reason": "Runtime error",
                                }
                            ],
                            execution_time_ms=self._avg_time_ms(timings),
                        )

                    actual = completed.stdout or ""
                    if self._normalize_output(actual) == self._normalize_output(expected):
                        tests_passed += 1
                    else:
                        if len(failed_cases) < 3:
                            failed_cases.append(
                                {
                                    "input": case_input,
                                    "expected_output": expected,
                                    "actual_output": self._truncate(actual),
                                    "reason": "Wrong answer",
                                }
                            )
                except subprocess.TimeoutExpired:
                    return RunResult(
                        verdict="TIME_LIMIT",
                        tests_total=tests_total,
                        tests_passed=tests_passed,
                        score=self._score(tests_passed, tests_total),
                        feedback="Time limit exceeded.",
                        failed_cases=[
                            {
                                "input": case_input,
                                "expected_output": expected,
                                "actual_output": "",
                                "reason": "Time limit",
                            }
                        ],
                        execution_time_ms=self._avg_time_ms(timings),
                    )
                except FileNotFoundError as e:
                    return RunResult(
                        verdict="RUNTIME_ERROR",
                        tests_total=tests_total,
                        tests_passed=tests_passed,
                        score=self._score(tests_passed, tests_total),
                        feedback=f"Runtime not available: {e}",
                        failed_cases=[],
                        execution_time_ms=self._avg_time_ms(timings),
                    )

            verdict = self._final_verdict(tests_passed, tests_total)
            feedback = (
                "All tests passed." if verdict == "ACCEPTED" else "Some tests failed."
            )

            return RunResult(
                verdict=verdict,
                tests_total=tests_total,
                tests_passed=tests_passed,
                score=self._score(tests_passed, tests_total),
                feedback=feedback,
                failed_cases=failed_cases,
                execution_time_ms=self._avg_time_ms(timings),
            )

    def _write_source(self, tmpdir: str, language: CodingLanguage, code: str) -> str:
        filename = {
            CodingLanguage.PYTHON: "main.py",
            CodingLanguage.JAVASCRIPT: "main.js",
            CodingLanguage.JAVA: "Main.java",
            CodingLanguage.CPP: "main.cpp",
            CodingLanguage.C: "main.c",
        }[language]
        path = os.path.join(tmpdir, filename)
        with open(path, "w", encoding="utf-8") as f:
            f.write(code)
        return path

    def _compile_if_needed(
        self,
        tmpdir: str,
        language: CodingLanguage,
        source_path: str,
    ) -> Optional[RunResult]:
        if language == CodingLanguage.CPP:
            cmd = ["g++", source_path, "-O2", "-std=c++17", "-o", "main"]
        elif language == CodingLanguage.C:
            cmd = ["gcc", source_path, "-O2", "-std=c11", "-o", "main"]
        elif language == CodingLanguage.JAVA:
            cmd = ["javac", source_path]
        else:
            return None

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                cwd=tmpdir,
                timeout=self.compile_timeout_sec,
            )
        except FileNotFoundError as e:
            return RunResult(
                verdict="COMPILE_ERROR",
                tests_total=0,
                tests_passed=0,
                score=0,
                feedback=f"Compiler not available: {e}",
                failed_cases=[],
            )
        except subprocess.TimeoutExpired:
            return RunResult(
                verdict="COMPILE_ERROR",
                tests_total=0,
                tests_passed=0,
                score=0,
                feedback="Compilation timed out.",
                failed_cases=[],
            )

        if result.returncode != 0:
            return RunResult(
                verdict="COMPILE_ERROR",
                tests_total=0,
                tests_passed=0,
                score=0,
                feedback=self._truncate(result.stderr or "Compilation failed"),
                failed_cases=[],
            )
        return None

    def _get_run_command(self, language: CodingLanguage, tmpdir: str) -> List[str]:
        if language == CodingLanguage.PYTHON:
            return ["python3", os.path.join(tmpdir, "main.py")]
        if language == CodingLanguage.JAVASCRIPT:
            return ["node", os.path.join(tmpdir, "main.js")]
        if language == CodingLanguage.JAVA:
            return ["java", "-cp", tmpdir, "Main"]
        if language == CodingLanguage.CPP:
            return [os.path.join(tmpdir, "main")]
        if language == CodingLanguage.C:
            return [os.path.join(tmpdir, "main")]
        return ["python3", os.path.join(tmpdir, "main.py")]

    def _normalize_output(self, text: str) -> str:
        normalized = text.replace("\r\n", "\n").replace("\r", "\n")
        lines = [line.rstrip() for line in normalized.split("\n")]
        while lines and lines[-1] == "":
            lines.pop()
        return "\n".join(lines)

    def _score(self, passed: int, total: int) -> int:
        if total <= 0:
            return 0
        return int(round((passed / total) * 100))

    def _final_verdict(self, passed: int, total: int) -> str:
        if total == 0:
            return "PARTIAL"
        if passed == total:
            return "ACCEPTED"
        if passed == 0:
            return "WRONG_ANSWER"
        return "PARTIAL"

    def _avg_time_ms(self, timings: List[float]) -> int:
        if not timings:
            return 0
        return int(sum(timings) / len(timings))

    def _truncate(self, text: str, limit: int = 4000) -> str:
        if not text:
            return ""
        return text if len(text) <= limit else text[:limit] + "…"
