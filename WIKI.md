# Vidyasetu — Repository Overview

This document summarizes the codebase, major components, API surface, data layout, models, and developer run instructions. It was generated automatically to give a quick on-ramp for contributors and maintainers.

**Repository Summary**
- Purpose: A "Test Paper Analyzer" system that ingests test PDFs, runs subject-specific analysis pipelines, stores results and chats, and offers a tutor-chat feature backed by a RAG/tutor LLM.
- Main languages: Python (FastAPI backend, some frontend tooling in plain JS/HTML)

**Top-level layout**
- backend/: core backend API, pipeline, indexes, and services.
- frontend/: client-side app (static HTML/JS/CSS) used by the UI.
- models/: large model artifacts (not tracked by git usually).
- app_data/: runtime data for chats, uploads, and results.
- run_app.py: (root) convenience runner (see run instructions).
- requirements.txt: Python dependencies.

---

**Backend (backend/)**
- Purpose: Hosts a FastAPI application that exposes the analysis and tutoring endpoints.
- Entrypoint: [backend/app.py](backend/app.py)
  - Registers an APIRouter at prefix `/api`.
  - Key endpoints under `/api`:
    - `POST /api/chat/create` — create a new chat (accepts `student_name` or `studentName`).
    - `POST /api/analyze` — upload a test PDF, run the subject analysis pipeline, append results to the chat.
    - `POST /api/tutor-chat` — RAG-based tutor chat streaming response (requires Book index and Tutor model loaded).
    - `GET /api/` — root status.
    - `GET /api/health` — health check.
    - `GET /api/chat/list` — list stored chats.
    - `POST /api/chat/message` — add a message to a chat.
    - `DELETE /api/chat/{chat_id}` — delete a chat and related uploads/results.

- Important modules:
  - `pipeline.py` / `TestPaperAnalysisPipeline` — subject analysis pipeline used to analyze uploaded PDFs (instantiated once in backend/app.py as PIPELINE).
  - `subject_router.py` — exposes `analyze_subject` used by the `/analyze` endpoint (subject-specific routing).
  - `book_content_index.py` / `BookContentIndex` — RAG index used by tutor feature (loads faiss index + metadata).
  - `services/tutor_llm_service.py` — wrapper for local LLM used for tutoring and streaming tokens.
  - `ai_engine.py` / `EmbeddingModelManager` — embedding model manager used by RAG retrieval.
  - `pdf_utils.py` and detection modules (`detections.py`, `detections.new.py`, `detectionssum.py`) — PDF parsing + detection of answers/questions.

- Runtime data directories (configured in backend/app.py):
  - `app_data/chats/` — saved chat JSONs.
  - `app_data/uploads/` — uploaded PDFs.
  - `app_data/results/` — analysis result files.

- Initialization behaviors:
  - Backend attempts to load a BookContentIndex (faiss index + meta) and a Tutor LLM model on startup if the files exist.
  - It validates presence of `ncert_topics_index.csv` on startup and loads it into the `PIPELINE`.

---

**Frontend (frontend/)**
- Static client with HTML, CSS, and JS.
- Key files:
  - `frontend/index.html` — main UI entry (served separately from backend in many setups).
  - `frontend/app.py` — (small Python/Flask helper possibly for static serving or dev); confirm usage in your deployment.
  - `frontend/js/` — contains client-side logic (chat UI, profile, analysis pages).
  - `frontend/css/` — UI styling.
- A legacy folder `frontend.old/` contains React/JSX artifacts (historical).

---

**Models & Indexes**
- `models/` — contains larger model artifacts (e.g., `Phi-3-mini-4k-instruct-q4.gguf` or other GGUF files). These are large and typically not committed.
- `backend/all-MiniLM-L6-v2/` — local sentence-transformer model files used for embeddings.
- RAG index files live under `backend/rag/` or the backend directory: `book_index.faiss`, `book_index_meta.json`.
- The Tutor LLM model path is configurable; backend checks `MODELS_DIR` / `tinyllama1.1b.gguf` or other configured locations.

---

**Data & Results**
- `app_data/uploads/` — uploaded PDFs are saved with a timestamp + uuid prefix.
- `app_data/results/` — pipeline outputs and CSV/JSON exports.
- `app_data/chats/` — persistent chat JSONs are saved here and read by the backend for chat state.

---

**How to run (developer)**
1. Create a Python virtualenv and install dependencies:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. Ensure required data/index/model files are present:
- `backend/ncert_topics_index.csv` must exist (backend validates at startup).
- Optional: place `book_index.faiss` and `book_index_meta.json` under `backend/rag/` or `backend/` so the app can find them.
- Optional: put your Tutor LLM GGUF model in `backend/models/` or adjust `backend/app.py` `MODEL_PATH`.

3. Run the API server (example):

```bash
uvicorn backend.app:app --host 0.0.0.0 --port 8000 --reload
```

4. Use the frontend static files or a separate static server to access the UI.

Notes: `run_app.py` exists at the repo root — inspect it if you prefer a convenience runner.

---

**Dependencies**
- See `requirements.txt` at repo root for exact pinned packages.
- Typical dependencies include `fastapi`, `uvicorn`, `pydantic`, `faiss` (or `faiss-cpu`), `sentence-transformers` or similar, and model runtime libs if using GGUF backends.

---

**Development notes & tips**
- The backend instantiates heavy components (pipeline, embedding manager, RAG index, tutor model) on import; for unit testing you may want to mock or lazy-load these to speed tests.
- The API uses both snake_case and camelCase to remain compatible with the frontend.
- Uploaded PDFs and the results CSV/JSON are persisted under `app_data/` — watch disk usage.
- If the Tutor model or book index are missing, `/api/tutor-chat` will return a friendly error early.

---

**Where to look for key logic**
- API routing and orchestration: [backend/app.py](backend/app.py)
- Analysis pipeline: `backend/pipeline.py`
- Subject-specific analysis: `backend/subject_router.py`
- RAG & retrieval: `backend/book_content_index.py`
- Tutor LLM wrapper: `backend/services/tutor_llm_service.py`
- Embeddings: `backend/ai_engine.py`
- PDF parsing and detections: `backend/pdf_utils.py`, `backend/detections.py`, `backend/detections.new.py`

---

**FAQ / Quick checks**
- "Why is the tutor endpoint failing?" — Ensure `book_index` and tutor model files exist and were loadable (see startup log prints in `backend/app.py`).
- "Where are chats stored?" — `app_data/chats/` as JSON files.
- "How are analyses named?" — Filenames start with chat id + uuid; results are saved to `app_data/results/`.

---
