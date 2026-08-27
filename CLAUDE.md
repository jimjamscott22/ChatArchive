# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Setup

```bash
# Backend deps — pyproject.toml + uv.lock (there is NO requirements.txt)
cd backend && uv sync

# Frontend deps
cd frontend && npm install
```

All backend commands must run from `backend/` — the `app` package is only
importable from there (`[tool.hatch.build.targets.wheel] packages = ["app"]`).

### Development

```bash
# Start backend (from repo root)
cd backend && uv run python -m app.main

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
# Backend (168 tests, ~2s)
cd backend
python -m pytest tests/ -v                              # All tests
python -m pytest tests/test_chatgpt_parser.py -v       # Single test file
python -m pytest tests/test_claude_parser.py::TestName  # Single test
python -m pytest tests/ --cov=app/importers            # needs: uv add --dev pytest-cov
python verify_parsers.py                               # End-to-end parser verification

# Frontend (vitest + Testing Library + jsdom)
cd frontend
npm test                                                # vitest run
```

**Backend tests need no database.** No test imports `app.main` or
`app.database`, so the suite runs offline with no Supabase connection. Keep it
that way — importing either module in a test forces a live DB on the whole suite.

Frontend tests mock `fetch` wholesale (see `installFetchMock` in `App.test.tsx`);
an unmatched URL throws, so new API calls need a matching branch there. Tests
pre-seed `localStorage.chatarchive_api_token` to skip `AuthGate` (`GET /stats`
is not mocked).

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
- **`database.py`** — SQLAlchemy engine/session setup (PostgreSQL only). Builds the URL from `DATABASE_URL`, else derives it from `SUPABASE_URL` + `SUPABASE_DB_PASSWORD`. Exports `engine`, `SessionLocal`, `DATABASE_MODE`, and the `get_db()` FastAPI dependency. **Connects at import time** — see Gotchas.
- **`auth.py`** — Bearer-token gate. Raises at import if `APP_API_TOKEN` is unset. `PROTECTED_PREFIXES` lists which routes require auth (`/health` and the bundled frontend do not).
- **`models.py`** — SQLAlchemy ORM: `Conversation`, `Message`, `Tag`, `ConversationTag`, `ImportHistory`, `ImportSettings`, `Project`.
- **`schemas.py`** — Pydantic v2 schemas for request/response validation.
- **`tagger.py`** — Keyword-based auto-tagger with 9 categories: `coding`, `education`, `writing`, `business`, `data-science`, `tech-support`, `creative`, `productivity`, `personal`.
- **`storage.py`** — Supabase Storage integration for raw export file uploads.
- **`supabase_client.py`** — Lazy singleton Supabase client (`get_supabase_client()`), plus `is_supabase_configured()` / `get_connection_info()` / `get_dashboard_url()` used by status endpoints.
- **`query_filters.py`** — `apply_conversation_filters()`, the shared filter builder used by **both** the list and search endpoints (source, tags, project, date range). Change filtering logic here, not in `main.py`.
- **`importers/`** — One file per LLM source (`chatgpt.py`, `claude.py`, `copilot.py`, `gemini.py`). See "Adding a New Importer" below for the actual contract.
- **`preprocessing/`** — Standalone clean → classify → deduplicate → extract → count-tokens pipeline (`pipeline.py` orchestrates `cleaner`/`classifier`/`deduplication`/`extractor`/`parser`/`token_counter`).
  ⚠️ **Not wired into the import flow.** `main.py` does not import it; it is tested but currently unused. Don't assume imported conversations have been preprocessed.

### Frontend (`frontend/src/`)

- **`App.tsx`** — Single large component (~3750 lines) containing almost all UI: list, viewer, import, tags, projects, search, analytics, export, theme picker.
- **`api.ts`** — Hardcoded `API_URL = "http://localhost:8000"` plus `apiFetch()` (attaches the Bearer token from `localStorage`).
- **`main.tsx`** — React 18 mount point.
- **`components/`** — `ModalShell.tsx` (shared dialog) and `AuthGate.tsx` (token prompt; verifies with `GET /stats`).
- **`styles.css`** — **Plain hand-written CSS. There is no Tailwind** (no `tailwind` dependency, no `tailwind.config.*`, no PostCSS). Tokens live on `:root` and `[data-theme="..."]` (11 themes). Reuse those variables (`--bg-primary`, `--text-primary`, `--accent`, `--surface-panel`, `--shadow-md`, …); utility classes like `flex gap-4` will silently do nothing.

Key deps: `react-markdown` + `rehype-highlight` (message rendering), `react-window` (list virtualization), `lucide-react` (icons).

The frontend talks only to FastAPI. No env var, no Vite proxy, no browser Supabase client.

### Database Schema

Key relationships:

- `conversations` → many `messages` (ordered by `order_index`)
- `conversations` → many `tags` (via `conversation_tags` junction)
- `conversations` → optional `project_id` FK to `projects`
- `conversations` → optional `import_history_id` FK to `import_history`

