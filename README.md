# RAG Agent V1

Northstar Medical Systems is a React/Vite knowledge assistant backed by FastAPI, Supabase PostgreSQL + pgvector, private Supabase Storage, document ingestion, and Groq chat completions.

## Project layout

- `frontend/` — Vite single-page application.
- `api.py` — FastAPI routes, Supabase Storage helpers, document extraction, RAG chat, and background ingestion.
- `database.py` — SQLAlchemy models and startup schema setup.
- `main.py` — local Uvicorn entry point.
- `Dockerfile` — production API image with Tesseract OCR installed.

## Recommended free deployment system

1. **Supabase Free** — PostgreSQL, pgvector, and private Storage.
2. **Render Free** — Dockerized FastAPI backend. It may sleep and can take time to wake.
3. **Vercel Hobby** — React/Vite frontend.
4. **Groq free tier** — chat completions; you need a Groq API key and are subject to its limits.

This is free to start, but no free-tier setup guarantees permanent uptime. Render Free can sleep, Groq has rate limits, and Supabase Free projects can pause after inactivity. Uploaded documents are stored in Supabase Storage, so backend restarts do not lose them.

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Open **Project Settings → Database** and copy the PostgreSQL connection string.
3. Use the **session pooler** connection string. Startup creates the `vector` extension and tables:

   ```text
   postgresql://postgres.PROJECT_REF:PASSWORD@POOLER_HOST:5432/postgres
   ```

4. Open **Storage → New bucket**, create a private bucket named `documents`, and do not make it public.
5. Copy the project URL and service-role key from **Project Settings → API**. The service-role key is server-only; never put it in Vercel or commit it.

The app runs `CREATE EXTENSION IF NOT EXISTS vector` and creates the project tables on startup.

## Run locally without installing PostgreSQL

Install Python dependencies:

```bash
cd "/Users/ishaanrai/Desktop/untitled folder/rag-agent-v1"
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `.env` with your Supabase values, then start the backend:

```bash
. .venv/bin/activate
set -a
source .env
set +a
python3 main.py
```

Check it with `curl http://127.0.0.1:8000/health`. In a second terminal:

```bash
cd "/Users/ishaanrai/Desktop/untitled folder/rag-agent-v1/frontend"
npm ci
npm run dev
```

Open `http://127.0.0.1:5173`. You do not need Homebrew for Docker deployment because the `Dockerfile` installs Tesseract inside the image. For native local OCR, install Tesseract separately if needed.

## Deploy the API to Render Free

The repository includes `render.yaml` and `Dockerfile`.

1. Push the deployment branch to GitHub.
2. In Render choose **New → Blueprint** and select this repository.
3. Select the branch containing `render.yaml`.
4. Add the secrets marked `sync: false`:

   ```text
   DATABASE_URL
   GROQ_API_KEY
   FRONTEND_ORIGINS
   SUPABASE_URL
   SUPABASE_SERVICE_ROLE_KEY
   ```

5. Deploy and check `https://YOUR-RENDER-SERVICE.onrender.com/health`.
6. After Vercel is deployed, set Render’s `FRONTEND_ORIGINS` to the Vercel URL and save/restart the service.

Render Free may sleep; the first request can take a minute or longer. The first start also downloads the sentence-transformer model.

## Deploy the frontend to Vercel

1. Import the repository at [vercel.com/new](https://vercel.com/new).
2. Select the same deployment branch and keep the repository root as the project root.
3. Vercel uses `vercel.json` to build `frontend/` and publish `frontend/dist`.
4. Add:

   ```text
   VITE_API_BASE_URL=https://YOUR-RENDER-SERVICE.onrender.com
   ```

5. Deploy Vercel, copy its URL, and add that URL to Render’s `FRONTEND_ORIGINS`.

Do not put the Supabase service-role key or Groq key in Vercel. The only required frontend variable is `VITE_API_BASE_URL`.

## Free-tier limitations

- Render Free can sleep and has limited monthly runtime.
- Supabase Free can pause after inactivity and has quotas.
- Groq Free has request and token limits.
- Sentence-transformer loading and OCR can make cold starts slow.
- Ingestion uses FastAPI background tasks. If Render restarts during ingestion, retry the interrupted job from its saved checkpoint; this is not a durable job queue.

For reliable production uptime, use a paid Render plan or another always-on Python host. The Supabase database/storage and Vercel frontend can remain unchanged.
