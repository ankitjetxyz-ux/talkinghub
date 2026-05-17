-- ARCHIVE chat — Supabase schema (PostgreSQL)
-- Paste into Supabase SQL Editor and run once.
-- Auth: this app uses **Google OAuth only** — enable Google under Authentication → Providers and add redirect URLs (see SUPABASE.md).

CREATE EXTENSION IF NOT EXISTS citext;

-- --- Profiles ---
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  handle citext NOT NULL UNIQUE,
  avatar_url text,
  status text NOT NULL DEFAULT 'stable' CHECK (status IN ('stable', 'drifting', 'silent')),
  profile_setup_completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.ensure_unique_handle(want citext)
RETURNS citext
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE base citext := want;
DECLARE candidate citext := base;
DECLARE n int := 0;
BEGIN
  LOOP
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles p WHERE lower(p.handle::text) = lower(candidate::text));
    n := n + 1;
    candidate := base || '_' || lpad(n::text, 4, '0');
    IF n > 50 THEN RAISE EXCEPTION 'Could not allocate unique handle'; END IF;
  END LOOP;
  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE dn text := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''),
    NULLIF(trim(NEW.raw_user_meta_data->>'display_name'), ''),
    split_part(COALESCE(NEW.email, 'user'), '@', 1)
  );
DECLARE av text := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'avatar_url'), ''),
    NULLIF(trim(NEW.raw_user_meta_data->>'picture'), ''),
    ''
  );
