# ARCHIVE on Supabase

The frontend uses **Supabase Auth** (Google sign-in only), **Postgres** (profiles, conversations, messages), **Realtime** (`postgres_changes`), and **Storage** buckets **`chat-media`** and **`avatars`**.

## One-time SQL setup

1. Open **Supabase Dashboard → SQL → New query**.
2. Paste the entire script [`supabase/archive_schema.sql`](./supabase/archive_schema.sql) and run it once (new projects).
3. **If you already had an older schema installed**, paste and run **`supabase/patch_rls_conversations_and_profile_setup.sql`** once (adds onboarding column + fixes RLS).  
   After the first RLS iteration, Postgres could return **HTTP 500** from the API (`EXISTS` on `conversation_members` inside policies — infinite RLS recursion). If that happens, run **`supabase/patch_rls_500_only.sql`** (RLS-only hotfix — safe to repeat).
4. If the API logs **permission denied for table conversations** while DMs otherwise work, run [**`supabase/patch_conversations_select.sql`**](./supabase/patch_conversations_select.sql) once (re-creates SELECT policy + **`GRANT SELECT`** on **`conversations`**).
5. If **POST `/rpc/archive_send_message`** returns **403**, run [**`supabase/patch_archive_send_message.sql`**](./supabase/patch_archive_send_message.sql) once (the RPC used to **`UPDATE conversations`** without permission; it now runs as **`SECURITY DEFINER`** and bumps **`last_message_at`** via a trigger).
6. If users sign in via Google but the app hangs on profile load, run [**`supabase/patch_archive_ensure_profile.sql`**](./supabase/patch_archive_ensure_profile.sql) once (`archive_ensure_profile` creates `profiles` rows when **`handle_new_user`** missed someone).
7. Confirm **Realtime** is enabled on `profiles`, `conversation_members`, `messages`, `message_reactions` (the script tries to `ALTER PUBLICATION supabase_realtime ADD TABLE`; if tables were already published, Postgres may emit a benign notice).

## Google sign-in (required)

1. **Authentication → Providers → Google** — turn on, paste **Web client ID** and **client secret** from [Google Cloud Console](https://console.cloud.google.com/apis/credentials) (OAuth 2.0 Client ID, type **Web application**).
2. **Authorized redirect URIs** in Google Cloud must include Supabase’s callback, e.g.  
   `https://<project-ref>.supabase.co/auth/v1/callback`  
   (exact value is shown in the Supabase Google provider settings).
3. **Authentication → URL configuration** in Supabase:
   - **Site URL**: e.g. `http://localhost:5173` for local dev, or your production origin.
   - **Redirect URLs**: add `http://localhost:5173/auth` and your production `https://your-domain/auth` (and any preview URLs you use).
4. **Authentication → Providers → Email** — turn **off** (recommended) so accounts are created only via Google; otherwise users could still sign up with email/password through the API.

First-time users get a `profiles` row from the trigger **`handle_new_user`**. The app then shows a short **display name + username** step until **`profile_setup_completed`** is set (handled by **`patch_rls_conversations_and_profile_setup.sql`** / current **`archive_schema.sql`**).

## Frontend environment

Copy [`frontend/.env.example`](./frontend/.env.example) to `frontend/.env.local`:

- **`VITE_SUPABASE_URL`** — Project URL (**Settings → API**), base only (no `/rest/v1/`).
- **`VITE_SUPABASE_PUBLISHABLE_KEY`** — **`anon`** / **`publishable`** public key (**Settings → API**). Avoid the service role in the SPA.

Rebuild after changing `.env*` (`npm run build`).

## Legacy Express backend

`backend/` (SQLite + JWT + WebSocket) is optional for archival or comparisons. Hosting steps remain in **[`backend/RAILWAY.md`](./backend/RAILWAY.md)**. The SPA no longer proxies REST through Nitro unless you customize it again.
