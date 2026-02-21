from __future__ import annotations

import argparse
import json
from pathlib import Path
import time
from typing import Iterator

import faiss
import numpy as np

from ai_engine import EmbeddingModelManager
from pdf_utils import PDFTextExtractor


def extract_class_level_from_filename(stem: str) -> int | None:
    import re
    match = re.search(r"class[_\- ]?(\d+)", stem.lower())
    if match:
        return int(match.group(1))
    return None


def chunk_text(text: str, chunk_size: int = 100):
    if chunk_size <= 0:
        raise ValueError("chunk_size must be a positive integer")
    words = text.split()
    for i in range(0, len(words), chunk_size):
        chunk = " ".join(words[i : i + chunk_size])
        if chunk.strip():
            yield chunk


def discover_pdfs_with_subject(books_dir: Path) -> list[tuple[Path, str]]:
    discovered: list[tuple[Path, str]] = []
    for pdf_path in sorted(books_dir.rglob("*.pdf")):
        try:
            rel_path = pdf_path.relative_to(books_dir)
        except ValueError:
            continue
        if not rel_path.parts:
            continue
        subject = rel_path.parts[0].strip()
        if not subject:
            subject = "Unknown"
        discovered.append((pdf_path, subject))
    return discovered


def safe_extract_pages(extractor: PDFTextExtractor, pdf_path: Path) -> Iterator[tuple[str, int]]:
    pages = extractor.extract_pages(pdf_path)
    for page in pages:
        if not isinstance(page, (tuple, list)) or len(page) != 2:
            continue
        page_text, page_number = page
        if not isinstance(page_text, str):
            continue
        try:
            normalized_page_number = int(page_number)
        except (TypeError, ValueError):
            normalized_page_number = 0
        yield page_text, normalized_page_number


def main() -> int:
    start_time = time.time()
    parser = argparse.ArgumentParser(description="Build NCERT book index.")
    parser.add_argument("--books-dir", required=True, help="Path to NCERT PDFs.")
    parser.add_argument(
        "--output-dir",
        default="backend/rag",
        help="Output directory for FAISS index and metadata.",
    )
    parser.add_argument(
        "--chunk-size",
        type=int,
        default=100,
        help="Number of words per chunk.",
    )
    args = parser.parse_args()

    books_dir = Path(args.books_dir).resolve()
    chunk_size = args.chunk_size
    if not books_dir.exists():
        raise SystemExit(f"Books directory not found: {books_dir}")
    if not books_dir.is_dir():
        raise SystemExit(f"books-dir must be a directory: {books_dir}")
    if chunk_size <= 0:
        raise SystemExit(f"chunk-size must be a positive integer: {chunk_size}")

    pdf_entries = discover_pdfs_with_subject(books_dir)
    if not pdf_entries:
        raise SystemExit(f"No PDF files found in: {books_dir}")

    print(f"PDFs detected: {len(pdf_entries)}")

    try:
        extractor = PDFTextExtractor()
    except Exception as exc:
        raise SystemExit(f"Failed to initialize PDF extractor: {exc}") from exc

    try:
        model_manager = EmbeddingModelManager()
        model = model_manager.get_model()
    except Exception as exc:
        raise SystemExit(f"Failed to initialize embedding model: {exc}") from exc

    metadata: list[dict] = []
    processed_pdfs = 0
    failed_pdfs = 0

    for pdf_path, subject in pdf_entries:
        try:
            page_count_for_pdf = 0
            for page_text, page_number in safe_extract_pages(extractor, pdf_path):
                page_count_for_pdf += 1
                for chunk in chunk_text(page_text, chunk_size=chunk_size):
                    metadata.append(
                        {
                            "subject": subject,
                            "book_name": pdf_path.stem,
                            "class_level": extract_class_level_from_filename(pdf_path.stem),
                            "page_number": page_number,
                            "text": chunk,
                        }
                    )
            if page_count_for_pdf > 0:
                processed_pdfs += 1
            else:
                failed_pdfs += 1
                print(f"Warning: no readable pages extracted from {pdf_path}")
        except Exception as exc:
            failed_pdfs += 1
            print(f"Warning: failed to parse {pdf_path}: {exc}")

    texts = [item["text"] for item in metadata]
    if not texts:
        raise SystemExit("No text chunks found. Index not created.")

    try:
        embeddings = model.encode(
            texts,
            normalize_embeddings=True,
            show_progress_bar=True,
        )
        embeddings = np.array(embeddings, dtype="float32")
    except Exception as exc:
        raise SystemExit(f"Failed to generate embeddings: {exc}") from exc

    if embeddings.ndim != 2 or embeddings.shape[0] == 0:
        raise SystemExit("Embedding output is invalid. Index not created.")

    dim = embeddings.shape[1]
    index = faiss.IndexFlatIP(dim)
    index.add(embeddings)

    output_dir = Path(args.output_dir).resolve()
    try:
        output_dir.mkdir(parents=True, exist_ok=True)
    except Exception as exc:
        raise SystemExit(f"Failed to create output directory {output_dir}: {exc}") from exc
    index_path = output_dir / "book_index.faiss"
    meta_path = output_dir / "book_index_meta.json"

    try:
        faiss.write_index(index, str(index_path))
    except Exception as exc:
        raise SystemExit(f"Failed to write FAISS index to {index_path}: {exc}") from exc

    try:
        with meta_path.open("w", encoding="utf-8") as f:
            json.dump(metadata, f, ensure_ascii=False)
    except Exception as exc:
        raise SystemExit(f"Failed to write metadata JSON to {meta_path}: {exc}") from exc

    runtime_seconds = time.time() - start_time
    print(f"PDFs processed: {processed_pdfs}")
    if failed_pdfs:
        print(f"PDFs failed: {failed_pdfs}")
    print(f"Total chunks: {len(metadata)}")
    print(f"Embedding dimension: {dim}")
    print(f"Runtime: {runtime_seconds:.2f}s")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
