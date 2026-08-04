import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { ensureProfile, getMyGroups } from '@/lib/db';
import { Milo } from '@/components/Milo';
import { colors, space } from '@/lib/theme';

export default function Index() {
  const { user, loading } = useAuth();
  const [dest, setDest] = useState<'onboarding' | 'tabs' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const displayName =
          (user.user_metadata?.display_name as string) ||
          user.email?.split('@')[0] ||
          'Friend';
        const base =
          (user.email?.split('@')[0] ?? 'friend')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .slice(0, 16) || 'friend';
        const username = `${base}${Math.floor(1000 + Math.random() * 9000)}`.slice(0, 24);
        await ensureProfile(user.id, displayName, username);
        const groups = await getMyGroups();
        if (!cancelled) setDest(groups.length ? 'tabs' : 'onboarding');
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Something went wrong');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  if (!loading && !user) return null; // the Gate handles the redirect to sign-in
  if (dest === 'tabs') return <Redirect href="/(tabs)/today" />;
  if (dest === 'onboarding') return <Redirect href="/onboarding" />;

  return (
    <View style={styles.wrap}>
      <Milo mood={error ? 'worried' : 'happy'} size={150} />
      <Text style={styles.text}>{error ?? 'Warming up…'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    gap: space(3),
    padding: space(6),
  },
  text: { color: colors.inkSoft, fontSize: 15, fontWeight: '600', textAlign: 'center' },
});
