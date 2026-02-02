from __future__ import annotations

from pathlib import Path
from typing import List, Dict, Tuple, Optional
import io
import logging
import re

import fitz  # PyMuPDF
import numpy as np
import cv2
from PIL import Image

logger = logging.getLogger(__name__)


class MathWrongAnswerDetector:
    """
    Detects math wrong-answer candidates using OCR heuristics,
    red-mark detection, and manual entries.
    """

    def __init__(
        self,
        detection_mode: str = "hybrid",
        dpi: int = 200,
        red_threshold: int = 100,
    ):
        self.detection_mode = detection_mode
        self.dpi = dpi
        self.red_threshold = red_threshold

        self._question_marker = re.compile(
            r"^(?:Q\s*\d+|Question\s*\d+|Q\d+|Solve\b|Find\b|Evaluate\b|Simplify\b)",
            re.IGNORECASE,
        )
        self._question_number = re.compile(r"\bQ\s*(\d+)\b|\bQuestion\s*(\d+)\b", re.IGNORECASE)
        self._answer_marker = re.compile(r"^(?:Ans(?:wer)?|Student\s*Answer)\s*[:\-]?\s*(.+)$", re.IGNORECASE)
        self._math_expression = re.compile(r"[=+\-×÷/√^]")

    def detect(
        self,
        pdf_path: str | Path,
        pages_text: List[Tuple[str, int]],
        manual_entries: List[Dict] | None = None,
    ) -> List[Dict]:
        pdf_path = Path(pdf_path)
        results: List[Dict] = []

        logger.info("Detecting math answers (mode=%s)", self.detection_mode)

        if self.detection_mode in ("manual", "hybrid") and manual_entries:
            results.extend(self._detect_manual(manual_entries))

        if self.detection_mode in ("color", "hybrid"):
            results.extend(self._detect_color(pdf_path))

        if self.detection_mode in ("ocr", "hybrid"):
            results.extend(self._detect_ocr_patterns(pages_text))

        results = self._deduplicate(results)
        results = self._group_by_question(results)
        return results

    def _detect_manual(self, manual_entries: List[Dict]) -> List[Dict]:
        detected = []

        for entry in manual_entries:
            question = (entry.get("question") or entry.get("text") or "").strip()
            if not question:
                continue

            detected.append({
                "page": int(entry.get("page", 0) or 0),
                "question": question,
                "student_answer": (entry.get("student_answer") or "").strip(),
                "detection_method": "manual",
                "confidence": 1.0,
            })

        return detected

    def _detect_color(self, pdf_path: Path) -> List[Dict]:
        detected = []

        try:
            doc = fitz.open(str(pdf_path))

            for page_index in range(len(doc)):
                page = doc[page_index]
                pix = page.get_pixmap(dpi=self.dpi)

                img_data = pix.tobytes("png")
                img = Image.open(io.BytesIO(img_data))
                img_cv = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)

                hsv = cv2.cvtColor(img_cv, cv2.COLOR_BGR2HSV)

                lower_red1 = np.array([0, 50, 50])
                upper_red1 = np.array([10, 255, 255])
                lower_red2 = np.array([170, 50, 50])
                upper_red2 = np.array([180, 255, 255])

                mask1 = cv2.inRange(hsv, lower_red1, upper_red1)
                mask2 = cv2.inRange(hsv, lower_red2, upper_red2)
                red_mask = mask1 + mask2

                contours, _ = cv2.findContours(
                    red_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
                )

                if not contours:
                    continue

                blocks = page.get_text("blocks")

                for contour in contours:
                    x, y, w, h = cv2.boundingRect(contour)

                    expanded = fitz.Rect(
                        max(0, x - 50),
                        max(0, y - 50),
                        min(pix.width, x + w + 50),
                        min(pix.height, y + h + 50),
                    )

                    nearby_text = ""
                    for block in blocks:
                        block_rect = fitz.Rect(block[:4])
                        if block_rect.intersects(expanded):
                            nearby_text += block[4] + " "

                    nearby_text = nearby_text.strip()
                    if nearby_text:
                        question, student_answer = self._split_question_answer(nearby_text.splitlines())
                        detected.append({
                            "page": page_index + 1,
                            "question": question or nearby_text,
                            "student_answer": student_answer,
                            "detection_method": "color",
                            "confidence": 0.7,
                        })

            doc.close()

        except Exception:
            logger.exception("Color-based detection failed")

        return detected

    def _detect_ocr_patterns(
        self,
        pages_text: List[Tuple[str, int]],
    ) -> List[Dict]:
        detected = []

        for text, page_num in pages_text:
            lines = [line.strip() for line in text.splitlines() if line.strip()]
            idx = 0
            while idx < len(lines):
                line = lines[idx]

                if self._is_question_start(line):
                    block_lines, next_idx = self._collect_block(lines, idx)
                    question, student_answer = self._split_question_answer(block_lines)
                    if question:
                        detected.append({
                            "page": page_num,
                            "question": question,
                            "student_answer": student_answer,
                            "detection_method": "ocr",
                            "confidence": 0.6,
                        })
                    idx = next_idx
                    continue

                idx += 1

        return detected

    def _is_question_start(self, line: str) -> bool:
        if self._question_marker.search(line):
            return True
        if self._math_expression.search(line) and len(line) >= 8:
            return True
        return False

    def _collect_block(self, lines: List[str], start_idx: int) -> Tuple[List[str], int]:
        block = [lines[start_idx]]
        idx = start_idx + 1
        max_lines = 4

        while idx < len(lines) and len(block) < max_lines:
            next_line = lines[idx]
            if self._question_marker.search(next_line):
                break
            if not next_line:
                break
            block.append(next_line)
            idx += 1

        return block, idx

    def _split_question_answer(self, block_lines: List[str]) -> Tuple[str, str]:
        question_lines = []
        student_answer = ""

        for line in block_lines:
            answer_match = self._answer_marker.match(line)
            if answer_match:
                student_answer = answer_match.group(1).strip()
                continue

            if student_answer:
                continue

            question_lines.append(line)

        question = " ".join(question_lines).strip()

        if not student_answer:
            for line in block_lines:
                if self._math_expression.search(line) and "=" in line:
                    parts = line.split("=")
                    if len(parts) > 1 and parts[-1].strip():
                        student_answer = parts[-1].strip()
                        break

        return question, student_answer.strip()

    def _deduplicate(self, answers: List[Dict]) -> List[Dict]:
        seen = set()
        unique = []

        for ans in answers:
            norm_q = (ans.get("question") or "").lower().strip()[:120]
            norm_a = (ans.get("student_answer") or "").lower().strip()[:120]
            key = (ans.get("page"), norm_q, norm_a)
            if key in seen:
                continue
            seen.add(key)
            unique.append(ans)

        return unique

    def _group_by_question(self, detections: List[Dict]) -> List[Dict]:
        grouped: Dict[Tuple[int, Optional[str]], Dict] = {}

        for d in detections:
            question_number = self._extract_question_number(d.get("question", ""))
            key = (d.get("page"), question_number or d.get("question", "")[:60])

            if key not in grouped:
                grouped[key] = d
                continue

            existing = grouped[key]
            if len(d.get("question", "")) > len(existing.get("question", "")):
                existing["question"] = d.get("question", existing.get("question"))

            if not existing.get("student_answer") and d.get("student_answer"):
                existing["student_answer"] = d.get("student_answer")

            existing["confidence"] = max(existing.get("confidence", 0), d.get("confidence", 0))

        return list(grouped.values())

    def _extract_question_number(self, text: str) -> Optional[str]:
        match = self._question_number.search(text or "")
        if not match:
            return None
        return match.group(1) or match.group(2)

