-- Let a user delete their own account (and everything it owns).
-- Run this in the Supabase SQL editor after 0001–0004.

-- Deleting the auth user cascades to profiles -> group_members, check_ins,
-- check_in_reactions, push_tokens, nudges. The one exception is groups.created_by
-- (ON DELETE RESTRICT), so we first hand each created crew to another member,
-- or delete it if the creator was the only one left.
create or replace function delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  g record;
  new_owner uuid;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  for g in select id from groups where created_by = uid loop
    select gm.user_id into new_owner
    from group_members gm
    where gm.group_id = g.id and gm.user_id <> uid
    order by gm.joined_at asc
    limit 1;

    if new_owner is not null then
      update groups set created_by = new_owner where id = g.id;
      update group_members set role = 'owner' where group_id = g.id and user_id = new_owner;
    else
      delete from groups where id = g.id; -- no one else left; remove the empty crew
    end if;
  end loop;

  delete from auth.users where id = uid;
end;
$$;

grant execute on function delete_own_account() to authenticated;
