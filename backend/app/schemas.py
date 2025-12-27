from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class ConversationCreate(BaseModel):
    source: str
    title: str | None = None
    created_at: datetime | None = None
    raw_json: str


class ConversationResponse(BaseModel):
    id: int
    source: str
    title: str | None = None
    created_at: datetime | None = None

    class Config:
        from_attributes = True
