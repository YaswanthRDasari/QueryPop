# DBCoPilot (MVP)

An AI-assisted database GUI tool that lets you ask questions about your data in natural language.

## Features
- **Natural Language to SQL**: Ask questions in English, get SQL.
- **Safe Execution**: Read-only queries only. Dangerous commands (DROP, DELETE) are blocked.
- **Explainability**: AI explains what the query does before you run it.
- **History**: Keep track of your past questions and results.
- **Supports**: MySQL and PostgreSQL.

## Prerequisites
- Docker & Docker Compose (for easy deployment)
- OpenAI API Key OR a local running Ollama instance (e.g., Llama 3)

## Quick Start (Docker)

1. **Clone and Setup Env**
   ```bash
   cp backend/.env.example .env
   # Edit .env with your OPENAI_API_KEY
   ```

2. **Run with Docker Compose**
   ```bash
   docker-compose up --build
   ```

3. **Access the App**
   Open [http://localhost:5000](http://localhost:5000)

## Local Development

### Backend
```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate
# Linux/Mac: source venv/bin/activate
pip install -r requirements.txt
python app.py
```
Backend runs on `http://localhost:5000`.

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend runs on `http://localhost:5173`.
Note: Update `frontend/src/services/api.ts` if running separately (CORS is enabled).

## Configuration
- `LLM_PROVIDER`: `openai` (default) or `ollama`.
- `OLLAMA_BASE_URL`: URL of your Ollama instance (default: `http://localhost:11434`).
- `APP_DB_PATH`: Path to local SQLite DB for history/cache.

## Tech Stack
- Frontend: React 18, TypeScript, TailwindCSS, Vite
- Backend: Python 3.11, Flask, SQLAlchemy
- Database: SQLite (internal), MySQL/Postgres (target)

## License
MIT
