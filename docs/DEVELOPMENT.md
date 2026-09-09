# Development Setup

## Backend
1. Install dependencies with `uv`:
   ```bash
   cd backend
   uv sync
   ```
2. Initialize the database:
   ```bash
   uv run python init_db.py
   ```
3. Run the API:
   ```bash
   uv run python -m app.main
   ```

## Frontend
1. Install dependencies:
   ```bash
   cd frontend
   npm install
   ```
2. Start the dev server:
   ```bash
   npm run dev
   ```

The frontend expects the API at `http://localhost:8000`.

## Export bundle resources

Apply the additive PostgreSQL migration before deploying bundle import:

```bash
cd backend
uv run python migrate_add_bundle_resources.py
```

The migration is idempotent. It adds provider project provenance, import
manifest counters, the `resources` table, and resource search indexes.

Bundled binary resources use the configured `SUPABASE_BUCKET_NAME`. The bucket
must be private; resource content is downloaded by the backend and served
through bearer-token-protected API endpoints. Do not use public object URLs for
imported resources.

## One-command local run

From the repo root:

```bash
./run-chatarchive.sh
```

This script:
- runs `uv sync` in `backend/`
- runs `npm install` in `frontend/` if needed
- starts both dev servers together
