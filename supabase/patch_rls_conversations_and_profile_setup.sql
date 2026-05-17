-- Run in Supabase SQL Editor (recommended if you already applied an older archive_schema):

-- ── A) Profiles: track first-time username/name step after Google ───────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_setup_completed boolean;

UPDATE public.profiles
SET profile_setup_completed = COALESCE(profile_setup_completed, true)
WHERE profile_setup_completed IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN profile_setup_completed SET DEFAULT false;

ALTER TABLE public.profiles
  ALTER COLUMN profile_setup_completed SET NOT NULL;

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
  INSERT INTO public.profiles (
    id, display_name, handle, avatar_url, profile_setup_completed
  )
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

-- ── B) RLS: memberships + chats
-- conversations: EXISTS with user_id = auth.uid() only (no nested archive_is_member on conversations).
-- conversation_members: archive_is_member (see note — do not use self-referential EXISTS on this table).

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
-- SECURITY DEFINER helper bypasses RLS so we do NOT recurse policies on this table (PostgREST 500 otherwise)
CREATE POLICY "conv_members read if participant" ON public.conversation_members FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.archive_is_member(conversation_id, auth.uid())
  );

DROP POLICY IF EXISTS "messages read member" ON public.messages;
CREATE POLICY "messages read member" ON public.messages FOR SELECT TO authenticated
  USING (public.archive_is_member(conversation_id, auth.uid()));

DROP POLICY IF EXISTS "messages insert sender member" ON public.messages;
CREATE POLICY "messages insert sender member" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.archive_is_member(conversation_id, auth.uid())
  );

DROP POLICY IF EXISTS "reactions read member" ON public.message_reactions;
CREATE POLICY "reactions read member" ON public.message_reactions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messages msg
      WHERE msg.id = message_reactions.message_id
        AND public.archive_is_member(msg.conversation_id, auth.uid())
    )
  );
