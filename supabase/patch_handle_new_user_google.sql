-- Run once if `archive_schema.sql` was applied before Google metadata + avatar handling.
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
  INSERT INTO public.profiles (id, display_name, handle, avatar_url)
  VALUES (
    NEW.id,
    trim(dn),
    public.ensure_unique_handle(h::citext),
    NULLIF(trim(av), '')
  );
  RETURN NEW;
END;
$$;
