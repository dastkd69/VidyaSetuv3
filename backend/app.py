# backend/app.py
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from datetime import datetime
from pydantic import BaseModel
from typing import List, Optional
import shutil
import uuid
import json
import logging
from pipeline import TestPaperAnalysisPipeline
from subject_router import analyze_subject
from book_content_index import BookContentIndex
from services.tutor_llm_service import TutorLLMService
from ai_engine import EmbeddingModelManager

# -------------------------------------------------
# App setup
# -------------------------------------------------

app = FastAPI(title="Test Paper Analyzer API")
logger = logging.getLogger(__name__)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten later
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------
# Paths
# -------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent
RAG_DIR = BASE_DIR / "rag"
DATA_DIR = BASE_DIR / "app_data"
CHATS_DIR = DATA_DIR / "chats"
UPLOADS_DIR = DATA_DIR / "uploads"
RESULTS_DIR = DATA_DIR / "results"
NCERT_INDEX = BASE_DIR / "ncert_topics_index.csv"

for d in (DATA_DIR, CHATS_DIR, UPLOADS_DIR, RESULTS_DIR):
    d.mkdir(parents=True, exist_ok=True)

# -------------------------------------------------
# Pipeline (loaded once)
# -------------------------------------------------

PIPELINE = TestPaperAnalysisPipeline(
    ncert_index_path=NCERT_INDEX,
    detection_mode="hybrid",
)

# ----------------------------
# RAG + Tutor Initialization
# ----------------------------

INDEX_PATH = BASE_DIR / "book_index.faiss"
META_PATH = BASE_DIR / "book_index_meta.json"


def _resolve_existing_path(candidates: list[Path], fallback: Path) -> Path:
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return fallback


index_candidates = [
    RAG_DIR / "book_index.faiss",
    BASE_DIR / "book_index.faiss",
]
meta_candidates = [
    RAG_DIR / "book_index_meta.json",
    BASE_DIR / "book_index_meta.json",
]

INDEX_PATH = _resolve_existing_path(index_candidates, index_candidates[0])
META_PATH = _resolve_existing_path(meta_candidates, meta_candidates[0])

embedding_manager = EmbeddingModelManager()

BOOK_INDEX = BookContentIndex(
    index_path=INDEX_PATH,
    metadata_path=META_PATH,
    model_manager=embedding_manager,
)

try:
    BOOK_INDEX.load()
    print("✅ BookContentIndex loaded successfully")
except Exception as e:
    print(
        f"⚠️ Failed to load BookContentIndex: {e}\n"
        f"   attempted index path: {INDEX_PATH}\n"
        f"   attempted metadata path: {META_PATH}"
    )
    BOOK_INDEX = None

MODELS_DIR = BASE_DIR / "models"
MODEL_PATH = MODELS_DIR / "tinyllama1.1b.gguf"

TUTOR_LLM = None

try:
    if MODEL_PATH.exists():
        TUTOR_LLM = TutorLLMService(model_path=MODEL_PATH)
        print("✅ Tutor LLM loaded successfully")
    else:
        print("⚠️ Phi-3 model file not found")
except Exception as e:
    print(f"⚠️ Failed to load Tutor LLM: {e}")
    TUTOR_LLM = None

# -------------------------------------------------
# Startup validation
# -------------------------------------------------

@app.on_event("startup")
def validate_ncert_index():
    if not NCERT_INDEX.exists():
        raise RuntimeError(f"NCERT index file not found: {NCERT_INDEX}")
    try:
        PIPELINE.ncert_index.load_from_path(NCERT_INDEX)
        PIPELINE._ncert_loaded = True
        logger.info("NCERT index loaded successfully")
    except Exception as exc:
        logger.exception("Failed to load NCERT index")
        raise RuntimeError("NCERT index validation failed") from exc

# -------------------------------------------------
# Helpers (chat persistence)
# -------------------------------------------------

def load_chat(chat_id: str) -> dict | None:
    path = CHATS_DIR / f"{chat_id}.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))

def save_chat(chat: dict):
    path = CHATS_DIR / f"{chat['id']}.json"
    path.write_text(json.dumps(chat, indent=2, ensure_ascii=False), encoding="utf-8")


