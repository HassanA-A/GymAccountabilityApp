import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

// A daily *local* reminder to check in — the retention driver that doesn't
// need any server. Scheduled on-device; the preference is remembered locally.

const STORAGE_KEY = 'huddle.reminder';
const REMINDER_ID = 'daily-check-in';

export type Reminder = { enabled: boolean; hour: number };
const DEFAULT: Reminder = { enabled: false, hour: 18 };

export const REMINDER_TIMES: { label: string; hour: number }[] = [
  { label: 'Morning', hour: 8 },
  { label: 'Midday', hour: 12 },
  { label: 'Evening', hour: 18 },
  { label: 'Night', hour: 21 },
];

export async function getReminder(): Promise<Reminder> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT, ...(JSON.parse(raw) as Partial<Reminder>) };
  } catch {
    // fall through to default
  }
  return DEFAULT;
}

async function persist(r: Reminder) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(r));
  } catch {
    // best-effort
  }
}

async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.status === 'granted';
}

/**
 * Apply a reminder setting: (re)schedule or cancel the daily notification and
 * remember the choice. Returns what was actually applied — if the user is on
 * web, or denies permission, `enabled` comes back false.
 */
export async function applyReminder(next: Reminder): Promise<Reminder> {
  if (Platform.OS === 'web') {
    await persist(next);
    return next; // no scheduling on web, but keep the preference
  }

  await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => {});

  if (next.enabled) {
    const granted = await ensurePermission();
    if (!granted) {
      const off = { ...next, enabled: false };
      await persist(off);
      return off;
    }
    await Notifications.scheduleNotificationAsync({
      identifier: REMINDER_ID,
      content: {
        title: 'Did you move today? 🦆',
        body: 'Your crew is counting on you — check in.',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: next.hour,
        minute: 0,
      },
    });
  }

  await persist(next);
  return next;
}
