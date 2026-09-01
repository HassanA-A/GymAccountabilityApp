-- Steps: an opt-in per-crew feature. Crews that turn it on see everyone's
-- daily step count, plus weekly totals and averages. Steps are a per-user,
-- per-day fact (the same across all your crews), so we store them once in
-- daily_steps and read them per crew through a security-definer RPC.

-- 1. Per-crew toggle. Off by default so nothing changes for existing crews.
alter table groups
  add column if not exists steps_enabled boolean not null default false;

-- 2. One row per user per local day. The client syncs this from the phone's
--    pedometer (iOS Core Motion), upserting today plus a few days back.
create table if not exists daily_steps (
  user_id    uuid not null references profiles(id) on delete cascade,
  local_date date not null,                 -- the user's local calendar day
  steps      int  not null default 0 check (steps >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, local_date)
);

create index if not exists daily_steps_date_idx on daily_steps (local_date);

alter table daily_steps enable row level security;

-- You read and write only your own step rows. Crew-wide reads go through the
-- crew_steps() RPC below, which runs as definer and gates on membership.
drop policy if exists "read own steps" on daily_steps;
create policy "read own steps" on daily_steps
  for select using (user_id = auth.uid());

drop policy if exists "insert own steps" on daily_steps;
create policy "insert own steps" on daily_steps
  for insert with check (user_id = auth.uid());

drop policy if exists "update own steps" on daily_steps;
create policy "update own steps" on daily_steps
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 3. Every member's steps for a crew: today, the trailing 7-day total, and how
--    many of those days they logged (for a fair average). Runs as definer so it
--    can read other members' rows, but only for a crew you're in that has steps
--    turned on. p_today is the viewer's local date so the window matches what
--    they see on screen.
create or replace function crew_steps(p_group_id uuid, p_today date)
returns table (user_id uuid, today int, week_total int, days_logged int)
language sql
stable
security definer
set search_path = public
as $$
  select
    gm.user_id,
    coalesce(sum(ds.steps) filter (where ds.local_date = p_today), 0)::int as today,
    coalesce(sum(ds.steps), 0)::int as week_total,
    coalesce(count(distinct ds.local_date) filter (where ds.steps > 0), 0)::int as days_logged
  from group_members gm
  left join daily_steps ds
    on ds.user_id = gm.user_id
   and ds.local_date > p_today - 7
   and ds.local_date <= p_today
  where gm.group_id = p_group_id
    and is_group_member(p_group_id)
    and (select steps_enabled from groups where id = p_group_id)
  group by gm.user_id;
$$;

grant execute on function crew_steps(uuid, date) to authenticated;
