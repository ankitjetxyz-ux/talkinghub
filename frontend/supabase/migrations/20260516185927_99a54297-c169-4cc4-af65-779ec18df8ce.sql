-- Status enum
create type public.user_status as enum ('stable', 'drifting', 'silent');

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  handle text not null unique,
  avatar_url text,
  status public.user_status not null default 'stable',
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "profiles_select_authenticated"
  on public.profiles for select to authenticated using (true);
create policy "profiles_insert_own"
  on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles_update_own"
  on public.profiles for update to authenticated using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_handle text;
  v_name text;
  v_base text;
  v_attempt int := 0;
begin
  v_name := coalesce(
    nullif(new.raw_user_meta_data->>'display_name', ''),
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'name', ''),
    split_part(new.email, '@', 1)
  );
  v_base := coalesce(
    nullif(regexp_replace(lower(new.raw_user_meta_data->>'handle'), '[^a-z0-9_]', '', 'g'), ''),
    nullif(regexp_replace(lower(split_part(new.email, '@', 1)), '[^a-z0-9_]', '', 'g'), ''),
    'node'
  );
  v_handle := v_base;
  while exists (select 1 from public.profiles where handle = v_handle) and v_attempt < 50 loop
    v_attempt := v_attempt + 1;
    v_handle := v_base || '_' || lpad(floor(random()*10000)::int::text, 4, '0');
  end loop;

  insert into public.profiles (id, display_name, handle)
  values (new.id, v_name, v_handle);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Conversations
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  is_group boolean not null default false,
  name text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
alter table public.conversations enable row level security;

-- Members
create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
alter table public.conversation_members enable row level security;

-- Security definer helper to avoid RLS recursion
create or replace function public.is_conversation_member(_conversation_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = _conversation_id and user_id = _user_id
  )
$$;

create policy "conversations_select_member"
  on public.conversations for select to authenticated
  using (public.is_conversation_member(id, auth.uid()));
create policy "conversations_insert_self"
  on public.conversations for insert to authenticated
  with check (created_by = auth.uid());
create policy "conversations_update_member"
  on public.conversations for update to authenticated
  using (public.is_conversation_member(id, auth.uid()));

create policy "members_select_own_or_shared"
  on public.conversation_members for select to authenticated
  using (user_id = auth.uid() or public.is_conversation_member(conversation_id, auth.uid()));
create policy "members_insert_self_or_creator"
  on public.conversation_members for insert to authenticated
  with check (
    user_id = auth.uid()
    or exists (select 1 from public.conversations c where c.id = conversation_id and c.created_by = auth.uid())
  );
create policy "members_delete_own"
  on public.conversation_members for delete to authenticated
  using (user_id = auth.uid());

-- Messages
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);
alter table public.messages enable row level security;
create index messages_conv_created_idx on public.messages(conversation_id, created_at);

create policy "messages_select_member"
  on public.messages for select to authenticated
  using (public.is_conversation_member(conversation_id, auth.uid()));
create policy "messages_insert_member_self"
  on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_conversation_member(conversation_id, auth.uid())
  );

-- Bump last_message_at when a message arrives
create or replace function public.bump_conversation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end;
$$;
create trigger on_message_insert_bump
  after insert on public.messages
  for each row execute function public.bump_conversation();

-- RPC: start_dm(handle) -> conversation_id
create or replace function public.start_dm(_handle text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_other uuid;
  v_conv uuid;
begin
  if v_me is null then raise exception 'Not authenticated'; end if;

  select id into v_other from public.profiles where lower(handle) = lower(_handle);
  if v_other is null then raise exception 'No such handle: %', _handle; end if;
  if v_other = v_me then raise exception 'Cannot DM yourself'; end if;

  -- Existing 1:1?
  select c.id into v_conv
  from public.conversations c
  join public.conversation_members m1 on m1.conversation_id = c.id and m1.user_id = v_me
  join public.conversation_members m2 on m2.conversation_id = c.id and m2.user_id = v_other
  where c.is_group = false
  limit 1;

  if v_conv is not null then return v_conv; end if;

  insert into public.conversations (is_group, created_by) values (false, v_me) returning id into v_conv;
  insert into public.conversation_members (conversation_id, user_id) values (v_conv, v_me), (v_conv, v_other);
  return v_conv;
end;
$$;

-- Realtime
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversation_members;
alter publication supabase_realtime add table public.conversations;
