# analysis/ai_engine.py

from typing import List, Dict
import logging
import numpy as np
from pathlib import Path

from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)


# ============================================================
# Embedding Model Manager
# ============================================================

class EmbeddingModelManager:
    """
    Responsible for:
    - Loading MiniLM model once
    - Providing shared embedding model
    """

    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.model_name = model_name
        BASEDIR = Path(__file__).resolve().parent
        self.model_path = BASEDIR / "models" / model_name
        if not self.model_path.exists():
            fallback = BASEDIR / model_name
            if fallback.exists():
                self.model_path = fallback
        self.model = None

    def get_model(self) -> SentenceTransformer:
        if self.model is None:
            logger.info(f"Loading embedding model: {self.model_name}")
            self.model = SentenceTransformer(str(self.model_path))
            logger.info("Embedding model loaded successfully")
        return self.model


# ============================================================
# Topic Embedding Index (NCERT-driven)
# ============================================================

class TopicEmbeddingIndex:
    """
    Builds an embedding index over NCERT topics.
    This is the SINGLE source of topic truth.
    """

    def __init__(self, ncert_index_rows: List[Dict], model_manager: EmbeddingModelManager):
        if not ncert_index_rows:
            raise ValueError("NCERT index is empty. Cannot build topic index.")

        self.model = model_manager.get_model()

        # Canonical topic text used for embeddings
        self.topic_texts: List[str] = []
        self.topic_meta: List[Dict] = []

        for row in ncert_index_rows:
            topic = row.get("topic", "").strip()
            category = row.get("category", "").strip()

            if not topic:
                continue

            text = f"{topic} {category}".strip()
            self.topic_texts.append(text)
            self.topic_meta.append(row)

        logger.info(f"Building embeddings for {len(self.topic_texts)} NCERT topics")

        self.embeddings = self.model.encode(
            self.topic_texts,
            normalize_embeddings=True,
            show_progress_bar=False,
        )

        logger.info("NCERT topic embedding index ready")

    def match(
        self,
        text: str,
        top_k: int = 3,
        min_score: float = 0.35,
        target_class: int | None = None,
    ) -> List[Dict]:
        """
        Match a single text against NCERT topics using cosine similarity.
        """

        if not text or len(text.strip()) < 10:
            return []

        query_embedding = self.model.encode(
            [text],
            normalize_embeddings=True,
            show_progress_bar=False,
        )[0]

        scores = np.dot(self.embeddings, query_embedding)

        ranked_indices = scores.argsort()[::-1]

        results = []
        for idx in ranked_indices:
            score = float(scores[idx])
            if score < min_score:
                break

            meta = self.topic_meta[idx]

            # Optional class-level filtering
            if target_class is not None:
                class_level = meta.get("class_level", 0)
                if class_level and class_level != target_class:
                    continue

            results.append({
                # semantic text (internal use only)
                "_semantic_text": meta.get("_embedding_text"),
                # clean display topic (USED BY UI)
                "topic": meta.get("category") or meta.get("topic"),
                # keep full info for drill-down
                "raw_topic": meta.get("topic"),
                "category": meta.get("category"),
                "class_level": meta.get("class_level"),
                "book_name": meta.get("book_name", "NCERT"),
                "chapters": meta.get("chapters", "Not specified"),
                "page_range": meta.get("page_range", "Not specified"),
                "confidence": round(score, 3),
            })

            if len(results) >= top_k:
                break

        return results


# ============================================================
# Topic Classifier (used by TestPaperAnalyzer)
# ============================================================

class TopicClassifier:
    """
    Classifies wrong-answer texts into curriculum topics
    using MiniLM semantic similarity.
    """

    def __init__(
        self,
        topic_index: TopicEmbeddingIndex,
        confidence_threshold: float = 0.35,
        max_topics_per_text: int = 3,
    ):
        self.topic_index = topic_index
        self.confidence_threshold = confidence_threshold
        self.max_topics_per_text = max_topics_per_text

    def classify_texts(
        self,
        texts: List[str],
        target_class: int | None = None,
    ) -> List[List[Dict]]:
        """
        Classify a batch of texts.
        Output is aligned with input order.
        """

        results: List[List[Dict]] = []

        for text in texts:
            matches = self.topic_index.match(
                text=text,
                top_k=self.max_topics_per_text,
                min_score=self.confidence_threshold,
                target_class=target_class,
            )
            results.append(matches)

        return results
