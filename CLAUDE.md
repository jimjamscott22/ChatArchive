# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development

```bash
# Start backend (from repo root)
cd backend && python -m app.main

# Start frontend (from repo root)
cd frontend && npm run dev

# Start both with a single script
./scripts/dev.sh          # Unix
.\scripts\dev.ps1         # Windows PowerShell
```

- Backend runs on `http://localhost:8000`
- Frontend dev server runs on `http://localhost:5173`

### Tests

```bash
cd backend
python -m pytest tests/ -v                              # All tests
python -m pytest tests/test_chatgpt_parser.py -v       # Single test file
python -m pytest tests/test_claude_parser.py::TestName  # Single test
python -m pytest tests/ --cov=app/importers            # With coverage
python verify_parsers.py                               # End-to-end parser verification
```

### Frontend Build

```bash
cd frontend
npm install
npm run build    # TypeScript compile + Vite bundle → frontend/dist/
```

### Production Build (Windows EXE)

```bash
.\build.ps1     # Creates dist/ChatArchive/ChatArchive.exe via PyInstaller
```

## Architecture

### Overview

Full-stack app: **React + TypeScript** frontend, **FastAPI** backend, **Supabase PostgreSQL** database (required — no SQLite fallback).

### Backend (`backend/app/`)

- **`main.py`** — FastAPI entry point. Defines all REST API routes (conversations, messages, tags, projects, search, import, export). Starts uvicorn on port 8000. In PyInstaller mode, redirects stdout/stderr to a log file.
- **`database.py`** — SQLAlchemy engine/session setup. Reads `DATABASE_URL` env var (Supabase PostgreSQL).
- **`models.py`** — SQLAlchemy ORM: `Conversation`, `Message`, `Tag`, `ConversationTag`, `ImportHistory`, `ImportSettings`, `Project`.
- **`schemas.py`** — Pydantic v2 schemas for request/response validation.
- **`tagger.py`** — Keyword-based auto-tagger with 9 categories: `coding`, `education`, `writing`, `business`, `data-science`, `tech-support`, `creative`, `productivity`, `personal`.
- **`storage.py`** — Supabase Storage integration for raw export file uploads.
- **`importers/`** — One file per LLM source (`chatgpt.py`, `claude.py`, `copilot.py`, `gemini.py`). Each exposes a `parse()` function that normalizes export JSON into the internal schema.
- **`preprocessing/pipeline.py`** — Multi-step pipeline (clean → classify → deduplicate → extract → count tokens) run on imported conversations.

### Frontend (`frontend/src/`)

- **`App.tsx`** — Single large component (~127KB) containing all UI logic: conversation list, message viewer, import modal, tag filter, project folder management, search, analytics dashboard, and export.
- **`main.tsx`** — React 18 mount point.
- **`styles.css`** — Tailwind CSS base styles.

The frontend communicates exclusively with the FastAPI backend at `http://localhost:8000`. There is no direct Supabase client call from the frontend.

### Database Schema

Key relationships:
- `conversations` → many `messages` (ordered by `order_index`)
- `conversations` → many `tags` (via `conversation_tags` junction)
- `conversations` → optional `project_id` FK to `projects`
- `conversations` → optional `import_history_id` FK to `import_history`

Full-text search uses a PostgreSQL `tsvector` column with a GIN index, with an ILIKE fallback.

### Adding a New Importer

1. Create `backend/app/importers/<source>.py` with a `parse(data: dict) -> list[ConversationCreate]` function.
2. Register it in `backend/app/main.py` in the import endpoint dispatch logic.
3. Add tests in `backend/tests/test_<source>_parser.py`.

### Environment Variables

Required in `backend/.env`:
```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_KEY=<anon key>
DATABASE_URL=postgresql+psycopg2://postgres:<password>@db.<project>.supabase.co:5432/postgres
```

### PyInstaller / Production Build

`chatarchive.spec` bundles the FastAPI backend + embedded `frontend/dist/` into a single Windows executable. Key hidden imports include uvicorn, anyio, tiktoken, and psycopg2. Heavy libraries (numpy, matplotlib, pandas) are explicitly excluded.

### Supabase Free-Tier Keepalive

`backend/keepalive_supabase.py` is invoked every 12 hours by `.github/workflows/supabase-keepalive.yml` to prevent the free-tier project from pausing. Requires `SUPABASE_URL` and `SUPABASE_ANON_KEY` GitHub secrets.
