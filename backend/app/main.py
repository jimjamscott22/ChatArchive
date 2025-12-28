from __future__ import annotations

import json
from typing import Any

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import uvicorn

from app.database import get_db
from app.importers.chatgpt import parse_chatgpt_export
from app.models import Base, Conversation
from app.schemas import ConversationResponse

app = FastAPI(title="ChatArchive API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/import/chatgpt", response_model=list[ConversationResponse])
async def import_chatgpt(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> list[ConversationResponse]:
    if not file.filename.endswith(".json"):
        raise HTTPException(status_code=400, detail="Expected a .json export")

    raw = await file.read()
    try:
        payload: Any = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON") from exc

    try:
        parsed = parse_chatgpt_export(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    records: list[Conversation] = []
    for item in parsed:
        convo = Conversation(**item)
        db.add(convo)
        records.append(convo)

    db.commit()
    for convo in records:
        db.refresh(convo)

    return records


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
