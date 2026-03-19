# APIWIKI — Test Paper Analyzer API Reference

This document describes the FastAPI endpoints exposed by the backend application (registered under the `/api` prefix in `backend/app.py`). It documents each endpoint's method, path, expected request data, and response shapes (observed from the implementation).

Base: All API paths are mounted under `/api` (see `api = APIRouter(prefix="/api")` in `backend/app.py`).

Summary of endpoints
- POST /api/chat/create
- POST /api/analyze
- POST /api/tutor-chat
- GET  /api/
- GET  /api/health
- GET  /api/chat/list
- POST /api/chat/message
- DELETE /api/chat/{chat_id}

---

**POST /api/chat/create**
- Purpose: Create a new chat session for a student.
- Content-Type: `application/x-www-form-urlencoded` (form data)
- Parameters (form):
  - `student_name` (string) OR `studentName` (string) — required. Frontend may send either snake_case or camelCase.
  - `class_level` (integer) — optional.
  - `subject` (string) — optional, defaults to `english`.
- Behavior:
  - If neither `student_name` nor `studentName` is provided, returns HTTP 400 with detail "student_name required".
  - Otherwise generates a `chat_id` timestamp and saves a chat JSON under `app_data/chats/{chat_id}.json`.
- Response (200): Chat object (JSON) with keys:
  - `id`, `chatId` (same as id)
  - `student_name`, `studentName` (provided name)
  - `class_level` (if provided)
  - `created_at` (ISO timestamp)
  - `subject` (defaults to `english`)
  - `messages` (empty list)
  - `analyses` (empty list)

Example request (form):
- studentName=Riya&class_level=6&subject=english

Example response:
{
  "id": "20260319_171416",
  "chatId": "20260319_171416",
  "student_name": "Riya",
  "studentName": "Riya",
  "class_level": 6,
  "created_at": "2026-03-19T17:14:16.123456",
  "subject": "english",
  "messages": [],
  "analyses": []
}

---

**POST /api/analyze**
- Purpose: Upload a test PDF and run the subject-specific analysis pipeline. Results are appended to the chat's `analyses` list.
- Content-Type: `multipart/form-data` (file upload + form fields)
- Parameters:
  - `file` (file, required) — uploaded PDF.
  - `chat_id` (string) OR `chatId` (string) — required (form field) identifies which chat to append results to.
  - `class_level` (integer) — optional.
  - `subject` (string) — optional, defaults to `english`.
- Behavior:
  - Validates `chat_id` exists and corresponds to a saved chat JSON in `app_data/chats/` via `load_chat()`.
  - Saves uploaded PDF to `app_data/uploads/{chat_id}_{uuid}_{original_filename}`.
  - Calls `analyze_subject(subject, pdf_path, class_level, output_dir)` to run the pipeline.
  - On success, appends an `analysis_entry` to chat's `analyses` and saves the chat JSON.
  - On errors during analysis, returns `{"error": <message>}` (200 with JSON error key rather than raising a FastAPI HTTPException).
- Response (success): the updated chat object (same shape as in `create_chat`) with `analyses` containing entries like:
  - `timestamp` (ISO string)
  - `file_name` (original file.filename)
  - `results` (value returned by `analyze_subject` — see subject-specific pipeline for exact structure)

Notes about `results`:
- `results` shape depends on `subject_router.analyze_subject` and the analysis pipeline; it may include structured detections, grading results, CSV paths, and other metadata. For exact structure inspect `backend/subject_router.py` and `backend/pipeline.py`.

Error responses:
- Missing or invalid `chat_id`: `{"error": "Invalid chat_id"}` (HTTP 200 with error body)
- Analysis exceptions: `{"error": "<exception message>"}`

---

**POST /api/tutor-chat**
- Purpose: RAG-backed tutoring response generator. Accepts a JSON payload matching the `TutorChatRequest` Pydantic model and streams tokens from the tutor LLM.
- Content-Type: `application/json`
- Request body (JSON) — `TutorChatRequest` fields:
  - `topic` (string) — topic/query text.
  - `book_name` (string) — book title to search in the RAG index.
  - `class_level` (integer, optional)
  - `page_range` (array of two integers) — required: [start_page, end_page].
  - `wrong_answer_text` (string) — student's incorrect answer / mistake description.
  - `chat_history` (array of dicts) — previous chat messages/history (passed through to the LLM service).
