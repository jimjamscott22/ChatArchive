# Development Setup

## Backend
1. Create a virtual environment and install dependencies:
   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```
2. Initialize the database:
   ```bash
   python -m app.database.init_db
   ```
3. Run the API:
   ```bash
   python -m app.main
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
