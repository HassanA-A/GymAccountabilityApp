import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceRoleKey);
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  const { data: { user }, error: authError } = await admin.auth.getUser(jwt);
  if (authError || !user) return json({ error: 'Unauthorized' }, 401);

  const { groupId, recipientId } = await request.json();
  if (!groupId || !recipientId || recipientId === user.id) {
    return json({ error: 'Invalid nudge target' }, 400);
  }

  const { data: memberships } = await admin
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)
    .in('user_id', [user.id, recipientId]);
  if (new Set((memberships ?? []).map((row) => row.user_id)).size !== 2) {
    return json({ error: 'Both people must belong to this crew' }, 403);
  }

  const cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await admin
    .from('nudges')
    .select('id')
    .eq('group_id', groupId)
    .eq('sender_id', user.id)
    .eq('recipient_id', recipientId)
    .gte('created_at', cutoff)
    .limit(1);
  if (recent?.length) return json({ delivered: false, reason: 'rate_limited' });

  const [{ data: sender }, { data: group }, { data: tokens }] = await Promise.all([
    admin.from('profiles').select('display_name').eq('id', user.id).single(),
    admin.from('groups').select('name').eq('id', groupId).single(),
    admin.from('push_tokens').select('token').eq('user_id', recipientId),
  ]);

  const { data: nudge, error: logError } = await admin
    .from('nudges')
    .insert({ group_id: groupId, sender_id: user.id, recipient_id: recipientId })
    .select('id')
    .single();
  if (logError) return json({ error: logError.message }, 500);
  if (!tokens?.length) return json({ delivered: false, reason: 'not_registered' });

  const messages = tokens.map(({ token }) => ({
    to: token,
    sound: 'default',
    channelId: 'nudges',
    title: `${sender?.display_name ?? 'A crewmate'} nudged you 👋`,
    body: `Your ${group?.name ?? 'crew'} is rooting for you to show up today.`,
    data: { type: 'nudge', groupId },
  }));

  const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });
  const expoBody = await expoResponse.json();
  const tickets = Array.isArray(expoBody.data) ? expoBody.data : [expoBody.data];
  const delivered = expoResponse.ok && tickets.some((ticket) => ticket?.status === 'ok');
  await admin.from('nudges').update({ delivered }).eq('id', nudge.id);

  return json({ delivered, ...(!delivered && { reason: 'delivery_failed' }) });
});
