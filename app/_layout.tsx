import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@/lib/auth';
import { ActiveGroupProvider } from '@/lib/active-group';
import { NotificationRegistrar } from '@/lib/notifications';
import { ThemeProvider, useTheme } from '@/lib/theme';
import { Milo } from '@/components/Milo';
import { InstallPrompt } from '@/components/InstallPrompt';

function Gate() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { colors } = useTheme();

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === '(auth)';
    // /privacy is public — the App Store reviewer and anyone else can read it
    // without an account, so it must never bounce to sign-in.
    const isPublic = segments[0] === 'privacy';
    if (!session && !inAuth && !isPublic) {
      router.replace('/(auth)/sign-in');
    } else if (session && inAuth) {
      router.replace('/');
    }
  }, [session, loading, segments, router]);

  // While the saved session is still loading (happens on every reload), show
  // a splash and render nothing else. Without this, the screen you reloaded
  // mounts before auth is known and can bounce you to sign-in / break.
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <Milo mood="happy" size={140} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: 'fade',
      }}
    />
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <ActiveGroupProvider>
            <NotificationRegistrar>
              <ThemedApp />
            </NotificationRegistrar>
          </ActiveGroupProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function ThemedApp() {
  const { isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Gate />
      <InstallPrompt />
    </>
  );
}
