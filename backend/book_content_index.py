from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any
import json
import time

import faiss
import numpy as np

from ai_engine import EmbeddingModelManager


@dataclass
class BookContentIndex:
    index_path: Path
    metadata_path: Path
    model_manager: EmbeddingModelManager
    index: faiss.Index | None = None
    metadata: list[dict[str, Any]] | None = None

    def _debug_log(self, hypothesis_id: str, location: str, message: str, data: dict, run_id: str = "initial") -> None:
        payload = {
            "runId": run_id,
            "hypothesisId": hypothesis_id,
            "location": location,
            "message": message,
            "data": data,
            "timestamp": int(time.time() * 1000),
        }
        try:
            with open("/home/ec2-user/Vidyasetu/.cursor/debug.log", "a", encoding="utf-8") as f:
                f.write(json.dumps(payload, ensure_ascii=False) + "\n")
        except Exception:
            pass

    def load(self) -> None:
        if not self.index_path.exists():
            raise FileNotFoundError(f"FAISS index not found: {self.index_path}")
        if not self.metadata_path.exists():
            raise FileNotFoundError(f"Metadata JSON not found: {self.metadata_path}")
        self.index = faiss.read_index(str(self.index_path))
        raw = json.loads(self.metadata_path.read_text(encoding="utf-8"))
        if isinstance(raw, dict):
            self.metadata = raw.get("items", [])
        else:
            self.metadata = raw

    def retrieve(
        self,
        query_text: str,
        book_name: str,
        class_level: int | None,
        page_range: tuple[int, int] | list[int],
        chapter_name: str | None = None,
        top_k: int = 3,
        similarity_floor: float = 0.35,
        strict_mode: bool = True,
        debug: bool = False,
    ) -> list[dict[str, Any]]:
        # region agent log
        self._debug_log(
            "Q1",
            "backend/book_content_index.py:retrieve-entry",
            "Retrieve quality run started",
            {
                "book_name": book_name,
                "class_level": class_level,
                "page_range": list(page_range),
                "similarity_floor": similarity_floor,
                "strict_mode": strict_mode,
                "query_prefix": (query_text or "")[:120],
            },
        )
        # endregion
        if self.index is None or self.metadata is None:
            raise RuntimeError("Index not loaded. Call load() first.")

        start_page, end_page = page_range
        candidates: list[int] = []

        for idx, meta in enumerate(self.metadata):
            if meta.get("book_name") != book_name:
                continue
            meta_class = meta.get("class_level")
            if class_level is not None and meta_class is not None:
                if meta_class != class_level:
                    continue
            if chapter_name:
                meta_chapter = meta.get("chapter_title")
                if not meta_chapter or chapter_name.lower() not in meta_chapter.lower():
                    continue
            page_number = meta.get("page_number")
            if page_number is None:
                continue
            if page_number < start_page or page_number > end_page:
                continue
            candidates.append(idx)

        if debug:
            print(f"Candidates after filtering: {len(candidates)}")
        # region agent log
        self._debug_log(
            "Q1",
            "backend/book_content_index.py:post-filter",
            "Candidates after strict filtering",
            {"candidates": len(candidates)},
        )
        # endregion

        if not candidates:
            return []

        model = self.model_manager.get_model()
        query_embedding = model.encode(
            [query_text],
            normalize_embeddings=True,
            show_progress_bar=False,
        )[0]

        vectors = np.vstack(
            [self.index.reconstruct(i) for i in candidates]
        ).astype("float32")
        scores = vectors @ query_embedding.astype("float32")
        max_score = float(scores.max())
        if debug:
            print(f"Max score: {max_score}")
        # region agent log
        self._debug_log(
            "Q2",
            "backend/book_content_index.py:score-stats",
            "Similarity score stats",
            {
                "max_score": max_score,
                "min_score": float(scores.min()),
                "mean_score": float(scores.mean()),
            },
        )
        # endregion
        if strict_mode and max_score < similarity_floor:
            if debug:
                print("All scores below similarity floor.")
            return []

        ranked = np.argsort(scores)[::-1]
        results: list[dict[str, Any]] = []
        selected_scores: list[float] = []

        for rank in ranked:
            score = float(scores[int(rank)])
            if strict_mode and score < similarity_floor:
                break
            meta = self.metadata[candidates[int(rank)]]
            selected_scores.append(score)
            results.append(
                {
                    "text": meta.get("text", ""),
                    "page_number": meta.get("page_number"),
                }
            )
            if len(results) >= max(top_k, 1):
                break

        if debug:
            print(f"Results after similarity filter: {len(results)}")
        # region agent log
        self._debug_log(
            "Q3",
            "backend/book_content_index.py:post-ranking",
            "Top retrieval quality snapshot",
            {
                "results": len(results),
                "selected_scores": selected_scores,
                "top_pages": [r.get("page_number") for r in results[:3]],
                "top_text_prefixes": [(r.get("text", "")[:120]) for r in results[:3]],
            },
        )
        # endregion

        return results