class ChatMessage(BaseModel):
    role: str
    content: str
    timestamp: str
    file_path: str | None = None


class ChatMessageRequest(BaseModel):
    chat_id: str
    message: ChatMessage


class TutorChatRequest(BaseModel):
    topic: str
    book_name: str
    class_level: Optional[int] = None
    page_range: List[int]
    wrong_answer_text: str
    chat_history: List[dict]

# -------------------------------------------------
# API endpoints
# -------------------------------------------------

@app.post("/chat/create")
def create_chat(
    student_name: str = Form(...),
    class_level: int | None = Form(None),
    subject: str = Form("english"),
):
    chat_id = datetime.now().strftime("%Y%m%d_%H%M%S")

    chat = {
        "id": chat_id,
        "student_name": student_name,
        "class_level": class_level,
        "created_at": datetime.now().isoformat(),
        "subject": subject,
        "messages": [],
        "analyses": [],
    }

    save_chat(chat)
    return chat


@app.post("/analyze")
async def analyze(
    chat_id: str = Form(...),
    file: UploadFile = File(...),
    class_level: int | None = Form(None),
    subject: str = Form("english"),
):
    chat = load_chat(chat_id)
    if not chat:
        return {"error": "Invalid chat_id"}

    temp_name = f"{chat_id}_{uuid.uuid4()}_{file.filename}"
    pdf_path = UPLOADS_DIR / temp_name

    with open(pdf_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        results = analyze_subject(
            subject=subject,
            pdf_path=pdf_path,
            class_level=class_level or chat.get("class_level"),
            output_dir=str(RESULTS_DIR),
        )
    except Exception as e:
        return {"error": str(e)}

    chat["analyses"].append({
        "timestamp": datetime.now().isoformat(),
        "file_name": file.filename,
        "results": results,
    })

    save_chat(chat)
    return results


@app.post("/api/tutor-chat")
def tutor_chat(payload: TutorChatRequest):

    if BOOK_INDEX is None:
        return {"error": "Book index not loaded"}

    if TUTOR_LLM is None:
        return {"error": "Tutor model not loaded"}

    if not payload.page_range or len(payload.page_range) != 2:
        return {"error": "Invalid page range"}

    start_page, end_page = payload.page_range

    retrieved = BOOK_INDEX.retrieve(
        query_text= f"{payload.topic}. Student mistake: {payload.wrong_answer_text}",
        book_name=payload.book_name,
        class_level=payload.class_level,
        page_range=(start_page, end_page),
        top_k=3,
        similarity_floor=0.30,
        strict_mode=True,
        debug=True,
    )

    if not retrieved:
        return {
            "response": "I do not have enough information in the selected pages."
        }

    context_chunks = [r["text"] for r in retrieved]

    def token_stream():
        for token in TUTOR_LLM.generate_stream(
            context_chunks=context_chunks,
            wrong_answer=payload.wrong_answer_text,
            chat_history=payload.chat_history,
        ):
            yield token

    return StreamingResponse(token_stream(), media_type="text/plain")


@app.get("/")
def root():
    return {"status": "ok", "service": "Test Paper Analyzer API"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/chat/list")
def list_chats():
    chats = []
    for f in CHATS_DIR.glob("*.json"):
        chats.append(json.loads(f.read_text(encoding="utf-8")))
    return chats


@app.post("/chat/message")
def add_message(payload: ChatMessageRequest):
    chat = load_chat(payload.chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Invalid chat_id")

    chat.setdefault("messages", []).append(payload.message.model_dump())
    save_chat(chat)
    return chat


@app.delete("/chat/{chat_id}")
def delete_chat(chat_id: str):
    path = CHATS_DIR / f"{chat_id}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Chat not found")

    path.unlink()

    for file_path in UPLOADS_DIR.glob(f"{chat_id}_*"):
        try:
            file_path.unlink()
        except Exception:
            logger.warning("Failed to delete upload: %s", file_path)

    for file_path in RESULTS_DIR.glob(f"{chat_id}_*"):
        try:
            file_path.unlink()
        except Exception:
            logger.warning("Failed to delete result: %s", file_path)

    return {"status": "deleted", "chat_id": chat_id}
