-- ═══════════════════════════════════════════════════════════════════
--  Our Little World ♡ — database/schema.sql
--  Supabase (PostgreSQL) schema, seed data, storage & access policies
--
--  HOW TO RUN:
--    Supabase Dashboard → SQL Editor → New query → paste this file → Run.
--    It is idempotent: safe to run more than once.
--
--  ⚠ SECURITY CHOICE — READ BEFORE RUNNING ⚠
--  This file ships with TWO alternative policy sets at the bottom:
--
--   A) DEMO / NAME-ONLY POLICIES (enabled by default below)
--      Anyone on the internet who finds your URL can read & write
--      everything. This exists ONLY so the requested "type a name and
--      enter" experience works without accounts. It is NOT private.
--
--   B) SECURE POLICIES (commented out below)
--      Only the two authenticated accounts linked to the Yousef and
--      Agatha profiles can read or write anything. This is the only
--      configuration that makes your world genuinely private.
--
--  For real use: enable Supabase Auth, create the two accounts, link
--  them in `profiles.auth_user_id`, then run section B (it drops the
--  demo policies first). See README.md → "Making it truly private".
-- ═══════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────
-- 1. TABLES
-- ─────────────────────────────────────────────

create table if not exists public.profiles (
  id           uuid primary key default gen_random_uuid(),
  display_name text not null unique check (display_name in ('Yousef', 'Agatha')),
  -- In secure mode, link each profile to its Supabase Auth account:
  auth_user_id uuid unique,
  created_at   timestamptz not null default now()
);

create table if not exists public.conversations (
  id         uuid primary key default gen_random_uuid(),
  title      text not null default 'Yousef ♡ Agatha',
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  message_text    text check (char_length(message_text) <= 4000),
  attachment_path text,
  attachment_type text,
  created_at      timestamptz not null default now(),
  edited_at       timestamptz,
  deleted_at      timestamptz,
  constraint message_has_content check (message_text is not null or attachment_path is not null)
);
create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at desc, id desc);

create table if not exists public.message_reactions (
  id         uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  reaction   text not null check (char_length(reaction) <= 8),
  created_at timestamptz not null default now(),
  -- One reaction per person per message; changing it replaces the row.
  unique (message_id, user_id)
);

create table if not exists public.favorites (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, message_id) -- personal favorites stay per-user
);

