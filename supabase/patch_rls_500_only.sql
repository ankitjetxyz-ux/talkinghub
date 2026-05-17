-- Fix "permission denied for table conversations" on SELECT: use EXISTS + own membership row only.
-- Safe with conv_members policy = archive_is_member (no self-referential EXISTS on same table).
-- Run once in Supabase SQL Editor.

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON TABLE public.conversations TO authenticated;

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
