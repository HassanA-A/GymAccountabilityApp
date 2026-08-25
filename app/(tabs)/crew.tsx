import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useActiveGroup } from '@/lib/active-group';
import { confirmAction, showMessage } from '@/lib/dialog';
import {
  deleteGroup,
  getCrew,
  getFeed,
  leaveGroup,
  sendNudge,
  toggleReaction,
  REACTION_EMOJIS,
  type CrewMember,
  type CrewView,
  type FeedItem,
  type ReactionSummary,
} from '@/lib/db';
import { relativeDayLabel, weekDayLabels } from '@/lib/date';
import { inviteLink } from '@/lib/pending-join';
import { select, tap } from '@/lib/haptics';
import { Avatar, Card, colorFor, CrewSwitcher } from '@/components/ui';
import { radius, space, useTheme, type ThemeColors } from '@/lib/theme';

type View2 = 'week' | 'feed';

const ACTIVITY_LABEL: Record<string, string> = { gym: 'Gym', run: 'Run', lift: 'Lift', other: 'Moved' };

export default function Crew() {
  const { user } = useAuth();
  const router = useRouter();
  const { activeGroup, loading: groupsLoading, refreshGroups } = useActiveGroup();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [crew, setCrew] = useState<CrewView | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [view, setView] = useState<View2>('week');
  const [loading, setLoading] = useState(true);
  const [nudgingId, setNudgingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(useCallback(() => {
    refreshGroups();
  }, [refreshGroups]));

  const onRefresh = useCallback(async () => {
    if (!user || !activeGroup) return;
    setRefreshing(true);
    try {
      await refreshGroups();
      const [nextCrew, nextFeed] = await Promise.all([getCrew(activeGroup, user.id), getFeed(activeGroup.id, user.id)]);
      setCrew(nextCrew);
      setFeed(nextFeed);
    } catch {
      // Silent — the pull just won't update; next focus reload will retry.
    } finally {
      setRefreshing(false);
    }
  }, [user, activeGroup, refreshGroups]);

  useEffect(() => {
    if (!user || groupsLoading) return;
    if (!activeGroup) {
      setCrew(null);
      setFeed([]);
      setLoading(false);
      return;
    }
    let current = true;
    setLoading(true);
    setCrew(null);
    Promise.all([getCrew(activeGroup, user.id), getFeed(activeGroup.id, user.id)])
      .then(([nextCrew, nextFeed]) => {
        if (!current) return;
        setCrew(nextCrew);
        setFeed(nextFeed);
      })
      .catch((error) => {
        if (current) showMessage('Could not load crew', error instanceof Error ? error.message : 'Please try again.');
      })
      .finally(() => current && setLoading(false));
    return () => { current = false; };
  }, [activeGroup?.id, groupsLoading, user]);

  async function nudge(member: CrewMember) {
    if (!crew) return;
    const confirmed = await confirmAction({
      title: `Nudge ${member.profile.display_name}?`,
      message: `They’ll see your nudge on their Today screen for ${crew.group.name}.`,
      confirmLabel: 'Send nudge',
    });
    if (!confirmed) return;

    tap();
    setNudgingId(member.profile.id);
    try {
      const result = await sendNudge(crew.group.id, member.profile.id);
      if (result.delivered) {
        showMessage('Nudge sent 👋', `${member.profile.display_name} will see it next time they open Huddle.`);
      } else if (result.reason === 'rate_limited') {
        showMessage('Already nudged', `Give ${member.profile.display_name} a little time—you can nudge them again later.`);
      } else {
        showMessage('Couldn’t send the nudge', 'Please try again in a moment.');
      }
    } catch (error) {
      showMessage('Could not send nudge', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setNudgingId(null);
    }
  }

  async function onToggleReaction(item: FeedItem, emoji: string) {
    if (!user) return;
    const wasMine = item.reactions.mine.includes(emoji);
    const snapshot = item.reactions;
    select();
    // Optimistic: update the count/highlight instantly, before the server call.
    setFeed((prev) =>
      prev.map((f) => (f.id === item.id ? { ...f, reactions: applyToggle(f.reactions, emoji, wasMine) } : f))
    );
    try {
      await toggleReaction(item.id, user.id, emoji, wasMine);
    } catch (error) {
      // Roll back to the pre-tap state.
      setFeed((prev) => prev.map((f) => (f.id === item.id ? { ...f, reactions: snapshot } : f)));
      showMessage('Could not react', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  async function shareCode() {
    if (!crew) return;
    await Share.share({
      message: `Join my crew "${crew.group.name}" on Huddle 🦆\n${inviteLink(crew.group.invite_code)}`,
    });
  }

  async function afterMembershipChange() {
    const next = await refreshGroups();
    if (!next) router.replace('/onboarding');
  }

  async function confirmLeave() {
    if (!crew) return;
    const ok = await confirmAction({
      title: `Leave ${crew.group.name}?`,
      message: 'You’ll stop seeing this crew’s check-ins. You can rejoin later with the invite code.',
      confirmLabel: 'Leave crew',
      cancelLabel: 'Stay',
      destructive: true,
    });
    if (!ok) return;
    try {
      await leaveGroup(crew.group.id);
      tap();
      await afterMembershipChange();
    } catch (e) {
      showMessage('Could not leave', e instanceof Error ? e.message : 'Please try again.');
    }
  }

  async function confirmDeleteCrew() {
    if (!crew) return;
    const ok = await confirmAction({
      title: `Delete ${crew.group.name}?`,
      message: 'This deletes the crew and everyone’s check-ins in it. This can’t be undone.',
      confirmLabel: 'Delete crew',
      cancelLabel: 'Keep crew',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteGroup(crew.group.id);
      await afterMembershipChange();
    } catch (e) {
      showMessage('Could not delete', e instanceof Error ? e.message : 'Please try again.');
    }
  }

  if (loading || groupsLoading) {
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
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.coral} colors={[colors.coral]} />
        }
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{crew.group.name}</Text>
            <Text style={styles.sub}>
              {crew.members.length} {crew.members.length === 1 ? 'friend' : 'friends'} ·{' '}
              {crew.group.target_days_per_week}× / week
            </Text>
          </View>
        </View>
        <CrewSwitcher />

        <View style={styles.segment}>
          <Seg label="This week" active={view === 'week'} onPress={() => { select(); setView('week'); }} />
          <Seg label="Feed" active={view === 'feed'} onPress={() => { select(); setView('feed'); }} />
        </View>

        {view === 'week' ? (
          <>
            <Card style={{ marginBottom: space(4) }}>
              <View style={styles.progHead}>
                <Text style={styles.progTitle}>Crew progress</Text>
                <Text style={styles.progNum}>
                  {crew.targetHit} / {crew.targetTotal} check-ins
                </Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.trackFill, { width: `${pct * 100}%` }]} />
              </View>
            </Card>

            {crew.members.map((m) => (
              <MemberRow
                key={m.profile.id}
                member={m}
                labels={labels}
                target={crew.group.target_days_per_week}
                nudging={nudgingId === m.profile.id}
                onNudge={() => nudge(m)}
              />
            ))}

            <Pressable
              onPress={shareCode}
              style={({ pressed }) => [styles.invite, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.inviteLabel}>Invite code</Text>
              <Text style={styles.inviteCode}>{crew.group.invite_code}</Text>
              <Text style={styles.inviteHint}>Tap to share</Text>
            </Pressable>

            <View style={styles.manage}>
              <Pressable onPress={confirmLeave} style={styles.manageBtn}>
                <Text style={styles.leaveText}>Leave crew</Text>
              </Pressable>
              {user?.id === crew.group.created_by && (
                <Pressable onPress={confirmDeleteCrew} style={styles.manageBtn}>
                  <Text style={styles.deleteCrewText}>Delete crew</Text>
                </Pressable>
              )}
            </View>
          </>
        ) : (
          <Feed feed={feed} onToggle={onToggleReaction} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function applyToggle(summary: ReactionSummary, emoji: string, wasMine: boolean): ReactionSummary {
  const counts = { ...summary.counts };
  counts[emoji] = (counts[emoji] ?? 0) + (wasMine ? -1 : 1);
  if (counts[emoji] <= 0) delete counts[emoji];
  const mine = wasMine ? summary.mine.filter((e) => e !== emoji) : [...summary.mine, emoji];
  return { counts, mine };
}

function Feed({ feed, onToggle }: { feed: FeedItem[]; onToggle: (item: FeedItem, emoji: string) => void }) {
  const styles = useStyles();
  if (feed.length === 0) {
    return (
      <View style={styles.feedEmpty}>
        <Text style={styles.feedEmptyText}>No check-ins yet.</Text>
        <Text style={styles.feedEmptySub}>The crew’s check-ins show up here, newest first.</Text>
      </View>
    );
  }

  let lastDay = '';
  return (
    <View>
      {feed.map((item) => {
        const showDay = item.local_date !== lastDay;
        lastDay = item.local_date;
        return (
          <View key={item.id}>
            {showDay && <Text style={styles.dayHeader}>{relativeDayLabel(item.local_date)}</Text>}
            <FeedCard item={item} onToggle={onToggle} />
          </View>
        );
      })}
    </View>
  );
}

function FeedCard({ item, onToggle }: { item: FeedItem; onToggle: (item: FeedItem, emoji: string) => void }) {
  const styles = useStyles();
  const time = new Date(item.created_at).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return (
    <View style={styles.feedCard}>
      <View style={styles.feedTop}>
        <Avatar name={item.author.display_name} color={colorFor(item.author.id)} uri={item.author.avatar_url} size={38} />
        <View style={{ flex: 1 }}>
          <Text style={styles.feedName}>{item.author.display_name}</Text>
          <Text style={styles.feedMeta}>
            {ACTIVITY_LABEL[item.activity] ?? 'Moved'} · {time}
          </Text>
        </View>
      </View>
      {item.note ? <Text style={styles.feedNote}>{item.note}</Text> : null}
      {item.photo_url ? (
        <Image source={{ uri: item.photo_url }} style={styles.feedPhoto} contentFit="cover" />
      ) : null}
      <View style={styles.reactionRow}>
        {REACTION_EMOJIS.map((emoji) => {
          const count = item.reactions.counts[emoji] ?? 0;
          const mine = item.reactions.mine.includes(emoji);
          return (
            <Pressable
              key={emoji}
              onPress={() => onToggle(item, emoji)}
              style={({ pressed }) => [styles.reaction, mine && styles.reactionOn, pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.reactionEmoji}>{emoji}</Text>
              {count > 0 ? (
                <Text style={[styles.reactionCount, mine && styles.reactionCountOn]}>{count}</Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Seg({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable onPress={onPress} style={[styles.seg, active && styles.segOn]}>
      <Text style={[styles.segText, active && styles.segTextOn]}>{label}</Text>
    </Pressable>
  );
}

function MemberRow({
  member,
  labels,
  target,
  nudging,
  onNudge,
}: {
  member: CrewMember;
  labels: string[];
  target: number;
  nudging: boolean;
  onNudge: () => void;
}) {
  const styles = useStyles();
  const behind = member.daysHit < target && !member.isMe;
  return (
    <View style={styles.row}>
      <Avatar name={member.profile.display_name} color={colorFor(member.profile.id)} uri={member.profile.avatar_url} />
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{member.isMe ? 'You' : member.profile.display_name}</Text>
        <View style={styles.week}>
          {member.days.map((hit, i) => (
            <View key={i} style={[styles.dot, hit && styles.dotHit]} />
          ))}
        </View>
      </View>
      {behind ? (
        <Pressable
          onPress={onNudge}
          disabled={nudging}
          style={[styles.nudge, nudging && { opacity: 0.55 }]}
        >
          <Text style={styles.nudgeText}>{nudging ? 'Sending…' : 'Nudge'}</Text>
        </Pressable>
      ) : member.streak > 0 ? (
        <Text style={styles.streak}>{member.streak}🔥</Text>
      ) : null}
    </View>
  );
}

function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => makeStyles(colors), [colors]);
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  empty: { color: colors.inkSoft, fontSize: 15, fontWeight: '600' },
  scroll: { padding: space(6), paddingBottom: space(10) },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: space(4) },
  title: { fontSize: 26, fontWeight: '800', color: colors.ink },
  sub: { fontSize: 13, color: colors.inkSoft, fontWeight: '600', marginTop: 2 },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surface2,
    borderRadius: radius.pill,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: space(4),
  },
  seg: { flex: 1, paddingVertical: space(2.5), borderRadius: radius.pill, alignItems: 'center' },
  segOn: { backgroundColor: colors.coral },
  segText: { fontSize: 14, fontWeight: '700', color: colors.inkSoft },
  segTextOn: { color: colors.white },
  progHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: space(2.5),
  },
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
  inviteLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  inviteCode: { fontSize: 28, fontWeight: '800', color: colors.ink, letterSpacing: 4 },
  inviteHint: { fontSize: 12, color: colors.teal, fontWeight: '700' },
  manage: { marginTop: space(5), alignItems: 'center', gap: space(1) },
  manageBtn: { paddingVertical: space(2.5), alignItems: 'center' },
  leaveText: { fontSize: 14, fontWeight: '700', color: colors.inkSoft },
  deleteCrewText: { fontSize: 14, fontWeight: '700', color: colors.danger },
  // feed
  dayHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: space(4),
    marginBottom: space(2),
  },
  feedCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: space(3.5),
    marginBottom: space(3),
    gap: space(2.5),
  },
  feedTop: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  feedName: { fontSize: 15, fontWeight: '800', color: colors.ink },
  feedMeta: { fontSize: 12.5, color: colors.inkSoft, fontWeight: '600', marginTop: 1 },
  feedNote: { fontSize: 14, color: colors.ink, lineHeight: 20 },
  feedPhoto: { width: '100%', height: 300, borderRadius: radius.md, backgroundColor: colors.surface2 },
  reactionRow: { flexDirection: 'row', gap: space(2), flexWrap: 'wrap', marginTop: space(0.5) },
  reaction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(1),
    paddingHorizontal: space(2.5),
    paddingVertical: space(1.5),
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface2,
  },
  reactionOn: { borderColor: colors.coral, backgroundColor: 'rgba(76,141,255,0.18)' },
  reactionEmoji: { fontSize: 15 },
  reactionCount: { fontSize: 13, fontWeight: '800', color: colors.inkSoft },
  reactionCountOn: { color: colors.coral },
  feedEmpty: { alignItems: 'center', paddingVertical: space(12), gap: space(2) },
  feedEmptyText: { fontSize: 16, fontWeight: '800', color: colors.ink },
  feedEmptySub: { fontSize: 13, color: colors.inkSoft, textAlign: 'center', maxWidth: 240 },
});
