# Deploy ARCHIVE backend on Railway

> **Optional — legacy stack.** The SPA in this repo targets **Supabase** for Auth, Postgres, Realtime, and Storage (see **[`SUPABASE.md`](../SUPABASE.md)**). Use Railway only if you still run the SQLite + JWT + WebSocket server.

Express + SQLite + WebSockets + uploads. Persist data with a **volume** mounted at **`/srv/data`**.

## 1. Create the service

1. Open [Railway](https://railway.app) and sign in with GitHub.
2. **New project** → **Deploy from GitHub repo** → select **`talkinghub`** (your monorepo).
3. When Railway creates the deployment, open the **service settings** → set **Root Directory** to **`backend`** (critical for a monorepo).
4. Confirm Railway picks up **`railway.toml`** here (build: `npm ci && npm run build`, start: `npm run start`).

Redeploy if you changed Root Directory after the first deploy.

## 2. Add a persistent volume

Without a volume, SQLite and uploads are lost when the container restarts.

1. In your **backend service** → **Volumes** (or equivalent in the Railway UI).
2. **Create volume**, **mount path**: **`/srv/data`** (same path referenced by env vars below).
3. Redeploy if prompted so the volume is attached.

## 3. Environment variables

Open the **Variables** tab for this service:

| Variable | Example / notes |
|---------|----------------|
| **`JWT_SECRET`** | Long random string (e.g. `openssl rand -base64 32`). |
| **`CLIENT_ORIGIN`** | Browser origins allowed by CORS, comma-separated — include your **Vercel URL(s)** (`https://your-app.vercel.app`; add preview URLs if you use them). |
| **`DATABASE_PATH`** | **`/srv/data/archive.db`** (SQLite file on the volume). |
| **`UPLOAD_DIR`** | **`/srv/data/uploads`** (media files on the same volume). |
| **`NODE_ENV`** | Optional: **`production`** (Railway usually sets sensible defaults anyway). |

**Do not commit real secrets.** Set them only in Railway.

Railway injects **`PORT`** automatically; the app listens on **`process.env.PORT`**.

Optional: **`MAX_USERS`** (`0` = unlimited, matching local `.env.example`).

## 4. Public URL

1. **Networking / Settings** for the service → **Generate Domain** (HTTPS).
2. Note the URL, e.g. `https://your-service-production.up.railway.app`.

**Checks**

- HTTPS: open `https://YOUR-RAILWAY-URL/health` → `{ "ok": true, ... }`.
- Backend WebSocket URL is **`wss://YOUR-RAILWAY-URL`** (same host), path **`/ws?token=...`**.

## 5. Wire the Vercel frontend

In your **frontend** project on Vercel (Root Directory **`frontend`**):

| Variable | Value |
|----------|--------|
| **`ARCHIVE_BACKEND_URL`** | `https://YOUR-RAILWAY-URL` (HTTPS origin only, no path) |
| **`VITE_WS_URL`** | **`wss://YOUR-RAILWAY-URL`** (live chat / realtime) |

Save and **Redeploy** the frontend so env vars apply.

### CORS recap

Browsers hit your **Vercel** origin first; **`fetch('/api/...')`** is same-origin via the Nitro proxy. The Railway server still validates **`CLIENT_ORIGIN`** when the proxy calls it and for **direct WebSocket** connections from `wss://…`.

Ensure **`CLIENT_ORIGIN`** lists every **`https://…vercel.app`** origin you actually use.

## Troubleshooting

- **502 / misconfigured on Vercel**: confirm **`ARCHIVE_BACKEND_URL`** (no typo, uses `https`).
- **Build fails on `better-sqlite3`**: open a Railway build log; if native compile fails, in **Variables** enable any “Use Nixpacks” workaround or install build tools per [Railway build docs](https://docs.railway.com/guides/build-configuration); often Railpack’s Node images work out of the box.
- **Empty DB after deploy**: volume not mounted or **`DATABASE_PATH`**/`**UPLOAD_DIR**` outside **`/srv/data`**.
