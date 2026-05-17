-- Hotfix: "permission denied for table conversations" when listing or opening DMs.
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
