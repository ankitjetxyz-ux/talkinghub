-- Run once if some Google users appear in Auth but `public.profiles` has no matching row.

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

REVOKE ALL ON FUNCTION public.archive_ensure_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.archive_ensure_profile() TO authenticated;

