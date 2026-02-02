from __future__ import annotations

from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime
import time
import json
import logging

from pdf_utils import PDFTextExtractor
from .detector import MathWrongAnswerDetector
from .classifier import MathAnswerValidator, MathTopicClassifier

logger = logging.getLogger(__name__)


class MathAnalysisPipeline:
    def __init__(
        self,
        *,
        dpi: int = 200,
        detection_mode: str = "hybrid",
    ):
        self.text_extractor = PDFTextExtractor(dpi=dpi)
        self.detector = MathWrongAnswerDetector(detection_mode=detection_mode, dpi=dpi)
        self.validator = MathAnswerValidator()
        self.topic_classifier = MathTopicClassifier()

    def analyze(
        self,
        pdf_path: str | Path,
        *,
        manual_entries: Optional[List[Dict]] = None,
        class_level: Optional[int] = None,
        output_dir: str | Path = "analysis_results",
    ) -> Dict:
        pdf_path = Path(pdf_path)
        output_dir = Path(output_dir)
        output_dir.mkdir(exist_ok=True)

        start_time = time.time()

        try:
            pages_text = self.text_extractor.extract_pages(pdf_path)
            if not pages_text:
                return {"error": "Failed to extract text from PDF"}

            detections = self.detector.detect(
                pdf_path=pdf_path,
                pages_text=pages_text,
                manual_entries=manual_entries,
            )

            wrong_answers: List[Dict] = []
            recommendations: List[Dict] = []

            for det in detections:
                validation = self.validator.check(
                    student_answer=det.get("student_answer", ""),
                    expected_answer=det.get("expected_answer"),
                )

                if validation.get("is_correct"):
                    continue

                entry = {
                    "page": det.get("page", 0),
                    "question": det.get("question", ""),
                    "student_answer": det.get("student_answer", ""),
                    "validation": validation,
                }
                wrong_answers.append(entry)

                topics = self.topic_classifier.classify(
                    question=entry["question"],
                    student_answer=entry["student_answer"],
                    class_level=class_level,
                )

                detected_topic = topics[0]["topic"] if topics else "Math topic detection pending"
                topic_confidence = topics[0]["confidence"] if topics else 0.0

                recommendations.append({
                    "wrong_answer_text": entry["question"],
                    "page": entry["page"],
                    "detected_topic": detected_topic,
                    "topic_confidence": topic_confidence,
                    "recommendations": topics,
                })

            results = {
                "test_paper": pdf_path.name,
                "analysis_date": datetime.now().isoformat(),
                "class_level": class_level,
                "total_wrong_answers": len(wrong_answers),
                "total_recommendations": len(recommendations),
                "wrong_answers": wrong_answers,
                "recommendations": recommendations,
                "processing_time": round(time.time() - start_time, 2),
            }

            self._write_json(results, output_dir)
            return results
        except Exception:
            logger.exception("Math analysis failed")
            return {"error": "Math analysis failed"}

    def _write_json(self, results: Dict, output_dir: Path) -> None:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        base = Path(results["test_paper"]).stem
        path = output_dir / f"{base}_{ts}.json"
        path.write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8")