- Behavior:
  - Returns early JSON errors if `BOOK_INDEX` or `TUTOR_LLM` are not loaded: `{"error": "Book index not loaded"}` or `{"error": "Tutor model not loaded"}`.
  - Validates `page_range` has length 2; otherwise returns `{"error": "Invalid page range"}`.
  - Uses `BOOK_INDEX.retrieve(...)` to get relevant context. If no results, returns:
    `{"response": "I do not have enough information in the selected pages."}`
  - If retrieval succeeds, prepares `context_chunks` and calls `TUTOR_LLM.generate_stream(...)`.
  - Returns a `StreamingResponse` that yields tokens (text/plain stream) from the model.
- Response:
  - On normal flow: streaming plain text tokens (media type `text/plain`).
  - On early failures: JSON with `error` or `response` keys (see above).

Example request body:
{
  "topic": "Pythagoras theorem",
  "book_name": "Mathematics Class 8",
  "class_level": 8,
  "page_range": [120, 125],
  "wrong_answer_text": "He added the sides instead of squaring them",
  "chat_history": []
}

---

**GET /api/**
- Purpose: Simple root status endpoint.
- Method: GET
- Response: `{"status": "ok", "service": "Test Paper Analyzer API"}`

**GET /api/health**
- Purpose: Health check endpoint.
- Method: GET
- Response: `{"status": "ok"}`

---

**GET /api/chat/list**
- Purpose: Return all saved chats from `app_data/chats/` as an array of chat objects.
- Method: GET
- Behavior:
  - Loads all `*.json` files in `app_data/chats/`, ensures `chatId` and `studentName` aliases exist for backward compatibility, and returns the list.
- Response: JSON array of chat objects (same shape as created by `/api/chat/create`), e.g. `[{...}, {...}]`.

---

**POST /api/chat/message**
- Purpose: Add a `message` to an existing chat's `messages` list.
- Content-Type: `application/json`
- Request body (JSON): expects an object with either `chat_id` or `chatId`, and `message`.
  - `chat_id` / `chatId` (string) — required.
  - `message` (object) — required. The code expects `message` to follow `ChatMessage` fields but does not enforce the model on input; it simply appends the `message` dict to the chat's `messages` list.
- Validation errors:
  - If `chat_id` or `message` is missing: HTTP 400 with detail "chat_id and message required".
  - If chat not found: HTTP 404 with detail "Invalid chat_id".
- Response (success): the updated chat object.

Example request body:
{
  "chatId": "20260319_171416",
  "message": {
    "role": "student",
    "content": "I think I got this question wrong",
    "timestamp": "2026-03-19T17:20:00Z",
    "file_path": null
  }
}

---

**DELETE /api/chat/{chat_id}**
- Purpose: Delete a chat JSON and all uploads/results associated with that chat id.
- Method: DELETE
- Path parameter: `chat_id` (string)
- Behavior:
  - If chat file does not exist: raises HTTP 404 "Chat not found".
  - Removes `app_data/chats/{chat_id}.json`.
  - Attempts to delete files in `app_data/uploads/` and `app_data/results/` that start with `{chat_id}_`.
- Response (success): `{"status": "deleted", "chat_id": "<chat_id>"}`

---

Notes & Implementation details
- Many endpoints return the chat object as the canonical state holder. Chat objects are saved under `app_data/chats/{chat_id}.json` and include `messages` and `analyses` fields.
- Some endpoints return JSON error objects (e.g., `{"error": "..."}`) with HTTP 200. Some other flows raise `HTTPException` for 400/404 (see `create_chat` and `add_message`). Clients should handle both styles.
- The exact structure of `analyze_subject` results depends on the pipeline and subject-specific logic; consult `backend/subject_router.py` and `backend/pipeline.py` for the precise schema returned in `analysis_entry["results"]`.
- The tutor streaming endpoint uses `StreamingResponse` and yields raw tokens as text — the frontend should read the stream progressively to show the tutor response.

---