DECLARE h text;
BEGIN
  h := NEW.raw_user_meta_data->>'handle';
  IF h IS NULL OR trim(h) = '' THEN
    h := regexp_replace(lower(split_part(COALESCE(NEW.email, ''), '@', 1)), '[^a-z0-9_]', '', 'g');
  ELSE
    h := regexp_replace(lower(trim(h)), '[^a-z0-9_]', '', 'g');
  END IF;
  IF h = '' THEN h := 'user'; END IF;
  INSERT INTO public.profiles (id, display_name, handle, avatar_url, profile_setup_completed)
  VALUES (
    NEW.id,
    trim(dn),
    public.ensure_unique_handle(h::citext),
    NULLIF(trim(av), ''),
    false
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- --- Conversations ---
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_group boolean NOT NULL DEFAULT false,
  name text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversation_members (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_members_user ON public.conversation_members(user_id);

-- --- Messages ---
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  original_message text NOT NULL,
  media_url text,
  media_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON public.messages(conversation_id, created_at);

-- Bump last_message_at without granting UPDATE on conversations to authenticated.
CREATE OR REPLACE FUNCTION public.archive_bump_conversation_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS archive_on_message_insert_bump ON public.messages;
CREATE TRIGGER archive_on_message_insert_bump
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.archive_bump_conversation_on_message();

CREATE TABLE IF NOT EXISTS public.message_reactions (
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_reactions_msg ON public.message_reactions(message_id);

-- --- Helpers ---
CREATE OR REPLACE FUNCTION public.archive_is_member(conv uuid, uid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members m
    WHERE m.conversation_id = conv AND m.user_id = uid
  );
$$;

CREATE OR REPLACE FUNCTION public.archive_format_plain(plain text)
RETURNS text
LANGUAGE plpgsql
VOLATILE AS $$
DECLARE prefixes text[] := ARRAY['ARCHIVE::', 'NODE_882::', '[signal-active]', 'SYS_LOG >', 'MoonTrace::', '// transmission //', '// broadcast //', 'ECHO::'];
DECLARE suffixes text[] := ARRAY['::stable', '// synced', '[maintained]', '< restored >', '// archived', '::complete', '// sealed', '..end'];
BEGIN
  IF plain IS NULL OR trim(plain) = '' THEN RETURN plain; END IF;
  RETURN prefixes[1 + floor(random() * array_length(prefixes, 1))::int] || ' ' || trim(plain) || ' '
    || suffixes[1 + floor(random() * array_length(suffixes, 1))::int];
END;
$$;

-- Start or reuse 1:1 DM
CREATE OR REPLACE FUNCTION public.archive_start_dm(_handle citext)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE uid uuid := auth.uid();
DECLARE other uuid;
DECLARE existing uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT id INTO other FROM public.profiles p WHERE lower(p.handle::text) = lower(_handle::text) LIMIT 1;
  IF other IS NULL THEN RAISE EXCEPTION 'HANDLE_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF other = uid THEN RAISE EXCEPTION 'Cannot DM yourself'; END IF;

  SELECT c.id INTO existing FROM public.conversations c
  WHERE NOT c.is_group
    AND EXISTS (SELECT 1 FROM public.conversation_members m WHERE m.conversation_id = c.id AND m.user_id = uid)
    AND EXISTS (SELECT 1 FROM public.conversation_members m2 WHERE m2.conversation_id = c.id AND m2.user_id = other)
  LIMIT 1;

  IF existing IS NOT NULL THEN RETURN existing; END IF;

  INSERT INTO public.conversations (is_group, created_by, last_message_at)
  VALUES (false, uid, now())
  RETURNING id INTO existing;

  INSERT INTO public.conversation_members (conversation_id, user_id) VALUES (existing, uid);
  INSERT INTO public.conversation_members (conversation_id, user_id) VALUES (existing, other);

  RETURN existing;
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_send_message(
  conv_id uuid,
  p_plain text,
  p_media_url text DEFAULT NULL,
  p_media_type text DEFAULT NULL
)
RETURNS public.messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE uid uuid := auth.uid();
DECLARE display_original text;
DECLARE formatted text;
DECLARE row_out public.messages%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF NOT public.archive_is_member(conv_id, uid) THEN RAISE EXCEPTION 'Forbidden'; END IF;

  display_original := NULLIF(trim(COALESCE(p_plain, '')), '');
  IF display_original IS NULL AND p_media_url IS NULL THEN
    RAISE EXCEPTION 'Message content or media required';
  END IF;

  IF display_original IS NULL THEN
    IF p_media_type IS NOT NULL AND p_media_type ILIKE 'video%' THEN
      display_original := '[video]';
    ELSE
      display_original := '[media]';
    END IF;
  END IF;

  IF trim(COALESCE(p_plain, '')) <> '' THEN
    formatted := public.archive_format_plain(display_original);
  ELSE
    formatted := public.archive_format_plain(display_original);
  END IF;

  INSERT INTO public.messages (conversation_id, sender_id, content, original_message, media_url, media_type, created_at)
  VALUES (conv_id, uid, formatted, display_original, p_media_url, p_media_type, now())
  RETURNING * INTO row_out;

  RETURN row_out;
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_message_reactions_array(p_msg uuid)
RETURNS json
LANGUAGE sql
SECURITY INVOKER
SET search_path = public AS $$
  SELECT coalesce(json_agg(json_build_object('user_id', r.user_id, 'emoji', r.emoji) ORDER BY r.created_at ASC), '[]'::json)
  FROM public.message_reactions r WHERE r.message_id = p_msg;
$$;

CREATE OR REPLACE FUNCTION public.archive_toggle_reaction(p_message_id uuid, p_emoji text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
DECLARE conv uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT conversation_id INTO conv FROM public.messages WHERE id = p_message_id;
  IF conv IS NULL THEN RAISE EXCEPTION 'Message not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.archive_is_member(conv, uid) THEN RAISE EXCEPTION 'Forbidden'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.message_reactions r
    WHERE r.message_id = p_message_id AND r.user_id = uid AND r.emoji = p_emoji
  ) THEN
    DELETE FROM public.message_reactions WHERE message_id = p_message_id AND user_id = uid AND emoji = p_emoji;
  ELSE
    INSERT INTO public.message_reactions (message_id, user_id, emoji) VALUES (p_message_id, uid, trim(p_emoji));
  END IF;

  RETURN public.archive_message_reactions_array(p_message_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_delete_message(p_message_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
DECLARE sender uuid;
DECLARE conv uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT sender_id, conversation_id INTO sender, conv FROM public.messages WHERE id = p_message_id;
  IF sender IS NULL THEN RAISE EXCEPTION 'Message not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.archive_is_member(conv, uid) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF sender <> uid THEN RAISE EXCEPTION 'You can only delete your own messages'; END IF;

  DELETE FROM public.messages WHERE id = p_message_id;
END;
$$;

-- Backfill profiles row when auth.trigger missed (fixes endless "loading profile").
CREATE OR REPLACE FUNCTION public.archive_ensure_profile()
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  r public.profiles%ROWTYPE;
  em text;
  md jsonb;
  dn text;
  hv text;
  av text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT * INTO r FROM public.profiles WHERE id = uid;
  IF FOUND THEN RETURN r; END IF;

  SELECT au.email::text, COALESCE(au.raw_user_meta_data, '{}'::jsonb)
  INTO em, md
  FROM auth.users au
  WHERE au.id = uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Auth user not found';
  END IF;

  dn := trim(COALESCE(
    NULLIF(TRIM(md->>'full_name'), ''),
    NULLIF(TRIM(md->>'name'), ''),
    NULLIF(TRIM(md->>'display_name'), ''),
    split_part(COALESCE(em, 'user@unknown'), '@', 1)
  ));

  hv := regexp_replace(lower(split_part(COALESCE(em, ''), '@', 1)), '[^a-z0-9_]', '', 'g');
  IF hv = '' THEN hv := 'user'; END IF;

  av := NULLIF(trim(COALESCE(md->>'avatar_url', md->>'picture', '')), '');

  INSERT INTO public.profiles (
    id, display_name, handle, avatar_url, profile_setup_completed
  )
  VALUES (
    uid,
    dn,
    public.ensure_unique_handle(hv::citext),
    NULLIF(trim(av), ''),
    false
  )
  RETURNING * INTO STRICT r;

  RETURN r;
EXCEPTION
  WHEN unique_violation THEN
    SELECT * INTO r FROM public.profiles WHERE id = uid;
    IF FOUND THEN RETURN r; END IF;
    RAISE;
END;
$$;

-- --- RLS ---
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles read all" ON public.profiles;
CREATE POLICY "profiles read all" ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles update own" ON public.profiles;
CREATE POLICY "profiles update own" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "conversations member read" ON public.conversations;
CREATE POLICY "conversations member read" ON public.conversations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members m
      WHERE m.conversation_id = conversations.id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "conv_members self" ON public.conversation_members;
DROP POLICY IF EXISTS "conv_members read if participant" ON public.conversation_members;
-- archive_is_member is SECURITY DEFINER: avoids recursive RLS (EXISTS on same table ⇒ PostgREST 500)
CREATE POLICY "conv_members read if participant" ON public.conversation_members FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.archive_is_member(conversation_id, auth.uid())
  );

DROP POLICY IF EXISTS "messages read member" ON public.messages;
CREATE POLICY "messages read member" ON public.messages FOR SELECT TO authenticated
  USING (public.archive_is_member(conversation_id, auth.uid()));

DROP POLICY IF EXISTS "reactions read member" ON public.message_reactions;
CREATE POLICY "reactions read member" ON public.message_reactions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messages msg
      WHERE msg.id = message_reactions.message_id
        AND public.archive_is_member(msg.conversation_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "messages insert sender member" ON public.messages;
CREATE POLICY "messages insert sender member" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.archive_is_member(conversation_id, auth.uid())
  );

-- Grants
GRANT EXECUTE ON FUNCTION public.archive_start_dm TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_send_message TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_toggle_reaction TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_delete_message TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_format_plain TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_is_member TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_message_reactions_array TO authenticated;
REVOKE ALL ON FUNCTION public.archive_ensure_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.archive_ensure_profile TO authenticated;

GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.conversations TO authenticated;
GRANT SELECT ON public.conversation_members TO authenticated;
GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT SELECT ON public.message_reactions TO authenticated;

REVOKE INSERT, UPDATE, DELETE ON public.conversations FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.conversation_members FROM PUBLIC, anon, authenticated;
REVOKE DELETE, UPDATE ON public.messages FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.message_reactions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.conversations TO authenticated;
GRANT SELECT ON public.conversation_members TO authenticated;


-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;

-- --- Storage ---
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('chat-media', 'chat-media', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm']::text[])
ON CONFLICT (id) DO UPDATE SET public = excluded.public;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[])
ON CONFLICT (id) DO UPDATE SET public = excluded.public;

CREATE POLICY "chat-media public read"
  ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'chat-media');

CREATE POLICY "chat-media authenticated upload own folder"
  ON storage.objects FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'chat-media' AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars public read"
  ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'avatars');

CREATE POLICY "avatars upload own folder"
  ON storage.objects FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars update own"
  ON storage.objects FOR UPDATE TO authenticated USING (
    bucket_id = 'avatars' AND owner = auth.uid()
  );

CREATE POLICY "avatars delete own"
  ON storage.objects FOR DELETE TO authenticated USING (
    bucket_id = 'avatars' AND owner = auth.uid()
  );
