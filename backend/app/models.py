from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, Index
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    source: Mapped[str] = mapped_column(String(50), index=True)
    source_id: Mapped[str | None] = mapped_column(String(255), index=True)  # Original ID from export
    title: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime | None] = mapped_column(DateTime, index=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime)
    message_count: Mapped[int] = mapped_column(Integer, default=0)
    raw_json: Mapped[str] = mapped_column(Text)
    
    # Relationships
    messages: Mapped[list["Message"]] = relationship(
        "Message", back_populates="conversation", cascade="all, delete-orphan"
    )


class Message(Base):
    __tablename__ = "messages"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    conversation_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("conversations.id", ondelete="CASCADE"), index=True
    )
    source_id: Mapped[str | None] = mapped_column(String(255))  # Original message ID
    role: Mapped[str] = mapped_column(String(50), index=True)  # user, assistant, system, tool
    content: Mapped[str] = mapped_column(Text)
    content_type: Mapped[str] = mapped_column(String(50), default="text")  # text, code, image, etc.
    created_at: Mapped[datetime | None] = mapped_column(DateTime)
    order_index: Mapped[int] = mapped_column(Integer)  # Position in conversation thread
    model: Mapped[str | None] = mapped_column(String(100))  # e.g., "gpt-4", "claude-3"
    
    # Relationship
    conversation: Mapped["Conversation"] = relationship("Conversation", back_populates="messages")
    
    # Index for efficient message retrieval
    __table_args__ = (
        Index("ix_messages_conversation_order", "conversation_id", "order_index"),
    )


class ImportHistory(Base):
    __tablename__ = "import_history"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    filename: Mapped[str] = mapped_column(String(255))
    source_location: Mapped[str | None] = mapped_column(String(500))  # File path or URL
    source_type: Mapped[str] = mapped_column(String(50), index=True)  # chatgpt, claude, etc.
    file_format: Mapped[str] = mapped_column(String(50))  # json, csv, xml
    status: Mapped[str] = mapped_column(String(50), index=True)  # success, failure, partial
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    imported_count: Mapped[int] = mapped_column(Integer, default=0)  # Number of conversations imported
    error_message: Mapped[str | None] = mapped_column(Text)  # Error details if failed


class ImportSettings(Base):
    __tablename__ = "import_settings"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    # File format preferences
    allowed_formats: Mapped[str] = mapped_column(String(255), default="json,csv,xml")  # Comma-separated
    default_format: Mapped[str] = mapped_column(String(50), default="json")
    
    # Import behavior
    auto_merge_duplicates: Mapped[bool] = mapped_column(Boolean, default=False)
    keep_separate: Mapped[bool] = mapped_column(Boolean, default=True)
    skip_empty_conversations: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Metadata
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
