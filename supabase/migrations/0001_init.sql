-- Gym accountability app: initial schema
-- Supabase / Postgres. Run this in the Supabase SQL editor.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------
-- profiles: one row per auth user
-- ---------------------------------------------------------------
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text not null unique check (char_length(username) between 2 and 24),
  display_name text not null,
  avatar_url   text,
  timezone     text not null default 'UTC',
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- groups: a friend group with a shared weekly target
-- ---------------------------------------------------------------
create table groups (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null check (char_length(name) between 1 and 60),
  invite_code          text not null unique default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 6)),
  created_by           uuid not null references profiles(id) on delete restrict,
  target_days_per_week int  not null default 4 check (target_days_per_week between 1 and 7),
  week_start_dow       int  not null default 1 check (week_start_dow between 0 and 6),  -- 0=Sun, 1=Mon
  created_at           timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- group_members: join table
-- ---------------------------------------------------------------
create table group_members (
  id        uuid primary key default gen_random_uuid(),
  group_id  uuid not null references groups(id) on delete cascade,
  user_id   uuid not null references profiles(id) on delete cascade,
  role      text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  unique (group_id, user_id)
);

-- ---------------------------------------------------------------
-- check_ins: the event log. Everything else is derived from this.
-- ---------------------------------------------------------------
create table check_ins (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  group_id   uuid not null references groups(id) on delete cascade,
  local_date date not null,                    -- the user's local calendar day
  activity   text not null default 'gym' check (activity in ('gym', 'run', 'lift', 'other')),
  note       text check (char_length(note) <= 280),
  photo_url  text,
  created_at timestamptz not null default now(),  -- the actual instant, for auditing
  unique (user_id, group_id, local_date)          -- one check-in per person per day per group
);

-- ---------------------------------------------------------------
-- Indexes: Postgres does NOT index foreign keys automatically
-- ---------------------------------------------------------------
create index on group_members (user_id);
create index on group_members (group_id);
create index on check_ins (user_id);
create index on check_ins (group_id, local_date desc);   -- the group feed query
create index on check_ins (user_id, local_date desc);    -- the streak query

-- ---------------------------------------------------------------
-- Helper: avoids infinite recursion in group_members RLS policies.
-- A policy on group_members cannot itself SELECT group_members
-- under RLS, so this runs as definer to break the cycle.
-- ---------------------------------------------------------------
create or replace function is_group_member(gid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------
alter table profiles      enable row level security;
alter table groups        enable row level security;
alter table group_members enable row level security;
alter table check_ins     enable row level security;

-- profiles: you see yourself and anyone sharing a group with you
create policy "read own profile" on profiles
  for select using (id = auth.uid());

create policy "read groupmates profiles" on profiles
  for select using (
    exists (
      select 1 from group_members m
      where m.user_id = profiles.id and is_group_member(m.group_id)
    )
  );

create policy "update own profile" on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "insert own profile" on profiles
  for insert with check (id = auth.uid());

-- groups: members read; anyone authenticated creates; owner updates
create policy "members read group" on groups
  for select using (is_group_member(id));

create policy "create group" on groups
  for insert with check (created_by = auth.uid());

create policy "owner updates group" on groups
  for update using (
    exists (
      select 1 from group_members m
      where m.group_id = groups.id and m.user_id = auth.uid() and m.role = 'owner'
    )
  );

-- group_members: members see the roster; you can only add/remove yourself
create policy "members read roster" on group_members
  for select using (is_group_member(group_id));

create policy "join group as self" on group_members
  for insert with check (user_id = auth.uid());

create policy "leave group" on group_members
  for delete using (user_id = auth.uid());

-- check_ins: group members read all; you write only your own
create policy "members read check_ins" on check_ins
  for select using (is_group_member(group_id));

create policy "insert own check_in" on check_ins
  for insert with check (user_id = auth.uid() and is_group_member(group_id));

create policy "delete own check_in" on check_ins
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------
-- Streak: consecutive weeks in which the user hit the group target.
-- Computed, never stored. Stored counters drift and go wrong.
--
-- Week bucketing: date_trunc('week', ...) always snaps to Monday, so we
-- shift the date by a constant offset k before truncating to move the
-- week boundary onto week_start_dow. A constant offset k makes weeks
-- start on dow (1 - k) mod 7, so to start on S we need k = (1 - S) mod 7,
-- i.e. (8 - S) % 7. (An earlier draft used (7 - S) % 7, which is off by
-- one day: the default Monday config bucketed Monday check-ins into the
-- previous week.)
-- ---------------------------------------------------------------
create or replace function weekly_streak(p_user_id uuid, p_group_id uuid)
returns int
language sql
stable
as $$
  with target as (
    select target_days_per_week, week_start_dow from groups where id = p_group_id
  ),
  weeks as (
    select
      date_trunc('week', local_date + ((8 - (select week_start_dow from target)) % 7))::date as week_key,
      count(*) as days_hit
    from check_ins
    where user_id = p_user_id and group_id = p_group_id
    group by 1
  ),
  hit as (
    select week_key,
           row_number() over (order by week_key desc) as rn
    from weeks
    where days_hit >= (select target_days_per_week from target)
  ),
  consecutive as (
    select count(*) as streak
    from hit
    where week_key = (select max(week_key) from hit) - ((rn - 1) * interval '7 days')
  )
  select coalesce((select streak from consecutive), 0)::int;
$$;
