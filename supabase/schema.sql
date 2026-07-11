-- Vokabi cloud sync schema
-- Run this once in your Supabase project: Dashboard → SQL Editor → New query → paste → Run

create table if not exists public.groups (
  uid uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at bigint not null,
  updated_at bigint not null
);

create table if not exists public.words (
  uid uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  german text not null,
  article text,
  english text,
  plural text,
  ipa text,
  pos text,
  example text,
  example_en text,
  notes text,
  favorite boolean not null default false,
  group_uids uuid[] not null default '{}',
  status text,
  created_at bigint not null,
  updated_at bigint not null
);

create index if not exists words_user_idx on public.words (user_id);
create index if not exists groups_user_idx on public.groups (user_id);

-- Row Level Security: each user can only see and change their own rows
alter table public.words enable row level security;
alter table public.groups enable row level security;

drop policy if exists "own words" on public.words;
create policy "own words" on public.words
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own groups" on public.groups;
create policy "own groups" on public.groups
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
