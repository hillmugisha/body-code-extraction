# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Next.js (frontend + API)
npm run dev          # start dev server at localhost:3000
npm run build        # production build
npm run lint         # ESLint check

# Python pipeline (run from repo root)
python main.py run <path/to/file.pdf>                        # process single PDF
python main.py run <path/to/file.pdf> --job-id <uuid> --uploaded-by user@example.com
python main.py status                                        # list all jobs
python main.py accuracy --job-id <uuid>                      # accuracy report

# Python pipeline HTTP server (production mode)
uvicorn server:app --reload --port 8000                      # dev server
```

## Architecture

This is a **hybrid Next.js + Python** app with two separately deployed services:

### Next.js app → Vercel
Handles auth, UI, and API routing. All pages use the App Router (`app/`). Auth is cookie + localStorage based (no Supabase Auth) — `context/AuthContext.tsx` manages session state; `middleware.ts` guards all non-public routes by checking the `auth_email` cookie.

**Admin vs user** — `hill.mugisha@pritchards.com` is hardcoded as admin in `app/api/jobs/route.ts` and sees all jobs. All other users only see jobs where `uploaded_by` matches their email.

**User access control** — Login checks the `users` table for `access_granted = true`. Users must be manually inserted into this table with lowercase emails to gain access.

### Python pipeline → Railway
`server.py` is a FastAPI app that wraps the pipeline. Next.js proxies uploads and file downloads to it via `PIPELINE_SERVICE_URL`.

**Key pipeline files:**
- `pipeline/extractor.py` — renders PDF pages to images, calls Claude Vision (`claude-sonnet-4-6`) to extract a JSON array of `{code, description, msrp, confidence}` rows, validates extracted codes against the PDF text layer to filter hallucinations
- `pipeline/watcher.py` — orchestrates a single PDF: insert job → extract → write Excel → update job status → save accuracy snapshot
- `pipeline/excel_writer.py` — populates `templates/Ryder Quote Template.xlsx` with extracted items; writes to `output/`
- `pipeline/db.py` — all Supabase CRUD; uses `service_role` key directly
- `config.py` — all paths, Claude model, Excel layout constants (column numbers, row offsets)

**Section detection** — `find_section_pages()` in `extractor.py` locates the "As Configured Vehicle" section by scanning page text, then includes continuation pages by looking for `(cont'd)` in the top 25% or `"as configured vehicle"` anywhere on the page.

### Supabase database
Four tables (see `supabase_setup.sql`): `jobs`, `extraction_items`, `corrections`, `accuracy_snapshots`. RLS is **disabled** — access is controlled entirely by the service role key. The `increment_login_count` RPC must exist in Supabase for login to work cleanly (failure is silent, login still succeeds).

### File flow
1. User uploads PDF → Vercel `/api/extract` → forwarded to Railway `POST /extract`
2. Railway saves PDF to `input/`, runs pipeline in a background task, writes Excel to `output/`
3. Job status polled via `/api/jobs/[id]` (queries Supabase directly from Vercel)
4. Downloads/PDF views proxy through Vercel → Railway `/files/output/{id}` and `/files/pdf/{id}`

## Environment variables

| Variable | Used by |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Next.js client (browser) |
| `NEXT_PUBLIC_SUPABASE_KEY` | Next.js client (browser) — anon key |
| `SUPABASE_URL` | Next.js server API routes |
| `SUPABASE_KEY` | Next.js server API routes — service role key |
| `PIPELINE_SERVICE_URL` | Next.js → points to Railway service URL |
| `ANTHROPIC_API_KEY` | Python pipeline (Railway) |

The Python service reads `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_KEY` from its own environment (Railway variables).
