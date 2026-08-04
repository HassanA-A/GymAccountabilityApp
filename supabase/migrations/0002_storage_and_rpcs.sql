-- Storage + RPCs that the app relies on.
-- Run this in the Supabase SQL editor after 0001_init.sql.

-- ---------------------------------------------------------------
-- Photo storage: one public bucket for check-in photos.
-- Files are namespaced by user id: <user_id>/<group_id>/<ts>.jpg
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('check-ins', 'check-ins', true)
on conflict (id) do nothing;

-- You may upload only into your own folder.
create policy "upload own check-in photo" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'check-ins'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Anyone may read (bucket is public; photos are shown to the crew).
create policy "read check-in photos" on storage.objects
  for select
  using (bucket_id = 'check-ins');

-- You may delete only your own photos.
create policy "delete own check-in photo" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'check-ins'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------
-- create_group: insert the group AND the creator's owner membership
-- atomically. Needed because the groups SELECT policy requires
-- membership, so a plain `insert ... returning` can't read the row
-- back until the membership exists.
-- ---------------------------------------------------------------
create or replace function create_group(
  p_name text,
  p_target int default 4,
  p_week_start_dow int default 1
)
returns groups
language plpgsql
security definer
set search_path = public
as $$
declare
  g groups;
begin
  insert into groups (name, created_by, target_days_per_week, week_start_dow)
  values (p_name, auth.uid(), coalesce(p_target, 4), coalesce(p_week_start_dow, 1))
  returning * into g;

  insert into group_members (group_id, user_id, role)
  values (g.id, auth.uid(), 'owner');

  return g;
end;
$$;

-- ---------------------------------------------------------------
-- join_group_by_code: look up a group by its invite code and add the
-- caller as a member. Needed because you can't SELECT a group you're
-- not yet a member of, so you couldn't find it by code from the client.
-- ---------------------------------------------------------------
create or replace function join_group_by_code(p_code text)
returns groups
language plpgsql
security definer
set search_path = public
as $$
declare
  g groups;
begin
  select * into g from groups where invite_code = upper(p_code);
  if g.id is null then
    raise exception 'No crew found for that code';
  end if;

  insert into group_members (group_id, user_id, role)
  values (g.id, auth.uid(), 'member')
  on conflict (group_id, user_id) do nothing;

  return g;
end;
$$;

grant execute on function create_group(text, int, int) to authenticated;
grant execute on function join_group_by_code(text) to authenticated;
