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
create policy "submit own feedback" on public.feedback
  for insert with check (auth.uid() = user_id);

-- signed-in users see active announcements; only the service role writes them
create policy "read active announcements" on public.announcements
  for select using (auth.role() = 'authenticated' and active);
