import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useActiveGroup } from '@/lib/active-group';
import { ensureProfile, getMyGroups, joinGroupByCode } from '@/lib/db';
import { takePendingJoin } from '@/lib/pending-join';
import { Milo } from '@/components/Milo';
import { space, useTheme, type ThemeColors } from '@/lib/theme';

export default function Index() {
  const { user, loading } = useAuth();
  const { setActiveGroup, refreshGroups } = useActiveGroup();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [dest, setDest] = useState<'onboarding' | 'tabs' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    (async () => {
      try {
        // Google fills user_metadata with name/full_name + avatar_url/picture;
        // email/password sign-up sets display_name. Fall back to the email.
        const meta = user.user_metadata ?? {};
        const displayName =
          (meta.display_name as string) ||
          (meta.full_name as string) ||
          (meta.name as string) ||
          user.email?.split('@')[0] ||
          'Friend';
        const avatarUrl =
          (meta.avatar_url as string) || (meta.picture as string) || null;
        const base =
          (user.email?.split('@')[0] ?? 'friend')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .slice(0, 16) || 'friend';
        const username = `${base}${Math.floor(1000 + Math.random() * 9000)}`.slice(0, 24);
        await ensureProfile(user.id, displayName, username, avatarUrl);

        // Redeem a pending invite link (/join/CODE) opened before signing in.
        const pending = await takePendingJoin();
        if (pending) {
          try {
            const joined = await joinGroupByCode(pending);
            await refreshGroups();
            await setActiveGroup(joined);
            if (!cancelled) setDest('tabs');
            return;
          } catch {
            // Invalid or expired code — fall through to normal routing.
          }
        }

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

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
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
