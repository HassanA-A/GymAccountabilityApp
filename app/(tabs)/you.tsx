import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { getMyGroups, getMyProfile, type Group, type Profile } from '@/lib/db';
import { Milo } from '@/components/Milo';
import { Card, GhostButton } from '@/components/ui';
import { colors, radius, space } from '@/lib/theme';

export default function You() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [p, g] = await Promise.all([getMyProfile(user.id), getMyGroups()]);
      setProfile(p);
      setGroups(g);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.coral} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Milo mood="happy" size={128} />
          <Text style={styles.name}>{profile?.display_name ?? 'You'}</Text>
          {profile?.username && <Text style={styles.handle}>@{profile.username}</Text>}
        </View>

        <Card style={{ gap: space(3) }}>
          <Text style={styles.cardTitle}>Your crews</Text>
          {groups.length === 0 ? (
            <Text style={styles.muted}>You’re not in a crew yet.</Text>
          ) : (
            groups.map((g) => (
              <View key={g.id} style={styles.crewRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.crewName}>{g.name}</Text>
                  <Text style={styles.muted}>{g.target_days_per_week}× per week</Text>
                </View>
                <View style={styles.codePill}>
                  <Text style={styles.codePillText}>{g.invite_code}</Text>
                </View>
              </View>
            ))
          )}
        </Card>

        <View style={{ height: space(6) }} />
        <GhostButton label="Sign out" onPress={signOut} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: space(6), paddingBottom: space(10) },
  hero: { alignItems: 'center', gap: space(1), marginBottom: space(6) },
  name: { fontSize: 24, fontWeight: '800', color: colors.ink, marginTop: space(2) },
  handle: { fontSize: 14, color: colors.inkSoft, fontWeight: '600' },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.ink },
  muted: { fontSize: 13, color: colors.inkSoft, fontWeight: '500' },
  crewRow: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  crewName: { fontSize: 15, fontWeight: '700', color: colors.ink },
  codePill: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: space(3),
    paddingVertical: space(1.5),
  },
  codePillText: { fontSize: 13, fontWeight: '800', color: colors.ink, letterSpacing: 2 },
});
