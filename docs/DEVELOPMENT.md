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

## One-command local run

From the repo root:

```bash
./run-chatarchive.sh
```

This script:
- runs `uv sync` in `backend/`
- runs `npm install` in `frontend/` if needed
- starts both dev servers together