Full-text search uses a PostgreSQL `tsvector` column with a GIN index, with an ILIKE fallback.

### Adding a New Importer

There is **no shared dispatch table** — each source gets its own endpoint.

1. Create `backend/app/importers/<source>.py` exposing:

   ```python
   def parse_<source>_export(payload: Any) -> list[dict[str, Any]]: ...
   ```

   Note the naming convention (`parse_chatgpt_export`, `parse_claude_export`, …)
   and that it returns **plain dicts**, not Pydantic models.
2. Import it at the top of `backend/app/main.py` and add a dedicated
   `@app.post("/import/<source>")` endpoint, mirroring the existing four. Each
   one handles its own `ImportHistory` row with `source_type="<source>"` and its
   own raw-file upload — copy `/import/chatgpt` as the template.
3. Add tests in `backend/tests/test_<source>_parser.py` (parser-only, no DB).

### Environment Variables

`backend/.env` (gitignored; there is no `.env.example` to copy):

```ini
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key>   # server-side writes + Storage
SUPABASE_ANON_KEY=<anon key>
SUPABASE_DB_PASSWORD=<db password>
SUPABASE_BUCKET_NAME=chatarchive-exports        # optional, this is the default
DATABASE_URL=postgresql://postgres:<password>@<pooler-host>:5432/postgres
APP_API_TOKEN=<generate with: python -c "import secrets; print(secrets.token_hex(32))">
CHATARCHIVE_HOST=127.0.0.1                      # optional, default; set to 0.0.0.0 for LAN access
```

There is **no `SUPABASE_KEY`** variable — that name is read nowhere in the codebase.

`DATABASE_URL` is *preferred but not strictly required*: `database.py` falls back
to deriving the URL from `SUPABASE_URL` + `SUPABASE_DB_PASSWORD`. Prefer setting
it explicitly to the Supabase **Session/Transaction Pooler** URI (IPv4 support).
If `SUPABASE_DB_PASSWORD` is unset, the service role key is used as the password
with a logged warning.

`APP_API_TOKEN` is **required** — `app.auth` raises at import time if it's unset,
which means `app.main` (and therefore the whole backend) refuses to start without
it. Every route except `/health` and the served frontend requires this token as a
`Bearer` credential (see `app/auth.py`'s `PROTECTED_PREFIXES`); the frontend
prompts for it once and stores it in the browser's `localStorage`.

### PyInstaller / Production Build

`chatarchive.spec` bundles the FastAPI backend + embedded `frontend/dist/` into a single Windows executable. Key hidden imports include uvicorn, anyio, tiktoken, and psycopg2. Heavy libraries (numpy, matplotlib, pandas) are explicitly excluded.

### Supabase Free-Tier Keepalive

`backend/keepalive_supabase.py` is invoked every 12 hours by `.github/workflows/supabase-keepalive.yml` to prevent the free-tier project from pausing. Requires `SUPABASE_URL` and `SUPABASE_ANON_KEY` GitHub secrets.

## Gotchas

- **`database.py` connects at import time.** `engine, DATABASE_MODE = _init_engine()`
  runs at module scope and raises `RuntimeError` if Supabase is unreachable or
  unconfigured. Importing `app.main` (or anything importing `app.database`) therefore
  requires a live DB. This is the most common reason a session fails to start.
- **`app.auth` also connects at import time**, in the sense that it raises
  `RuntimeError` if `APP_API_TOKEN` is unset — same fail-fast pattern, same
  effect on anything importing `app.main`.
- **Tests deliberately avoid that** by never importing `app.main`/`app.database`.
  Preserve this — it keeps the suite offline and ~2s.
- **No SQLite fallback, by design.** `_make_engine()` raises on any non-`postgresql`
  mode. A stale `backend/chatarchive.db` file exists but is a leftover artifact and
  is gitignored (`*.db`) — it is not used.
- **`frontend/src/api.ts` has a hardcoded `API_URL`** (`http://localhost:8000`).
  Works in the PyInstaller build only because the bundled backend also listens
  on 8000. All API calls go through `apiFetch()` there, which attaches the
  stored token — don't call raw `fetch()` against `API_URL` from `App.tsx`.
- **No Tailwind** — see the frontend section. Use the `styles.css` CSS variables.
- **Root-level `.py` scripts in `backend/`** (`migrate_*.py`, `init_db.py`,
  `check_schema.py`) are one-off migration/inspection utilities, not part of the app.
  Note `init_db.py` exists in three places (`backend/`, `app/database/`, `app/db_scripts/`).

## Further Documentation

`docs/` holds deeper references — consult before large changes:
`API.md` (endpoint reference), `TESTING.md`, `DEVELOPMENT.md`, `IMPORT_GUIDE.md`,
`TAGGING.md`, `docs/styles/APPLICATION_STYLE_HANDOFF.md` (design tokens).
