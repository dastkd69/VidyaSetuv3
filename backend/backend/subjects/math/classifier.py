from __future__ import annotations

from typing import Dict, Optional, List
import math
import csv
from pathlib import Path
import re

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


class MathTopicClassifier:
    def __init__(self, index_path: str | Path | None = None):
        base_dir = Path(__file__).resolve().parents[2]
        self.index_path = Path(index_path) if index_path else base_dir / "ncert_math_topics_index.csv"
        self._rows = self._load_index(self.index_path)

        self._fraction_keywords = {"fraction", "fractions", "ratio", "ratios", "proportion"}
        self._geometry_keywords = {"triangle", "triangles", "circle", "circles", "angle", "angles"}
        self._mensuration_keywords = {"area", "perimeter"}
        self._variable_pattern = re.compile(r"\b[x-y]\b|[a-zA-Z]\s*=", re.IGNORECASE)

    def classify(
        self,
        question: str,
        student_answer: str,
        class_level: int | None = None,
    ) -> List[Dict]:
        text = f"{question or ''} {student_answer or ''}".lower()
        topics: List[Dict] = []

        if self._is_fraction(text):
            topics.append(self._build_topic("Arithmetic", "Fractions", class_level, 0.75))

        if self._is_algebra(text):
            topics.append(self._build_topic("Algebra", "Linear Equations", class_level, 0.8))
            topics.append(self._build_topic("Algebra", "Expressions", class_level, 0.7))

        if self._is_mensuration(text):
            topics.append(self._build_topic("Mensuration", "Area", class_level, 0.7))
            topics.append(self._build_topic("Mensuration", "Perimeter", class_level, 0.7))

        if self._is_geometry(text):
            topics.append(self._build_topic("Geometry", "Triangles", class_level, 0.7))
            topics.append(self._build_topic("Geometry", "Angles", class_level, 0.7))
            topics.append(self._build_topic("Geometry", "Circles", class_level, 0.65))

        deduped = []
        seen = set()
        for topic in topics:
            key = (topic.get("topic"), topic.get("chapters"))
            if key in seen:
                continue
            seen.add(key)
            deduped.append(topic)

        return deduped

    def _is_fraction(self, text: str) -> bool:
        if any(word in text for word in self._fraction_keywords):
            return True
        return "/" in text

    def _is_algebra(self, text: str) -> bool:
        return bool(self._variable_pattern.search(text))

    def _is_geometry(self, text: str) -> bool:
        return any(word in text for word in self._geometry_keywords)

    def _is_mensuration(self, text: str) -> bool:
        return any(word in text for word in self._mensuration_keywords)

    def _build_topic(
        self,
        topic: str,
        subtopic: str,
        class_level: int | None,
        confidence: float,
    ) -> Dict:
        row = self._find_row(topic, subtopic, class_level)
        return {
            "topic": f"{topic} / {subtopic}",
            "class_level": row.get("class_level") if row else class_level,
            "book_name": "NCERT Mathematics",
            "chapters": row.get("chapter", "Not specified") if row else "Not specified",
            "page_range": row.get("page_range", "Not specified") if row else "Not specified",
            "confidence": confidence,
        }

    def _find_row(
        self,
        topic: str,
        subtopic: str,
        class_level: int | None,
    ) -> Dict:
        matches = [
            row for row in self._rows
            if row.get("topic") == topic and row.get("subtopic") == subtopic
        ]
        if class_level is not None:
            for row in matches:
                if row.get("class_level") == class_level:
                    return row
        return matches[0] if matches else {}

    def _load_index(self, path: Path) -> List[Dict]:
        if not path.exists():
            return []

        rows: List[Dict] = []
        with open(path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                normalized = {k.strip(): (v.strip() if v is not None else "") for k, v in row.items()}
                normalized["class_level"] = self._to_int(normalized.get("class_level"))
                rows.append(normalized)
        return rows

    @staticmethod
    def _to_int(value) -> Optional[int]:
        try:
            return int(value)
        except Exception:
            return None

