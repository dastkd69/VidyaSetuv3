# analysis/detection.py

from pathlib import Path
from typing import List, Dict, Tuple
import re
import io
import logging

import fitz  # PyMuPDF
import numpy as np
import cv2
from PIL import Image

logger = logging.getLogger(__name__)


class WrongAnswerDetector:
    """
    Detects wrong answers in a test paper using:
    - manual input
    - red-mark detection
    - OCR text patterns
    - hybrid combination
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

    def detect(
        self,
        pdf_path: str | Path,
        pages_text: List[Tuple[str, int]],
        manual_entries: List[Dict] | None = None,
    ) -> List[Dict]:
        """
        Main entry point for wrong-answer detection.
        """
        pdf_path = Path(pdf_path)
        results: List[Dict] = []

        logger.info(f"Detecting wrong answers (mode={self.detection_mode})")

        if self.detection_mode in ("manual", "hybrid") and manual_entries:
            results.extend(self._detect_manual(manual_entries))

        if self.detection_mode in ("color", "hybrid"):
            results.extend(self._detect_color(pdf_path))

        if self.detection_mode in ("ocr", "hybrid"):
            results.extend(self._detect_ocr_patterns(pages_text))

        results = self._deduplicate(results)

        logger.info(f"Detected {len(results)} wrong-answer instances")

        results = self._deduplicate(results)
        results = self._group_by_question(results)

        return results

    # ----------------------------
    # Detection strategies
    # ----------------------------

    def _detect_manual(self, manual_entries: List[Dict]) -> List[Dict]:
        detected = []

        for entry in manual_entries:
            if "text" in entry and entry["text"].strip():
                detected.append({
                    "page": entry.get("page", 0),
                    "text": entry["text"],
                    "question_number": entry.get("question_number", ""),
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

                    if nearby_text.strip():
                        detected.append({
                            "page": page_index + 1,
                            "text": nearby_text.strip(),
                            "detection_method": "color",
                            "confidence": 0.7,
                        })

            doc.close()

        except Exception as e:
            logger.exception("Color-based detection failed")

        return detected

    def _detect_ocr_patterns(
        self,
        pages_text: List[Tuple[str, int]],
    ) -> List[Dict]:
        detected = []

        patterns = [
            r"(?:×|X|✗)\s*(.{20,200})",
            r"(?:wrong|incorrect|error)\s*[:\-]?\s*(.{20,200})",
            r"\[\s*\]\s*(.{20,200})",
            r"(?:0|zero)\s*(?:marks?|points?)\s*(.{20,200})",
        ]

        for text, page_num in pages_text:
            for pattern in patterns:
                for match in re.finditer(pattern, text, re.IGNORECASE | re.MULTILINE):
                    answer_text = (
                        match.group(1).strip()
                        if match.lastindex
                        else match.group(0).strip()
                    )

                    if len(answer_text) >= 20:
                        detected.append({
                            "page": page_num,
                            "text": answer_text[:500],
                            "detection_method": "ocr_pattern",
                            "confidence": 0.6,
                        })

        return detected

    def _deduplicate(self, answers: List[Dict]) -> List[Dict]:
        seen = set()
        unique = []

        for ans in answers:
            norm = ans["text"].lower().strip()[:100]
            if norm not in seen:
                seen.add(norm)
                unique.append(ans)

        return unique
    
    def _group_by_question(self, detections):
        grouped = {}

        for d in detections:
            key = (
                d.get("page"),
                d.get("question_number") or d.get("page")
            )

            if key not in grouped:
                grouped[key] = d
            else:
                # merge text fragments
                grouped[key]["text"] += " " + d.get("text", "")

        return list(grouped.values())

