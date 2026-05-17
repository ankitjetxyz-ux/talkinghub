-- Fix POST /rpc/archive_send_message → 403 Forbidden.
-- Cause: SECURITY INVOKER tried UPDATE conversations while authenticated has no UPDATE grant/policy.
-- Run once in Supabase SQL Editor.

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT ON TABLE public.messages TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_send_message(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_is_member(uuid, uuid) TO authenticated;

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

  formatted := public.archive_format_plain(display_original);

  INSERT INTO public.messages (conversation_id, sender_id, content, original_message, media_url, media_type, created_at)
  VALUES (conv_id, uid, formatted, display_original, p_media_url, p_media_type, now())
  RETURNING * INTO row_out;

  RETURN row_out;
END;
$$;

GRANT EXECUTE ON FUNCTION public.archive_send_message(uuid, text, text, text) TO authenticated;

-- Easier member listing (own rows + co-participants)
DROP POLICY IF EXISTS "conv_members self" ON public.conversation_members;
DROP POLICY IF EXISTS "conv_members read if participant" ON public.conversation_members;
CREATE POLICY "conv_members read if participant" ON public.conversation_members FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.archive_is_member(conversation_id, auth.uid())
  );
