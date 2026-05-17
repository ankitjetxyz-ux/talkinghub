# ARCHIVE — Mysterious Chat

Frontend + optional legacy Express backend. **Production-oriented data plane: Supabase** (Auth, Postgres, Realtime, Storage).

## Architecture

| Layer | Stack |
|-------|--------|
| Frontend | TanStack Start, React 19, Tailwind, Vite |
| Data | Supabase (Postgres + RLS RPCs + Realtime + Storage) |
| Legacy backend (optional) | Express 5, SQLite, JWT, WebSocket |

Run Supabase DDL and configure env vars: **[`SUPABASE.md`](SUPABASE.md)**.

## Quick start (Supabase)

1. Follow **[`SUPABASE.md`](SUPABASE.md)** — run **`supabase/archive_schema.sql`** and copy **`frontend/.env.example`** → **`frontend/.env.local`** with your project URL + anon key.

2. Frontend:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`, **Sign in with Google**, then start a DM by handle.

*(Optional legacy stack: run **`backend`** per `backend/.env.example` + set **`VITE_API_URL`** only if you need old `/uploads/...` paths.)*

### Two-user limit (legacy backend only)

In `backend/.env` set `MAX_USERS=2` to cap registrations.

## Deploy

- **SPA** (e.g. Vercel): project root **`frontend`** — build command `npm run build`; set **`VITE_SUPABASE_URL`** and **`VITE_SUPABASE_PUBLISHABLE_KEY`** in the dashboard.
- **Legacy API**: Railway — **`backend/RAILWAY.md`** (volume **`/srv/data`**).

Generate PWA icons (`public/icon-192.png`, `icon-512.png`) before production; manifest is already wired.
