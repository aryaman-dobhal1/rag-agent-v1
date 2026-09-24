# RAG Agent V1

A React/Vite knowledge assistant backed by FastAPI, PostgreSQL + pgvector, document ingestion, and Groq chat completions.

## Project layout

- `frontend/` — Vite single-page application.
- `api.py` — FastAPI routes, document extraction, RAG chat, and background ingestion.
- `database.py` — SQLAlchemy models and startup schema setup.
- `main.py` — local Uvicorn entry point.

## Local development

The backend expects PostgreSQL with the `vector` extension, and OCR requires the system `tesseract` binary.

```bash
cd frontend
npm ci
VITE_API_BASE_URL=http://127.0.0.1:8000 npm run dev
```

In another terminal, install the Python dependencies and run:

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/chatbot
export GROQ_API_KEY=your_key
export FRONTEND_ORIGINS=http://localhost:5173
python main.py
```

The API exposes `/health`; the frontend uses the same origin path for all requests through `VITE_API_BASE_URL`.

## Deploy the frontend to Vercel

This repository includes `vercel.json`. Import the repository into Vercel with the repository root as the project root; Vercel will build `frontend/` and serve `frontend/dist`.

Set this Vercel environment variable:

```text
VITE_API_BASE_URL=https://your-backend.example.com
```

The backend must be deployed separately (Render, Railway, Fly.io, or a VM/container service) and must be reachable over HTTPS. It also needs `DATABASE_URL`, `GROQ_API_KEY`, and `FRONTEND_ORIGINS` set to the Vercel URL. Add the Vercel URL to `FRONTEND_ORIGINS` without a trailing slash:

```text
FRONTEND_ORIGINS=https://your-project.vercel.app
```

## Backend deployment notes

- Use a PostgreSQL provider that supports the `pgvector` extension; the app runs `CREATE EXTENSION IF NOT EXISTS vector` and creates/migrates its tables at startup.
- Mount persistent storage for `DOCUMENT_ROOT` and `STORAGE_ROOT`. Uploads and document versions are currently stored on the filesystem, so an ephemeral server filesystem will lose them on restart.
- The backend loads `sentence-transformers/all-MiniLM-L6-v2` at startup and needs a Python service with enough memory and startup time. Tesseract must be installed for OCR.
- Keep the Groq API key and database credentials only in backend environment variables; do not put them in Vite variables or commit them.
