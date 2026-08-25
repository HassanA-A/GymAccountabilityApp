import { Platform } from 'react-native';

export type LocationResult =
  | { status: 'granted'; lat: number; lng: number }
  | { status: 'denied' }
  | { status: 'unavailable' };

// Grab a coarse fix for a check-in. On web we use the browser's Geolocation
// API; on native we lazily load expo-location (kept out of the web bundle).
// We never block the check-in on this — a denied/unavailable result just means
// we log without coordinates and tell the user location is off.
export async function getCheckInLocation(): Promise<LocationResult> {
  try {
    if (Platform.OS === 'web') {
      return await webLocation();
    }
    return await nativeLocation();
  } catch {
    return { status: 'unavailable' };
  }
}

function webLocation(): Promise<LocationResult> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve({ status: 'unavailable' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ status: 'granted', lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => resolve({ status: err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable' }),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 }
    );
  });
}

async function nativeLocation(): Promise<LocationResult> {
  const Location = await import('expo-location');
  const perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted) return { status: 'denied' };
  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return { status: 'granted', lat: pos.coords.latitude, lng: pos.coords.longitude };
}
