import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { getCrew, getMyGroups, type CrewMember, type CrewView } from '@/lib/db';
import { weekDayLabels } from '@/lib/date';
import { Avatar, Card, colorFor } from '@/components/ui';
import { colors, radius, space } from '@/lib/theme';

export default function Crew() {
  const { user } = useAuth();
  const [crew, setCrew] = useState<CrewView | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const groups = await getMyGroups();
      if (!groups[0]) {
        setCrew(null);
        return;
      }
      setCrew(await getCrew(groups[0], user.id));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function shareCode() {
    if (!crew) return;
    await Share.share({
      message: `Join my crew "${crew.group.name}" on Huddle — invite code ${crew.group.invite_code}`,
    });
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.coral} />
      </SafeAreaView>
    );
  }

  if (!crew) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.empty}>No crew yet.</Text>
      </SafeAreaView>
    );
  }

  const labels = weekDayLabels(crew.group.week_start_dow);
  const pct = crew.targetTotal > 0 ? Math.min(1, crew.targetHit / crew.targetTotal) : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{crew.group.name}</Text>
            <Text style={styles.sub}>
              {crew.members.length} {crew.members.length === 1 ? 'friend' : 'friends'}
            </Text>
          </View>
          <View style={styles.goalChip}>
            <Text style={styles.goalChipText}>{crew.group.target_days_per_week}× / week</Text>
          </View>
        </View>

        <Card style={{ marginBottom: space(4) }}>
          <View style={styles.progHead}>
            <Text style={styles.progTitle}>This week</Text>
            <Text style={styles.progNum}>
              {crew.targetHit} / {crew.targetTotal} check-ins
            </Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.trackFill, { width: `${pct * 100}%` }]} />
          </View>
        </Card>

        {crew.members.map((m) => (
          <MemberRow key={m.profile.id} member={m} labels={labels} target={crew.group.target_days_per_week} />
        ))}

        <Pressable onPress={shareCode} style={({ pressed }) => [styles.invite, pressed && { opacity: 0.7 }]}>
          <Text style={styles.inviteLabel}>Invite code</Text>
          <Text style={styles.inviteCode}>{crew.group.invite_code}</Text>
          <Text style={styles.inviteHint}>Tap to share</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function MemberRow({
  member,
  labels,
  target,
}: {
  member: CrewMember;
  labels: string[];
  target: number;
}) {
  const behind = member.daysHit < target && !member.isMe;
  return (
    <View style={styles.row}>
      <Avatar name={member.profile.display_name} color={colorFor(member.profile.id)} />
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>
          {member.isMe ? 'You' : member.profile.display_name}
        </Text>
        <View style={styles.week}>
          {member.days.map((hit, i) => (
            <View key={i} style={[styles.dot, hit && styles.dotHit]} />
          ))}
        </View>
      </View>
      {behind ? (
        <Pressable
          onPress={() =>
            Alert.alert('Nudge sent 👋', `${member.profile.display_name} will get a friendly reminder.`)
          }
          style={styles.nudge}
        >
          <Text style={styles.nudgeText}>Nudge</Text>
        </Pressable>
      ) : member.streak > 0 ? (
        <Text style={styles.streak}>{member.streak}🔥</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  empty: { color: colors.inkSoft, fontSize: 15, fontWeight: '600' },
  scroll: { padding: space(6), paddingBottom: space(10) },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: space(4) },
  title: { fontSize: 26, fontWeight: '800', color: colors.ink },
  sub: { fontSize: 13, color: colors.inkSoft, fontWeight: '600', marginTop: 2 },
  goalChip: {
    backgroundColor: 'rgba(26,166,184,0.14)',
    borderRadius: radius.pill,
    paddingHorizontal: space(3),
    paddingVertical: space(1.5),
  },
  goalChipText: { color: colors.teal, fontWeight: '800', fontSize: 12 },
  progHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: space(2.5) },
  progTitle: { fontSize: 15, fontWeight: '800', color: colors.ink },
  progNum: { fontSize: 12, color: colors.inkSoft, fontWeight: '600' },
  track: { height: 12, borderRadius: 8, backgroundColor: colors.mintBg, overflow: 'hidden' },
  trackFill: { height: '100%', borderRadius: 8, backgroundColor: colors.mint },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    paddingVertical: space(3),
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  name: { fontSize: 15, fontWeight: '800', color: colors.ink },
  week: { flexDirection: 'row', gap: space(1), marginTop: space(1.5) },
  dot: { width: 12, height: 12, borderRadius: 4, backgroundColor: colors.line },
  dotHit: { backgroundColor: colors.mint },
  nudge: {
    borderWidth: 1.5,
    borderColor: colors.coral,
    borderRadius: radius.pill,
    paddingHorizontal: space(3),
    paddingVertical: space(1.5),
  },
  nudgeText: { color: colors.coral, fontWeight: '800', fontSize: 12 },
  streak: { fontSize: 15, fontWeight: '800', color: colors.gold },
  invite: {
    marginTop: space(5),
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    paddingVertical: space(4),
    gap: space(1),
  },
  inviteLabel: { fontSize: 12, fontWeight: '700', color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 1 },
  inviteCode: { fontSize: 28, fontWeight: '800', color: colors.ink, letterSpacing: 4 },
  inviteHint: { fontSize: 12, color: colors.teal, fontWeight: '700' },
});
