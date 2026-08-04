import { useEffect, type ReactNode } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useAuth } from './auth';
import { savePushToken } from './db';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

async function registerForPushNotifications(userId: string) {
  if (Platform.OS === 'web') return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('nudges', {
      name: 'Crew nudges',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 180, 120, 180],
      lightColor: '#FF6A3D',
    });
  }

  const current = await Notifications.getPermissionsAsync();
  const permission = current.status === 'granted'
    ? current
    : await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') return;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    console.info('Push registration skipped: configure extra.eas.projectId in app.json.');
    return;
  }

  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  await savePushToken(userId, token.data);
}

export function NotificationRegistrar({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    registerForPushNotifications(user.id).catch((error) => {
      console.info('Push registration unavailable:', error instanceof Error ? error.message : error);
    });
  }, [user]);

  return children;
}
