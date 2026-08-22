-- Feed reactions: crew members react to each other's check-ins.
-- Run this in the Supabase SQL editor after 0001–0003.

create table check_in_reactions (
  id           uuid primary key default gen_random_uuid(),
  check_in_id  uuid not null references check_ins(id) on delete cascade,
  user_id      uuid not null references profiles(id) on delete cascade,
  emoji        text not null check (char_length(emoji) <= 8),
  created_at   timestamptz not null default now(),
  unique (check_in_id, user_id, emoji)  -- one of each emoji per person per check-in
);

create index on check_in_reactions (check_in_id);

alter table check_in_reactions enable row level security;

-- Read: any member of the check-in's group can see its reactions.
create policy "members read reactions" on check_in_reactions
  for select using (
    exists (
      select 1 from check_ins c
      where c.id = check_in_id and is_group_member(c.group_id)
    )
  );

-- Insert: react only as yourself, and only on check-ins in a group you're in.
create policy "react as self" on check_in_reactions
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from check_ins c
      where c.id = check_in_id and is_group_member(c.group_id)
    )
  );

-- Delete: remove your own reaction (toggle off).
create policy "unreact own" on check_in_reactions
  for delete using (user_id = auth.uid());
