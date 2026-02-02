# analysis/pipeline.py

from pathlib import Path
from typing import List, Dict, Optional
import time
from datetime import datetime
import logging

from pdf_utils import PDFTextExtractor
from detections import WrongAnswerDetector
from ncert_index import NCERTIndexStore
from reporting import ReportWriter

from ai_engine import (
    EmbeddingModelManager,
    TopicEmbeddingIndex,
    TopicClassifier,
)

logger = logging.getLogger(__name__)


class TestPaperAnalysisPipeline:
    """
    Orchestrates the complete test paper analysis workflow
    using semantic topic matching (MiniLM).
    """

    def __init__(
        self,
        *,
        ncert_index_path: str | Path,
        dpi: int = 200,
        detection_mode: str = "hybrid",
        confidence_threshold: float = 0.35,
        max_topics_per_answer: int = 3,
    ):
        # ----------------------------
        # Core services
        # ----------------------------
        self.text_extractor = PDFTextExtractor(dpi=dpi)

        self.detector = WrongAnswerDetector(
            detection_mode=detection_mode,
            dpi=dpi,
        )

        self.ncert_index = NCERTIndexStore()
        self._ncert_index_path = Path(ncert_index_path).resolve()
        self._ncert_loaded = False

        self.embedding_model_manager = EmbeddingModelManager()
        self.topic_embedding_index: Optional[TopicEmbeddingIndex] = None
        self.topic_classifier: Optional[TopicClassifier] = None

        self.confidence_threshold = confidence_threshold
        self.max_topics_per_answer = max_topics_per_answer

        self.report_writer = ReportWriter()

    # -------------------------------------------------
    # Public API
    # -------------------------------------------------

    def analyze(
        self,
        pdf_path: str | Path,
        *,
        manual_entries: Optional[List[Dict]] = None,
        class_level: Optional[int] = None,
        output_dir: str | Path = "analysis_results",
    ) -> Dict:
        """
        Run full analysis on a test paper.
        """

        # ----------------------------
        # Lazy-load NCERT index + embeddings
        # ----------------------------
        # Ensure NCERT index is loaded
        if not self._ncert_loaded:
            self.ncert_index.load_from_path(self._ncert_index_path)
            self._ncert_loaded = True

        # Ensure topic engine is initialized
        if self.topic_classifier is None or self.topic_embedding_index is None:
            self.topic_embedding_index = TopicEmbeddingIndex(
                ncert_index_rows=self.ncert_index.rows,
                model_manager=self.embedding_model_manager,
            )

            self.topic_classifier = TopicClassifier(
                topic_index=self.topic_embedding_index,
                confidence_threshold=self.confidence_threshold,
                max_topics_per_text=self.max_topics_per_answer,
            )

            logger.info("Semantic topic engine initialized")

        pdf_path = Path(pdf_path)
        output_dir = Path(output_dir)
        output_dir.mkdir(exist_ok=True)

        start_time = time.time()

        logger.info("=" * 60)
        logger.info(f"Starting analysis: {pdf_path.name}")
        logger.info("=" * 60)

        # ----------------------------
        # Step 1: Extract text
        # ----------------------------
        pages_text = self.text_extractor.extract_pages(pdf_path)
        if not pages_text:
            return {"error": "Failed to extract text from PDF"}

        # ----------------------------
        # Step 2: Detect wrong answers
        # ----------------------------
        wrong_answers = self.detector.detect(
            pdf_path=pdf_path,
            pages_text=pages_text,
            manual_entries=manual_entries,
        )

        if not wrong_answers:
            return {"error": "No wrong answers detected"}

        # ----------------------------
        # Step 3: Semantic topic classification
        # ----------------------------
        texts = [wa["text"] for wa in wrong_answers]

        if self.topic_classifier is None:
            raise RuntimeError("Topic classifier not initialized")


        topic_results = self.topic_classifier.classify_texts(
            texts,
            target_class=class_level,
        )

        analyzed_answers = []
        for answer, topics in zip(wrong_answers, topic_results):
            analyzed_answers.append({
                **answer,
                "identified_topics": topics,
            })

        # ----------------------------
        # Step 4: Build recommendations (direct from MiniLM)
        # ----------------------------
        recommendations = []

        for answer in analyzed_answers:
            for match in answer.get("identified_topics", []):
                recommendations.append({
                    "wrong_answer_text": answer["text"][:200],
                    "page": answer.get("page"),
                    "detected_topic": match.get("topic"),
                    "topic_confidence": match.get("confidence"),
                    "recommendations": [match],
                })

        # ----------------------------
        # Step 5: Compile results
        # ----------------------------
        results = {
            "test_paper": pdf_path.name,
            "analysis_date": datetime.now().isoformat(),
            "class_level": class_level,
            "total_wrong_answers": len(wrong_answers),
            "total_recommendations": len(recommendations),
            "wrong_answers": analyzed_answers,
            "recommendations": recommendations,
            "processing_time": round(time.time() - start_time, 2),
        }

        # ----------------------------
        # Step 6: Output
        # ----------------------------
        self.report_writer.save_all(results, output_dir)
        self.report_writer.print_summary(results)

        logger.info("Analysis completed successfully")

        return results
