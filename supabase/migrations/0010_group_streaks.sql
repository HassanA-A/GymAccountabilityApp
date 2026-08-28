-- One call that returns every member's weekly streak for a crew, so the Crew
-- screen stops firing a separate streak query per member. Same logic as
-- weekly_streak, generalized to all members at once.
create or replace function group_streaks(p_group_id uuid)
returns table (user_id uuid, streak int)
language sql
stable
as $$
  with target as (
    select target_days_per_week, week_start_dow from groups where id = p_group_id
  ),
  weeks as (
    select
      ci.user_id,
      date_trunc('week', ci.local_date + ((8 - (select week_start_dow from target)) % 7))::date as week_key,
      count(*) as days_hit
    from check_ins ci
    where ci.group_id = p_group_id
    group by ci.user_id, 2
  ),
  hit as (
    select w.user_id, w.week_key,
           row_number() over (partition by w.user_id order by w.week_key desc) as rn
    from weeks w
    where w.days_hit >= (select target_days_per_week from target)
  ),
  maxweek as (
    select h.user_id, max(h.week_key) as mw from hit h group by h.user_id
  ),
  consecutive as (
    select h.user_id, count(*) as streak
    from hit h
    join maxweek m on m.user_id = h.user_id
    where h.week_key = m.mw - ((h.rn - 1) * interval '7 days')
    group by h.user_id
  )
  select gm.user_id, coalesce(c.streak, 0)::int as streak
  from group_members gm
  left join consecutive c on c.user_id = gm.user_id
  where gm.group_id = p_group_id;
$$;

grant execute on function group_streaks(uuid) to authenticated;
