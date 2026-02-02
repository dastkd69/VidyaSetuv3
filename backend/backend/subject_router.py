from __future__ import annotations

from pathlib import Path
from typing import Optional, List, Dict

from subjects.english.pipeline import EnglishTestPaperAnalysisPipeline
from subjects.math.pipeline import MathAnalysisPipeline

_ENGLISH_PIPELINE = None
_MATH_PIPELINE = None


def _get_english_pipeline() -> EnglishTestPaperAnalysisPipeline:
    global _ENGLISH_PIPELINE
    if _ENGLISH_PIPELINE is None:
        _ENGLISH_PIPELINE = EnglishTestPaperAnalysisPipeline(
            ncert_index_path=Path(__file__).resolve().parent / "ncert_topics_index.csv",
            detection_mode="hybrid",
        )
    return _ENGLISH_PIPELINE


def _get_math_pipeline() -> MathAnalysisPipeline:
    global _MATH_PIPELINE
    if _MATH_PIPELINE is None:
        _MATH_PIPELINE = MathAnalysisPipeline(detection_mode="hybrid")
    return _MATH_PIPELINE


def analyze_subject(
    *,
    subject: str,
    pdf_path,
    manual_entries=None,
    class_level=None,
    output_dir="analysis_results",
):
    normalized = (subject or "english").strip().lower()

    if normalized == "math":
        pipeline = _get_math_pipeline()
    else:
        pipeline = _get_english_pipeline()

    return pipeline.analyze(
        pdf_path=pdf_path,
        manual_entries=manual_entries,
        class_level=class_level,
        output_dir=output_dir,
    )
