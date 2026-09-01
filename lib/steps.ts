import { Platform } from 'react-native';
import { Pedometer } from 'expo-sensors';
import { supabase } from './supabase';
import { toLocalDate } from './date';

// How many days back to sync each time. iOS Core Motion keeps ~7 days of
// history, so we can backfill the whole trailing week in one go.
const DAYS = 7;

let lastSyncAt = 0;

/**
 * Read the phone's step count for the last few days and upsert it into
 * daily_steps. Best-effort and idempotent: the pedometer is the source of
 * truth, so re-running just overwrites with the latest numbers.
 *
 * iOS only for now — Android's getStepCountAsync isn't supported the same way
 * (it needs a live subscription), so we skip it rather than store bad data.
 */
export async function syncMySteps(userId: string, force = false): Promise<void> {
  if (Platform.OS !== 'ios') return;

  // Don't hammer Core Motion / the network on every screen focus.
  if (!force && Date.now() - lastSyncAt < 60_000) return;

  const available = await Pedometer.isAvailableAsync().catch(() => false);
  if (!available) return;

  const perm = await Pedometer.getPermissionsAsync().catch(() => null);
  const granted = perm?.granted
    ? true
    : (await Pedometer.requestPermissionsAsync().catch(() => null))?.granted ?? false;
  if (!granted) return;

  const now = new Date();
  const rows: { user_id: string; local_date: string; steps: number }[] = [];

  for (let i = 0; i < DAYS; i++) {
    const start = new Date(now);
    start.setDate(now.getDate() - i);
    start.setHours(0, 0, 0, 0);
    // End is the next midnight, except today, which ends "now".
    const end = i === 0 ? now : new Date(start.getTime() + 24 * 60 * 60 * 1000);
    try {
      const { steps } = await Pedometer.getStepCountAsync(start, end);
      if (steps > 0) rows.push({ user_id: userId, local_date: toLocalDate(start), steps });
    } catch {
      // A single day failing shouldn't sink the rest.
    }
  }

  if (rows.length === 0) {
    lastSyncAt = Date.now();
    return;
  }

  const { error } = await supabase
    .from('daily_steps')
    .upsert(rows, { onConflict: 'user_id,local_date' });
  if (!error) lastSyncAt = Date.now();
}
