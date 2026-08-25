-- Leave a crew / delete a crew. Run in the Supabase SQL editor after 0001–0005.

-- leave_group: remove yourself from a crew. If you created it, hand ownership
-- to the oldest remaining member first (created_by is ON DELETE RESTRICT); if
-- you were the last member, the crew is removed.
create or replace function leave_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  is_creator boolean;
  new_owner uuid;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  if not exists (select 1 from group_members where group_id = p_group_id and user_id = uid) then
    raise exception 'Not a member of this crew';
  end if;

  select (created_by = uid) into is_creator from groups where id = p_group_id;

  if is_creator then
    select gm.user_id into new_owner
    from group_members gm
    where gm.group_id = p_group_id and gm.user_id <> uid
    order by gm.joined_at asc
    limit 1;

    if new_owner is not null then
      update groups set created_by = new_owner where id = p_group_id;
      update group_members set role = 'owner' where group_id = p_group_id and user_id = new_owner;
      delete from group_members where group_id = p_group_id and user_id = uid;
    else
      delete from groups where id = p_group_id; -- last one out; remove the crew
    end if;
  else
    delete from group_members where group_id = p_group_id and user_id = uid;
  end if;
end;
$$;

-- delete_group: the creator removes the whole crew (and everyone's check-ins in it).
create or replace function delete_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  if not exists (select 1 from groups where id = p_group_id and created_by = uid) then
    raise exception 'Only the crew creator can delete it';
  end if;
  delete from groups where id = p_group_id; -- cascades to members, check-ins, reactions
end;
$$;

grant execute on function leave_group(uuid) to authenticated;
grant execute on function delete_group(uuid) to authenticated;