create table if not exists public.memories (
  id          uuid primary key default gen_random_uuid(),
  creator_id  uuid not null references public.profiles(id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 80),
  caption     text check (char_length(caption) <= 1000),
  memory_date date not null default current_date,
  location    text check (char_length(location) <= 80),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists memories_date_idx on public.memories (memory_date desc);

create table if not exists public.memory_photos (
  id         uuid primary key default gen_random_uuid(),
  memory_id  uuid not null references public.memories(id) on delete cascade,
  file_path  text not null,
  alt_text   text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists memory_photos_memory_idx on public.memory_photos (memory_id, sort_order);

create table if not exists public.memory_reactions (
  id         uuid primary key default gen_random_uuid(),
  memory_id  uuid not null references public.memories(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  reaction   text not null check (char_length(reaction) <= 8),
  created_at timestamptz not null default now(),
  unique (memory_id, user_id)
);

create table if not exists public.memory_favorites (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  memory_id  uuid not null references public.memories(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, memory_id)
);

create table if not exists public.user_preferences (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references public.profiles(id) on delete cascade,
  theme      text not null default 'rose-garden'
             check (theme in ('rose-garden', 'lavender-dreams', 'midnight-letters')),
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 2. SEED DATA — the two people and their one conversation
--    Fixed UUIDs keep frontend configuration simple.
-- ─────────────────────────────────────────────

insert into public.profiles (id, display_name) values
  ('00000000-0000-4000-8000-0000000000a1', 'Yousef'),
  ('00000000-0000-4000-8000-0000000000a2', 'Agatha')
on conflict (id) do nothing;

insert into public.conversations (id, title) values
  ('00000000-0000-4000-8000-0000000000c1', 'Yousef ♡ Agatha')
on conflict (id) do nothing;

-- ─────────────────────────────────────────────
-- 3. STORAGE BUCKETS (private — access goes through policies below
--    and short-lived signed URLs generated by the frontend client)
-- ─────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('attachments',   'attachments',   false, 8388608,  array['image/jpeg','image/png','image/webp']),
  ('memory-photos', 'memory-photos', false, 8388608,  array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- ─────────────────────────────────────────────
-- 4. REALTIME — stream changes to the open app
-- ─────────────────────────────────────────────

do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; when undefined_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.message_reactions;
exception when duplicate_object then null; when undefined_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.memories;
exception when duplicate_object then null; when undefined_object then null;
end $$;

-- ─────────────────────────────────────────────
-- 5. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────

alter table public.profiles          enable row level security;
alter table public.conversations     enable row level security;
alter table public.messages          enable row level security;
alter table public.message_reactions enable row level security;
alter table public.favorites         enable row level security;
alter table public.memories          enable row level security;
alter table public.memory_photos     enable row level security;
alter table public.memory_reactions  enable row level security;
alter table public.memory_favorites  enable row level security;
alter table public.user_preferences  enable row level security;

-- ═══════════════════════════════════════════════════════════════
--  SECTION A — DEMO / NAME-ONLY POLICIES (ACTIVE BY DEFAULT)
--  ⚠ These allow ANY visitor (anon key) to read and write ALL data.
--  They exist only so the name-only welcome experience works.
--  This is NOT privacy. Replace with Section B for real use.
-- ═══════════════════════════════════════════════════════════════

drop policy if exists demo_profiles_all          on public.profiles;
drop policy if exists demo_conversations_all     on public.conversations;
drop policy if exists demo_messages_all          on public.messages;
drop policy if exists demo_reactions_all         on public.message_reactions;
drop policy if exists demo_favorites_all         on public.favorites;
drop policy if exists demo_memories_all          on public.memories;
drop policy if exists demo_memory_photos_all     on public.memory_photos;
drop policy if exists demo_memory_reactions_all  on public.memory_reactions;
drop policy if exists demo_memory_favorites_all  on public.memory_favorites;
drop policy if exists demo_preferences_all       on public.user_preferences;

create policy demo_profiles_all          on public.profiles          for all using (true) with check (true);
create policy demo_conversations_all     on public.conversations     for all using (true) with check (true);
create policy demo_messages_all          on public.messages          for all using (true) with check (true);
create policy demo_reactions_all         on public.message_reactions for all using (true) with check (true);
create policy demo_favorites_all         on public.favorites         for all using (true) with check (true);
create policy demo_memories_all          on public.memories          for all using (true) with check (true);
create policy demo_memory_photos_all     on public.memory_photos     for all using (true) with check (true);
create policy demo_memory_reactions_all  on public.memory_reactions  for all using (true) with check (true);
create policy demo_memory_favorites_all  on public.memory_favorites  for all using (true) with check (true);
create policy demo_preferences_all       on public.user_preferences  for all using (true) with check (true);

-- Storage: demo mode allows anon read/write inside the two buckets.
drop policy if exists demo_attachments_rw   on storage.objects;
drop policy if exists demo_memoryphotos_rw  on storage.objects;
create policy demo_attachments_rw  on storage.objects for all
  using (bucket_id = 'attachments')   with check (bucket_id = 'attachments');
create policy demo_memoryphotos_rw on storage.objects for all
  using (bucket_id = 'memory-photos') with check (bucket_id = 'memory-photos');

-- ═══════════════════════════════════════════════════════════════
--  SECTION B — SECURE POLICIES (COMMENTED OUT — ENABLE FOR REAL USE)
--
--  Steps before running this section:
--    1. Supabase Dashboard → Authentication → Add the two users
--       (e.g. yousef@yourdomain… and agatha@yourdomain…).
--    2. Link them:
--         update public.profiles set auth_user_id = '<yousef-auth-uuid>'
--           where display_name = 'Yousef';
--         update public.profiles set auth_user_id = '<agatha-auth-uuid>'
--           where display_name = 'Agatha';
--    3. Run everything below (it removes the demo policies first).
--    4. Set AUTH_MODE = "email" in assets/js/config.js.
-- ═══════════════════════════════════════════════════════════════

/*
create or replace function public.is_us()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.auth_user_id = auth.uid()
  );
$$;

drop policy if exists demo_profiles_all          on public.profiles;
drop policy if exists demo_conversations_all     on public.conversations;
drop policy if exists demo_messages_all          on public.messages;
drop policy if exists demo_reactions_all         on public.message_reactions;
drop policy if exists demo_favorites_all         on public.favorites;
drop policy if exists demo_memories_all          on public.memories;
drop policy if exists demo_memory_photos_all     on public.memory_photos;
drop policy if exists demo_memory_reactions_all  on public.memory_reactions;
drop policy if exists demo_memory_favorites_all  on public.memory_favorites;
drop policy if exists demo_preferences_all       on public.user_preferences;
drop policy if exists demo_attachments_rw        on storage.objects;
drop policy if exists demo_memoryphotos_rw       on storage.objects;

create policy secure_profiles_read on public.profiles
  for select using (public.is_us());

create policy secure_conversations_read on public.conversations
  for select using (public.is_us());

create policy secure_messages_read on public.messages
  for select using (public.is_us());
create policy secure_messages_write on public.messages
  for insert with check (
    public.is_us()
    and sender_id = (select id from public.profiles where auth_user_id = auth.uid())
  );
create policy secure_messages_update on public.messages
  for update using (
    sender_id = (select id from public.profiles where auth_user_id = auth.uid())
  );

create policy secure_reactions_all on public.message_reactions
  for all using (public.is_us())
  with check (user_id = (select id from public.profiles where auth_user_id = auth.uid()));

create policy secure_favorites_all on public.favorites
  for all using (user_id = (select id from public.profiles where auth_user_id = auth.uid()))
  with check (user_id = (select id from public.profiles where auth_user_id = auth.uid()));

create policy secure_memories_read on public.memories
  for select using (public.is_us());
create policy secure_memories_write on public.memories
  for insert with check (
    public.is_us()
    and creator_id = (select id from public.profiles where auth_user_id = auth.uid())
  );
create policy secure_memories_update on public.memories
  for update using (creator_id = (select id from public.profiles where auth_user_id = auth.uid()));
create policy secure_memories_delete on public.memories
  for delete using (creator_id = (select id from public.profiles where auth_user_id = auth.uid()));

create policy secure_memory_photos_all on public.memory_photos
  for all using (public.is_us()) with check (public.is_us());

create policy secure_memory_reactions_all on public.memory_reactions
  for all using (public.is_us())
  with check (user_id = (select id from public.profiles where auth_user_id = auth.uid()));

create policy secure_memory_favorites_all on public.memory_favorites
  for all using (public.is_us())
  with check (user_id = (select id from public.profiles where auth_user_id = auth.uid()));

create policy secure_preferences_all on public.user_preferences
  for all using (user_id = (select id from public.profiles where auth_user_id = auth.uid()))
  with check (user_id = (select id from public.profiles where auth_user_id = auth.uid()));

-- Storage: only the two authenticated users may read/write the buckets.
create policy secure_attachments_read on storage.objects
  for select using (bucket_id = 'attachments' and public.is_us());
create policy secure_attachments_write on storage.objects
  for insert with check (bucket_id = 'attachments' and public.is_us());
create policy secure_attachments_delete on storage.objects
  for delete using (bucket_id = 'attachments' and public.is_us());

create policy secure_memoryphotos_read on storage.objects
  for select using (bucket_id = 'memory-photos' and public.is_us());
create policy secure_memoryphotos_write on storage.objects
  for insert with check (bucket_id = 'memory-photos' and public.is_us());
create policy secure_memoryphotos_delete on storage.objects
  for delete using (bucket_id = 'memory-photos' and public.is_us());
*/
