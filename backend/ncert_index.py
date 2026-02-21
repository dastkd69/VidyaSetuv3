# analysis/ncert_index.py

from pathlib import Path
from typing import List, Dict, Optional
import csv
import logging

logger = logging.getLogger(__name__)


class NCERTIndexStore:
    """
    Loads NCERT topic index CSV files.
    Acts as the SINGLE source of truth for curriculum metadata.
    """

    def __init__(self):
        self._rows: List[Dict] = []
        self._loaded = False

    # ----------------------------
    # Loading
    # ----------------------------

    def load_from_path(self, path: str | Path):
        """
        Load NCERT index data from a CSV file or a directory of CSVs.
        """
        path = Path(path)

        if not path.exists():
            raise FileNotFoundError(f"NCERT index path not found: {path}")

        csv_files = [path] if path.is_file() else sorted(path.glob("*.csv"))

        if not csv_files:
            raise ValueError(f"No CSV files found in: {path}")

        rows: List[Dict] = []

        for csv_file in csv_files:
            logger.info(f"Loading NCERT index: {csv_file.name}")

            try:
                with open(csv_file, "r", encoding="utf-8") as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        normalized = self._normalize_row(row)
                        if normalized.get("topic"):
                            rows.append(normalized)

            except Exception:
                logger.exception(f"Failed to load NCERT index: {csv_file}")
                raise

        self._rows = rows
        self._loaded = True

        logger.info(f"Loaded {len(self._rows)} NCERT index entries")

    # ----------------------------
    # Backward-compatible Query (optional)
    # ----------------------------

    def query(
        self,
        topic: str,
        class_level: Optional[int] = None,
        limit: int = 3,
    ) -> List[Dict]:
        """
        Exact-match query (kept for backward compatibility).
        NOT used by MiniLM pipeline.
        """
        if not self._loaded:
            raise RuntimeError("NCERTIndexStore not loaded")

        topic_lower = topic.lower()

        matches = [
            row for row in self._rows
            if row.get("topic", "").lower() == topic_lower
        ]

        if class_level is not None:
            matches = [
                row for row in matches
                if row.get("class_level") == class_level
            ]

        matches.sort(
            key=lambda r: (r.get("confidence", 0.0), r.get("occurrences", 0)),
            reverse=True,
        )

        return matches[:limit]

    # ----------------------------
    # Helpers
    # ----------------------------

    def _normalize_row(self, row: Dict) -> Dict:
        """
        Normalize CSV row types and enrich with embedding text.
        """
        normalized = {k.strip(): v.strip() for k, v in row.items() if v is not None}

        # ---- Numeric fields ----
        normalized["class_level"] = self._to_int(normalized.get("class_level"))
        normalized["confidence"] = self._to_float(normalized.get("confidence"))
        normalized["occurrences"] = self._to_int(normalized.get("occurrences"))

        # ---- Canonical text for embeddings ----
        topic = normalized.get("topic", "")
        category = normalized.get("category", "")

        normalized["_embedding_text"] = f"{topic} {category}".strip()

        return normalized

    @staticmethod
    def _to_int(value) -> Optional[int]:
        try:
            return int(value)
        except Exception:
            return None

    @staticmethod
    def _to_float(value) -> float:
        try:
            return float(value)
        except Exception:
            return 0.0

    # ----------------------------
    # Public access
    # ----------------------------

    @property
    def rows(self) -> List[Dict]:
        """
        Raw normalized NCERT rows.
        Used by TopicEmbeddingIndex.
        """
        if not self._loaded:
            raise RuntimeError("NCERT index not loaded")
        return self._rows
