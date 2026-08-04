import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';
import { todayLocal, weekDates } from './date';

export type Activity = 'gym' | 'run' | 'lift' | 'other';

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  timezone: string;
};

export type Group = {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  target_days_per_week: number;
  week_start_dow: number;
};

export type CheckIn = {
  id: string;
  user_id: string;
  group_id: string;
  local_date: string;
  activity: Activity;
  note: string | null;
  photo_url: string | null;
};

export type CrewMember = {
  profile: Profile;
  days: boolean[]; // 7 flags for the current week
  daysHit: number;
  streak: number;
  isMe: boolean;
};

export type CrewView = {
  group: Group;
  members: CrewMember[];
  targetHit: number; // total check-ins this week across the crew
  targetTotal: number; // members * target
};

/** Make sure the signed-in user has a profile row. Safe to call repeatedly. */
export async function ensureProfile(
  userId: string,
  displayName: string,
  username: string
): Promise<void> {
  const { data } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle();
  if (data) return;
  const tz =
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const { error } = await supabase.from('profiles').insert({
    id: userId,
    display_name: displayName.trim() || 'Friend',
    username: username.trim().toLowerCase(),
    timezone: tz,
  });
  if (error) throw new Error(error.message);
}

export async function getMyProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  return (data as Profile) ?? null;
}

/** Groups the signed-in user belongs to. */
export async function getMyGroups(): Promise<Group[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('groups(*)')
    .order('joined_at', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []).map((row: any) => row.groups).filter(Boolean)) as Group[];
}

export async function createGroup(name: string, target: number): Promise<Group> {
  const { data, error } = await supabase.rpc('create_group', {
    p_name: name.trim(),
    p_target: target,
  });
  if (error) throw new Error(error.message);
  return data as Group;
}

export async function joinGroupByCode(code: string): Promise<Group> {
  const { data, error } = await supabase.rpc('join_group_by_code', {
    p_code: code.trim().toUpperCase(),
  });
  if (error) throw new Error(error.message);
  return data as Group;
}

export async function getTodayCheckIn(groupId: string, userId: string): Promise<CheckIn | null> {
  const { data } = await supabase
    .from('check_ins')
    .select('*')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .eq('local_date', todayLocal())
    .maybeSingle();
  return (data as CheckIn) ?? null;
}

/** How many of the crew have checked in today, and how many members total. */
export async function getTodayStatus(
  groupId: string
): Promise<{ inCount: number; total: number }> {
  const [{ count: total }, { data: today }] = await Promise.all([
    supabase
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId),
    supabase
      .from('check_ins')
      .select('user_id')
      .eq('group_id', groupId)
      .eq('local_date', todayLocal()),
  ]);
  const inCount = new Set((today ?? []).map((r: any) => r.user_id)).size;
  return { inCount, total: total ?? 0 };
}

async function uploadPhoto(userId: string, groupId: string, uri: string): Promise<string> {
  const ext = (uri.split('.').pop() || 'jpg').toLowerCase().split('?')[0];
  const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
  const path = `${userId}/${groupId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from('check-ins')
    .upload(path, decode(base64), { contentType, upsert: false });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from('check-ins').getPublicUrl(path);
  return data.publicUrl;
}

export async function createCheckIn(opts: {
  groupId: string;
  userId: string;
  activity: Activity;
  note?: string;
  photoUri?: string | null;
}): Promise<CheckIn> {
  let photo_url: string | null = null;
  if (opts.photoUri) {
    photo_url = await uploadPhoto(opts.userId, opts.groupId, opts.photoUri);
  }
  const { data, error } = await supabase
    .from('check_ins')
    .insert({
      group_id: opts.groupId,
      user_id: opts.userId,
      local_date: todayLocal(),
      activity: opts.activity,
      note: opts.note?.trim() || null,
      photo_url,
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as CheckIn;
}

export async function undoTodayCheckIn(checkInId: string): Promise<void> {
  const { error } = await supabase.from('check_ins').delete().eq('id', checkInId);
  if (error) throw new Error(error.message);
}

async function getStreak(userId: string, groupId: string): Promise<number> {
  const { data, error } = await supabase.rpc('weekly_streak', {
    p_user_id: userId,
    p_group_id: groupId,
  });
  if (error) return 0;
  return (data as number) ?? 0;
}

/** Everything the Crew screen needs: roster, this-week dots, and streaks. */
export async function getCrew(group: Group, myUserId: string): Promise<CrewView> {
  const [{ data: memberRows }, { data: checkRows }] = await Promise.all([
    supabase.from('group_members').select('profiles(*)').eq('group_id', group.id),
    supabase
      .from('check_ins')
      .select('user_id, local_date')
      .eq('group_id', group.id)
      .gte('local_date', weekDates(group.week_start_dow)[0]),
  ]);

  const week = weekDates(group.week_start_dow);
  const profiles = ((memberRows ?? []).map((r: any) => r.profiles).filter(Boolean)) as Profile[];
  const checks = (checkRows ?? []) as { user_id: string; local_date: string }[];

  const members: CrewMember[] = await Promise.all(
    profiles.map(async (profile) => {
      const mine = checks.filter((c) => c.user_id === profile.id);
      const days = week.map((d) => mine.some((c) => c.local_date === d));
      const streak = await getStreak(profile.id, group.id);
      return {
        profile,
        days,
        daysHit: days.filter(Boolean).length,
        streak,
        isMe: profile.id === myUserId,
      };
    })
  );

  // Me first, then most active.
  members.sort((a, b) => (a.isMe ? -1 : b.isMe ? 1 : b.daysHit - a.daysHit));

  const targetHit = members.reduce((sum, m) => sum + m.daysHit, 0);
  return {
    group,
    members,
    targetHit,
    targetTotal: members.length * group.target_days_per_week,
  };
}
