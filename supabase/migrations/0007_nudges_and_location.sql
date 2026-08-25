-- Two things in one step:
--   1. Make nudges actually work in-app (no Edge Function / push build required)
--      by inserting through a security-definer RPC and letting the recipient
--      read + clear their unseen nudges.
--   2. Let a check-in carry the phone's location so the crew can see it was
--      logged at a gym (and so we can flag when location is off).

-- ---------------------------------------------------------------
-- 1. Nudges: in-app delivery
-- ---------------------------------------------------------------

-- The nudges table normally comes from 0003 (push notifications). Create it
-- here if it's missing so in-app nudges work without the push-token setup.
create table if not exists nudges (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references groups(id) on delete cascade,
  sender_id    uuid not null references profiles(id) on delete cascade,
  recipient_id uuid not null references profiles(id) on delete cascade,
  delivered    boolean not null default false,
  created_at   timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

create index if not exists nudges_lookup_idx
  on nudges (group_id, sender_id, recipient_id, created_at desc);

alter table nudges enable row level security;

-- Recipients (and senders) can read their own nudge history.
drop policy if exists "read own nudge history" on nudges;
create policy "read own nudge history" on nudges
  for select using (sender_id = auth.uid() or recipient_id = auth.uid());

-- Recipients mark a nudge as seen once it's shown to them.
alter table nudges add column if not exists seen boolean not null default false;

-- Send a nudge from the signed-in user to a crewmate. Enforces that both
-- people share the group and rate-limits to one nudge per pair per 3 hours.
-- Returns { delivered: bool, reason: text|null } so the app can show a
-- friendly result. "delivered" here means "recorded + the recipient will see
-- it next time they open the app" — real push can layer on later.
create or replace function send_nudge(p_group_id uuid, p_recipient_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender uuid := auth.uid();
begin
  if v_sender is null then
    return json_build_object('delivered', false, 'reason', 'not_authenticated');
  end if;
  if v_sender = p_recipient_id then
    return json_build_object('delivered', false, 'reason', 'self');
  end if;

  -- Both must belong to the group.
  if not exists (select 1 from group_members where group_id = p_group_id and user_id = v_sender)
     or not exists (select 1 from group_members where group_id = p_group_id and user_id = p_recipient_id) then
    return json_build_object('delivered', false, 'reason', 'not_in_group');
  end if;

  -- One nudge per pair per group per 3 hours.
  if exists (
    select 1 from nudges
    where group_id = p_group_id
      and sender_id = v_sender
      and recipient_id = p_recipient_id
      and created_at > now() - interval '3 hours'
  ) then
    return json_build_object('delivered', false, 'reason', 'rate_limited');
  end if;

  insert into nudges (group_id, sender_id, recipient_id, delivered)
  values (p_group_id, v_sender, p_recipient_id, true);

  return json_build_object('delivered', true, 'reason', null);
end;
$$;

grant execute on function send_nudge(uuid, uuid) to authenticated;

-- The signed-in user's unseen nudges, with who sent them and for which crew.
create or replace function incoming_nudges()
returns table (
  id uuid,
  group_id uuid,
  group_name text,
  sender_name text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select n.id, n.group_id, g.name, p.display_name, n.created_at
  from nudges n
  join groups g on g.id = n.group_id
  join profiles p on p.id = n.sender_id
  where n.recipient_id = auth.uid()
    and n.seen = false
  order by n.created_at desc;
$$;

grant execute on function incoming_nudges() to authenticated;

-- Clear the signed-in user's unseen nudges once they've been shown.
create or replace function mark_nudges_seen()
returns void
language sql
security definer
set search_path = public
as $$
  update nudges set seen = true
  where recipient_id = auth.uid() and seen = false;
$$;

grant execute on function mark_nudges_seen() to authenticated;

-- ---------------------------------------------------------------
-- 2. Check-in location
-- ---------------------------------------------------------------
-- lat/lng are captured from the device when the user grants permission.
-- location_granted records whether we were allowed to read it, so a crew can
-- tell "logged at a spot" from "logged with location off".
alter table check_ins add column if not exists lat double precision;
alter table check_ins add column if not exists lng double precision;
alter table check_ins add column if not exists location_granted boolean;
