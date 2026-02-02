from __future__ import annotations

from typing import Dict, Optional
import math

import sympy


class MathAnswerValidator:
    def check(
        self,
        student_answer: str,
        expected_answer: str | None = None,
    ) -> Dict:
        student = (student_answer or "").strip()
        expected = (expected_answer or "").strip() if expected_answer is not None else None

        if not student:
            return {
                "is_correct": False,
                "method": "string",
                "reason": "Empty student answer",
            }

        if expected is None or not expected:
            return {
                "is_correct": False,
                "method": "unknown",
                "reason": "Expected answer not provided",
            }

        normalized_student = self._normalize(student)
        normalized_expected = self._normalize(expected)

        numeric_result = self._numeric_compare(normalized_student, normalized_expected)
        if numeric_result is not None:
            return numeric_result

        symbolic_result = self._symbolic_compare(normalized_student, normalized_expected)
        if symbolic_result is not None:
            return symbolic_result

        string_result = self._string_compare(normalized_student, normalized_expected)
        if string_result is not None:
            return string_result

        return {
            "is_correct": False,
            "method": "unknown",
            "reason": "Unable to validate expression",
        }

    def _normalize(self, text: str) -> str:
        return (
            text.replace("×", "*")
            .replace("÷", "/")
            .replace("^", "**")
            .replace("−", "-")
            .strip()
        )

    def _numeric_compare(self, student: str, expected: str) -> Optional[Dict]:
        try:
            student_val = float(student)
            expected_val = float(expected)
        except Exception:
            return None

        if math.isfinite(student_val) and math.isfinite(expected_val):
            is_close = math.isclose(student_val, expected_val, rel_tol=1e-3, abs_tol=1e-3)
            return {
                "is_correct": bool(is_close),
                "method": "numeric",
                "reason": "Numeric comparison",
            }

        return None

    def _symbolic_compare(self, student: str, expected: str) -> Optional[Dict]:
        try:
            student_expr = sympy.sympify(student, evaluate=True)
            expected_expr = sympy.sympify(expected, evaluate=True)
            simplified = sympy.simplify(student_expr - expected_expr)
            is_equal = simplified == 0
            return {
                "is_correct": bool(is_equal),
                "method": "symbolic",
                "reason": "Symbolic equivalence",
            }
        except Exception:
            return None

    def _string_compare(self, student: str, expected: str) -> Optional[Dict]:
        if not student or not expected:
            return None

        is_equal = student.replace(" ", "") == expected.replace(" ", "")
        return {
            "is_correct": bool(is_equal),
            "method": "string",
            "reason": "Normalized string comparison",
        }

