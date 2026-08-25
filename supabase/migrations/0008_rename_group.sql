-- rename_group: the creator renames a crew. Run in the Supabase SQL editor
-- after 0001–0007. Lets people who ended up with two same-named crews
-- (e.g. both "Ben") tell them apart.
create or replace function rename_group(p_group_id uuid, p_name text)
returns groups
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  trimmed text := btrim(p_name);
  result groups;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  if trimmed = '' then
    raise exception 'Crew name cannot be empty';
  end if;
  if char_length(trimmed) > 40 then
    raise exception 'Crew name is too long';
  end if;
  if not exists (select 1 from groups where id = p_group_id and created_by = uid) then
    raise exception 'Only the crew creator can rename it';
  end if;

  update groups set name = trimmed where id = p_group_id
  returning * into result;
  return result;
end;
$$;

grant execute on function rename_group(uuid, text) to authenticated;
