-- Make nudges fire a real push notification, not just an in-app banner.
--
-- No Edge Function needed: Expo's push endpoint (exp.host) is an open API keyed
-- by the device token, so we POST to it straight from the database using pg_net.
-- send_nudge already runs as a security-definer RPC with membership checks and
-- rate limiting, so we just look up the recipient's tokens and send.

create extension if not exists pg_net;

create or replace function send_nudge(p_group_id uuid, p_recipient_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender      uuid := auth.uid();
  v_sender_name text;
  v_group_name  text;
  v_title       text;
  v_body        text;
  v_messages    jsonb;
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

  -- Fire a push to every device the recipient has registered. Best-effort: a
  -- failure here must never fail the nudge, which is already recorded above.
  begin
    select display_name into v_sender_name from profiles where id = v_sender;
    select name into v_group_name from groups where id = p_group_id;
    v_title := coalesce(v_sender_name, 'A crewmate') || ' nudged you 👋';
    v_body  := 'Go move today for ' || coalesce(v_group_name, 'your crew') || '.';

    select jsonb_agg(jsonb_build_object(
      'to', pt.token,
      'title', v_title,
      'body', v_body,
      'sound', 'default',
      'channelId', 'nudges',
      'priority', 'high',
      'data', jsonb_build_object('type', 'nudge', 'groupId', p_group_id)
    ))
    into v_messages
    from push_tokens pt
    where pt.user_id = p_recipient_id;

    if v_messages is not null then
      perform net.http_post(
        url     := 'https://exp.host/--/api/v2/push/send',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body    := v_messages
      );
    end if;
  exception when others then
    -- swallow: push delivery is a bonus on top of the in-app nudge
    null;
  end;

  return json_build_object('delivered', true, 'reason', null);
end;
$$;

grant execute on function send_nudge(uuid, uuid) to authenticated;
