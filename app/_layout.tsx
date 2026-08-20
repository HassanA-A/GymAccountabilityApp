import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@/lib/auth';
import { Milo } from '@/components/Milo';
import { colors } from '@/lib/theme';

function Gate() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === '(auth)';
    if (!session && !inAuth) {
      router.replace('/(auth)/sign-in');
    } else if (session && inAuth) {
      router.replace('/');
    }
  }, [session, loading, segments, router]);

  // While we're still reading the saved session from storage (which happens
  // asynchronously on every reload), show a splash and render NOTHING else.
  // This is the fix for the reload bug: without it, the screen you reloaded
  // would mount before we know whether you're logged in, render half-alive
  // with no user, and could bounce you to sign-in. Now no real screen mounts
  // until auth is resolved.
  if (loading) {
    return (
      <View style={styles.splash}>
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
      <AuthProvider>
        <StatusBar style="dark" />
        <Gate />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
});
