-- Vokabi back office schema (feedback + announcements)
-- Run in Supabase: Dashboard → SQL Editor → New query → paste → Run

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  email text,
  message text not null,
  status text not null default 'new', -- new | read | resolved
  created_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;
alter table public.announcements enable row level security;

-- users may submit feedback as themselves; only the service role reads it
drop policy if exists "submit own feedback" on public.feedback;
create policy "submit own feedback" on public.feedback
  for insert with check (auth.uid() = user_id);

-- signed-in users see active announcements; only the service role writes them
drop policy if exists "read active announcements" on public.announcements;
create policy "read active announcements" on public.announcements
  for select using (auth.role() = 'authenticated' and active);

-- server-side key/value configuration (e.g. AI provider API keys).
-- RLS is enabled with no policies on purpose: only the service role
-- (admin API routes) can read or write these rows.
create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

-- ready-made groups curated in the back office; users can add one (with its
-- words) from the app's "New group" flow. Only the service role writes them.
create table if not exists public.preset_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  words jsonb not null default '[]'::jsonb, -- array of German words
  is_default boolean not null default false, -- seeded into every user's library
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- existing deployments: add the default-group flag
alter table public.preset_groups
  add column if not exists is_default boolean not null default false;

alter table public.preset_groups enable row level security;

-- signed-in users browse presets; writes go through the admin API
drop policy if exists "read preset groups" on public.preset_groups;
create policy "read preset groups" on public.preset_groups
  for select using (auth.role() = 'authenticated');
