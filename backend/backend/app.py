# backend/app.py
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from datetime import datetime
from pydantic import BaseModel
import shutil
import uuid
import json
import logging

from pipeline import TestPaperAnalysisPipeline

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

# -------------------------------------------------
# API endpoints
# -------------------------------------------------

@app.post("/chat/create")
def create_chat(student_name: str = Form(...), class_level: int | None = Form(None)):
    chat_id = datetime.now().strftime("%Y%m%d_%H%M%S")

    chat = {
        "id": chat_id,
        "student_name": student_name,
        "class_level": class_level,
        "created_at": datetime.now().isoformat(),
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
):
    chat = load_chat(chat_id)
    if not chat:
        return {"error": "Invalid chat_id"}

    temp_name = f"{chat_id}_{uuid.uuid4()}_{file.filename}"
    pdf_path = UPLOADS_DIR / temp_name

    with open(pdf_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        results = PIPELINE.analyze(
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
