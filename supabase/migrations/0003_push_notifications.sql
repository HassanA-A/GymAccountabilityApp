-- Device tokens and an audit/rate-limit log for real crew nudges.
-- Deploy the send-nudge Edge Function after running this migration.

create table push_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  token      text not null unique check (token ~ '^(Exponent|Expo)PushToken\['),
  platform   text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);

create index on push_tokens (user_id);

create table nudges (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references groups(id) on delete cascade,
  sender_id    uuid not null references profiles(id) on delete cascade,
  recipient_id uuid not null references profiles(id) on delete cascade,
  delivered    boolean not null default false,
  created_at   timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

create index on nudges (group_id, sender_id, recipient_id, created_at desc);

alter table push_tokens enable row level security;
alter table nudges enable row level security;

create policy "manage own push tokens" on push_tokens
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "read own nudge history" on nudges
  for select using (sender_id = auth.uid() or recipient_id = auth.uid());

-- Inserts and delivery updates are service-role-only through the Edge Function.

-- A push token identifies an app installation. Reassign it on login so a shared
-- device never keeps delivering one account's nudges to another account.
create or replace function register_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_token !~ '^(Exponent|Expo)PushToken\[' then
    raise exception 'Invalid Expo push token';
  end if;
  if p_platform not in ('ios', 'android') then
    raise exception 'Invalid push platform';
  end if;

  delete from push_tokens where token = p_token;
  insert into push_tokens (user_id, token, platform)
  values (auth.uid(), p_token, p_platform);
end;
$$;

grant execute on function register_push_token(text, text) to authenticated;
