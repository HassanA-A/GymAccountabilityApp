import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// A crew invite that's waiting to be redeemed. Set when someone opens a
// /join/CODE link while signed out, then consumed by the app bootstrap once
// they've signed in — so the code survives the auth round-trip.

const KEY = 'huddle.pendingJoin';

// Where shareable invite links point. Recipients open this in a browser even
// without the app, so it's always the deployed web URL.
const WEB_URL = 'https://gym-accountability-app.vercel.app';

export async function setPendingJoin(code: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, code.trim().toUpperCase());
  } catch {
    // best-effort
  }
}

/** Read and clear the pending invite code (one-shot). */
export async function takePendingJoin(): Promise<string | null> {
  try {
    const code = await AsyncStorage.getItem(KEY);
    if (code) await AsyncStorage.removeItem(KEY);
    return code;
  } catch {
    return null;
  }
}

/** Build a shareable join link for an invite code. */
export function inviteLink(code: string): string {
  const base =
    Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : WEB_URL;
  return `${base}/join/${code.toUpperCase()}`;
}
