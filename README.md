# ARCHIVE — Mysterious Chat

Two-folder monorepo: **frontend** ([neon-murmur](https://github.com/ankitjetxyz-ux/neon-murmur)) + **backend** (Express API, no Firebase/Supabase required).

## Architecture

| Layer | Stack |
|-------|--------|
| Frontend | TanStack Start, React 19, Tailwind, Vite |
| Backend | Express 5, SQLite, JWT auth, WebSocket realtime |
| Messages | Random prefix/suffix applied on the server |
| Notifications | Browser notifications with mysterious templates |

## Quick start

### 1. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

API: `http://localhost:5000` · WebSocket: `ws://localhost:5000/ws?token=...`

### 2. Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:5173`, create two accounts, start a DM by handle.

### Two-user limit (optional)

In `backend/.env` set `MAX_USERS=2` to cap registrations.

## API overview

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Sign up |
| POST | `/api/auth/login` | Sign in |
| GET | `/api/auth/me` | Current user + profile |
| GET | `/api/conversations` | Conversation list |
| POST | `/api/conversations/dm` | Start DM by handle |
| GET | `/api/conversations/:id/messages` | Message history |
| POST | `/api/messages` | Send message (formatted server-side) |
| POST | `/api/media/upload` | Upload image/video |

Realtime events over WebSocket: `message`, `messages`, `conversation_members`.

## Deploy

- **Frontend**: Vercel / Cloudflare — set `VITE_API_URL` and `VITE_WS_URL` to your backend.
- **Backend**: Railway, Render, Fly.io — set `CLIENT_ORIGIN`, `JWT_SECRET`, `PUBLIC_URL`.

Generate PWA icons (`public/icon-192.png`, `icon-512.png`) before production; manifest is already wired.
