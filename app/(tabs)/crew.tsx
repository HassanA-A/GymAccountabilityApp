import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
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
  getCrewSteps,
  getFeed,
  getTodayStatus,
  leaveGroup,
  renameGroup,
  sendNudge,
  setStepsEnabled,
  toggleReaction,
  REACTION_EMOJIS,
  type CrewMember,
  type CrewView,
  type FeedItem,
  type MemberSteps,
  type ReactionSummary,
} from '@/lib/db';
import { syncMySteps } from '@/lib/steps';
import { weekDayLabels } from '@/lib/date';
import { inviteLink } from '@/lib/pending-join';
import { select, tap } from '@/lib/haptics';
import { Avatar, colorFor, CrewSwitcher } from '@/components/ui';
import { CrewPet } from '@/components/CrewPet';
import { type Mood } from '@/components/Milo';
import { fonts, radius, space, useTheme, type ThemeColors } from '@/lib/theme';

type Tab = 'members' | 'feed' | 'board' | 'steps' | 'settings';
const BASE_TABS: { key: Tab; label: string }[] = [
  { key: 'members', label: 'Members' },
  { key: 'feed', label: 'Feed' },
  { key: 'board', label: 'Board' },
];
const SETTINGS_TAB: { key: Tab; label: string } = { key: 'settings', label: 'Settings' };

const ACTIVITY_LABEL: Record<string, string> = { gym: 'Gym', run: 'Run', lift: 'Lift', other: 'Moved' };
const ACTIVITY_EMOJI: Record<string, string> = { gym: '💪', run: '🏃', lift: '🏋️', other: '✨' };

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d === 1) return 'yesterday';
  return `${d}d ago`;
}

export default function Crew() {
  const { user } = useAuth();
  const router = useRouter();
  const { activeGroup, groups, loading: groupsLoading, refreshGroups, setActiveGroup } = useActiveGroup();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [crew, setCrew] = useState<CrewView | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [today, setToday] = useState({ inCount: 0, total: 0 });
  const [steps, setSteps] = useState<MemberSteps[]>([]);
  const [tab, setTab] = useState<Tab>('members');
  const [savingSteps, setSavingSteps] = useState(false);
  const [loading, setLoading] = useState(true);
  const [nudgingId, setNudgingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [savingName, setSavingName] = useState(false);
  const isOwner = !!crew && user?.id === crew.group.created_by;

  // Per-crew snapshot cache so switching crews swaps instantly instead of
  // flashing a spinner. We keep whatever's on screen while the newly-selected
  // crew loads in the background, then swap it in (stale-while-revalidate).
  const cacheRef = useRef<Map<string, { crew: CrewView; feed: FeedItem[]; today: { inCount: number; total: number }; steps: MemberSteps[] }>>(new Map());
  const crewRef = useRef<CrewView | null>(null);
  useEffect(() => { crewRef.current = crew; }, [crew]);

  async function submitRename() {
    if (!crew) return;
    const next = renameValue.trim();
    if (!next || next === crew.group.name) {
      setRenaming(false);
      return;
    }
    setSavingName(true);
    try {
      const updated = await renameGroup(crew.group.id, next);
      setCrew({ ...crew, group: updated });
      await refreshGroups();
      await setActiveGroup(updated);
      setRenaming(false);
    } catch (error) {
      showMessage('Could not rename crew', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSavingName(false);
    }
  }

  useFocusEffect(useCallback(() => {
    refreshGroups();
  }, [refreshGroups]));

  const load = useCallback(async () => {
    if (!user || !activeGroup) return;
    const [nextCrew, nextFeed, nextToday, nextSteps] = await Promise.all([
      getCrew(activeGroup, user.id),
      getFeed(activeGroup.id, user.id),
      getTodayStatus(activeGroup.id),
      activeGroup.steps_enabled ? getCrewSteps(activeGroup, user.id) : Promise.resolve([]),
    ]);
    cacheRef.current.set(activeGroup.id, { crew: nextCrew, feed: nextFeed, today: nextToday, steps: nextSteps });
    setCrew(nextCrew);
    setFeed(nextFeed);
    setToday(nextToday);
    setSteps(nextSteps);
  }, [user, activeGroup]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshGroups();
      await load();
    } catch {
      // Silent — the next focus reload will retry.
    } finally {
      setRefreshing(false);
    }
  }, [refreshGroups, load]);

  useEffect(() => {
    if (!user || groupsLoading) return;
    if (!activeGroup) {
      setCrew(null);
      setFeed([]);
      setToday({ inCount: 0, total: 0 });
      setLoading(false);
      return;
    }
    let current = true;
    const cached = cacheRef.current.get(activeGroup.id);
    if (cached) {
      // Seen this crew already — show it instantly, refresh quietly below.
      setCrew(cached.crew);
      setFeed(cached.feed);
      setToday(cached.today);
      setSteps(cached.steps);
      setLoading(false);
    } else if (!crewRef.current) {
      // Nothing on screen yet: only now is a spinner warranted.
      setLoading(true);
    }
    // Otherwise keep the current crew visible while the new one loads.
    load()
      .catch((error) => {
        if (current && !cached) showMessage('Could not load crew', error instanceof Error ? error.message : 'Please try again.');
      })
      .finally(() => current && setLoading(false));
    return () => { current = false; };
  }, [activeGroup?.id, groupsLoading, user, load]);

  // Once the active crew is on screen, quietly warm the other crews in the
  // background so the first switch to any of them is instant too. Best-effort:
  // one at a time, skipping any we've already cached.
  useEffect(() => {
    if (!user || groupsLoading || loading || groups.length < 2) return;
    let cancelled = false;
    (async () => {
      for (const g of groups) {
        if (cancelled) return;
        if (g.id === activeGroup?.id || cacheRef.current.has(g.id)) continue;
        try {
          const [c, f, t, s] = await Promise.all([
            getCrew(g, user.id),
            getFeed(g.id, user.id),
            getTodayStatus(g.id),
            g.steps_enabled ? getCrewSteps(g, user.id) : Promise.resolve([]),
          ]);
          if (!cancelled) cacheRef.current.set(g.id, { crew: c, feed: f, today: t, steps: s });
        } catch {
          // Prefetch is best-effort; the real switch will load it for sure.
        }
      }
    })();
    return () => { cancelled = true; };
  }, [user, groupsLoading, loading, groups, activeGroup?.id]);

  // On the Steps tab, push this phone's latest count up first, then pull the
  // crew's numbers so your own row is fresh the moment you open it.
  useEffect(() => {
    if (tab !== 'steps' || !user || !activeGroup?.steps_enabled) return;
    let active = true;
    (async () => {
      await syncMySteps(user.id).catch(() => {});
      try {
        const s = await getCrewSteps(activeGroup, user.id);
        if (!active) return;
        setSteps(s);
        const cached = cacheRef.current.get(activeGroup.id);
        if (cached) cacheRef.current.set(activeGroup.id, { ...cached, steps: s });
      } catch {
        // Keep whatever's on screen; a refresh or reopen will retry.
      }
    })();
    return () => { active = false; };
  }, [tab, activeGroup?.id, activeGroup?.steps_enabled, user]);

  async function toggleSteps(next: boolean) {
    if (!crew) return;
    setSavingSteps(true);
    try {
      const updated = await setStepsEnabled(crew.group.id, next);
      cacheRef.current.delete(updated.id); // reload cleanly with/without steps
      setCrew({ ...crew, group: updated });
      if (!next && tab === 'steps') setTab('members');
      await setActiveGroup(updated);
      await refreshGroups();
      if (next && user) syncMySteps(user.id, true).catch(() => {});
    } catch (error) {
      showMessage('Could not update steps', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSavingSteps(false);
    }
  }

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
    setFeed((prev) =>
      prev.map((f) => (f.id === item.id ? { ...f, reactions: applyToggle(f.reactions, emoji, wasMine) } : f))
    );
    try {
      await toggleReaction(item.id, user.id, emoji, wasMine);
    } catch (error) {
      setFeed((prev) => prev.map((f) => (f.id === item.id ? { ...f, reactions: snapshot } : f)));
      showMessage('Could not react', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  async function shareCode() {
    if (!crew) return;
    await Share.share({
      message: `Join my crew "${crew.group.name}" on Huddle 🐼\n${inviteLink(crew.group.invite_code)}`,
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
  const total = today.total || crew.members.length;
  const pct = total > 0 ? Math.min(1, today.inCount / total) : 0;
  const target = crew.group.target_days_per_week;

  // The Steps tab only exists when the crew has turned the feature on.
  const visibleTabs = crew.group.steps_enabled
    ? [...BASE_TABS, { key: 'steps' as Tab, label: 'Steps' }, SETTINGS_TAB]
    : [...BASE_TABS, SETTINGS_TAB];
  // If steps got turned off while it was open, fall back to Members.
  const activeTab: Tab = tab === 'steps' && !crew.group.steps_enabled ? 'members' : tab;

  // The crew pet's vibe, from how today's going.
  let petMood: Mood;
  let petMessage: string;
  if (total > 0 && today.inCount === total) {
    petMood = 'pumped';
    petMessage = 'The whole crew showed up today! 🔥';
  } else if (today.inCount > 0) {
    petMood = 'happy';
    petMessage = `${today.inCount} of ${total} in today — keep it rolling.`;
  } else {
    petMood = 'worried';
    petMessage = 'Nobody’s checked in yet today 👀';
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.coral} colors={[colors.coral]} />
        }
      >
        <CrewSwitcher />

        {/* Header */}
        <View style={styles.headRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>CREW</Text>
            <Text style={styles.title}>{crew.group.name}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.count}>{today.inCount}/{total}</Text>
            <Text style={styles.countLabel}>in today</Text>
          </View>
        </View>
        <View style={styles.track}>
          <View style={[styles.trackFill, { width: `${pct * 100}%` }]} />
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {visibleTabs.map((t) => (
            <Pressable key={t.key} onPress={() => { select(); setTab(t.key); }} style={styles.tab}>
              <Text style={[styles.tabText, activeTab === t.key && styles.tabTextOn]}>{t.label}</Text>
              {activeTab === t.key ? <View style={styles.tabUnderline} /> : null}
            </Pressable>
          ))}
        </View>

        {activeTab === 'members' && (
          <View style={{ gap: space(3) }}>
            <CrewPet mood={petMood} message={petMessage} />
            {crew.members.map((m) => (
              <MemberCard
                key={m.profile.id}
                member={m}
                labels={labels}
                target={target}
                nudging={nudgingId === m.profile.id}
                onNudge={() => nudge(m)}
              />
            ))}
            <InviteCard code={crew.group.invite_code} onShare={shareCode} />
          </View>
        )}

        {activeTab === 'feed' && <Feed feed={feed} onToggle={onToggleReaction} myUserId={user?.id} />}

        {activeTab === 'board' && <Board members={crew.members} target={target} />}

        {activeTab === 'steps' && <StepsTab steps={steps} />}

        {activeTab === 'settings' && (
          <SettingsTab
            crew={crew}
            isOwner={isOwner}
            stepsEnabled={crew.group.steps_enabled}
            savingSteps={savingSteps}
            onToggleSteps={toggleSteps}
            onRename={() => { setRenameValue(crew.group.name); setRenaming(true); }}
            onShare={shareCode}
            onLeave={confirmLeave}
            onDelete={confirmDeleteCrew}
          />
        )}
      </ScrollView>

      <Modal visible={renaming} transparent animationType="fade" onRequestClose={() => setRenaming(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => !savingName && setRenaming(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Rename crew</Text>
            <TextInput
              value={renameValue}
              onChangeText={setRenameValue}
              placeholder="Crew name"
              placeholderTextColor={colors.inkFaint}
              maxLength={40}
              autoFocus
              style={styles.modalInput}
              onSubmitEditing={submitRename}
              returnKeyType="done"
            />
            <View style={styles.modalRow}>
              <Pressable onPress={() => setRenaming(false)} style={styles.modalBtn} disabled={savingName}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </Pressable>
              <Pressable onPress={submitRename} style={[styles.modalBtn, styles.modalSave]} disabled={savingName}>
                <Text style={styles.modalSaveText}>{savingName ? 'Saving…' : 'Save'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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

function MemberCard({
  member, labels, target, nudging, onNudge,
}: {
  member: CrewMember; labels: string[]; target: number; nudging: boolean; onNudge: () => void;
}) {
  const styles = useStyles();
  const onTrack = member.daysHit >= target;
  const behind = !onTrack && !member.isMe;
  return (
    <View style={styles.memberCard}>
      <View style={styles.memberTop}>
        <Avatar name={member.profile.display_name} color={colorFor(member.profile.id)} uri={member.profile.avatar_url} size={44} />
        <View style={{ flex: 1 }}>
          <Text style={styles.memberName}>{member.isMe ? 'You' : member.profile.display_name}</Text>
          <Text style={[styles.memberStatus, onTrack ? styles.statusOk : styles.statusBehind]}>
            {onTrack ? 'On track ✓' : 'Behind this week'}
          </Text>
        </View>
        {behind ? (
          <Pressable onPress={onNudge} disabled={nudging} style={[styles.nudge, nudging && { opacity: 0.55 }]}>
            <Text style={styles.nudgeText}>{nudging ? 'Sending…' : 'Nudge 👋'}</Text>
          </Pressable>
        ) : member.streak > 0 ? (
          <Text style={styles.flame}>🔥 {member.streak}</Text>
        ) : null}
      </View>
      <View style={styles.week}>
        {member.days.map((hit, i) => (
          <View key={i} style={styles.dayCol}>
            <View style={[styles.dot, hit && styles.dotHit]}>
              {hit ? <Text style={styles.dotCheck}>✓</Text> : null}
            </View>
            <Text style={styles.dayLabel}>{labels[i]?.charAt(0)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function InviteCard({ code, onShare }: { code: string; onShare: () => void }) {
  const styles = useStyles();
  return (
    <View style={styles.invite}>
      <Text style={styles.inviteTitle}>Invite your crew</Text>
      <Text style={styles.inviteSub}>Share the code to add a member</Text>
      <View style={styles.inviteRow}>
        <Text style={styles.inviteCode}>{code}</Text>
        <Pressable onPress={onShare} style={styles.inviteBtn}>
          <Text style={styles.inviteBtnText}>Share</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Board({ members, target }: { members: CrewMember[]; target: number }) {
  const styles = useStyles();
  const ranked = [...members].sort((a, b) => b.daysHit - a.daysHit || b.streak - a.streak);
  const medals = ['🥇', '🥈', '🥉'];
  const totalSessions = members.reduce((s, m) => s + m.daysHit, 0);
  const avgStreak = members.length ? Math.round(members.reduce((s, m) => s + m.streak, 0) / members.length) : 0;

  return (
    <View style={{ gap: space(3) }}>
      {ranked.map((m, i) => {
        const pct = target > 0 ? Math.min(1, m.daysHit / target) : 0;
        return (
          <View key={m.profile.id} style={[styles.boardRow, i === 0 && styles.boardRowLead]}>
            <Text style={styles.rank}>{medals[i] ?? `${i + 1}`}</Text>
            <Avatar name={m.profile.display_name} color={colorFor(m.profile.id)} uri={m.profile.avatar_url} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={styles.memberName}>{m.isMe ? 'You' : m.profile.display_name}</Text>
              <Text style={styles.boardMeta}>{m.daysHit} this week · {m.streak} wk streak</Text>
              <View style={styles.boardTrack}><View style={[styles.boardFill, { width: `${pct * 100}%` }]} /></View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.boardNum}>{m.daysHit}</Text>
              <Text style={styles.boardNumLabel}>check-ins</Text>
            </View>
          </View>
        );
      })}

      <View style={styles.statsCard}>
        <Text style={styles.statsTitle}>Crew stats this week</Text>
        <View style={styles.statsRow}><Text style={styles.statsLabel}>🏋️ Total check-ins</Text><Text style={styles.statsVal}>{totalSessions}</Text></View>
        <View style={styles.statsRow}><Text style={styles.statsLabel}>👥 Members</Text><Text style={styles.statsVal}>{members.length}</Text></View>
        <View style={styles.statsRow}><Text style={styles.statsLabel}>🔥 Avg streak</Text><Text style={styles.statsVal}>{avgStreak} wk</Text></View>
      </View>
      <Text style={styles.boardNote}>Ranked by check-ins this week. XP &amp; medals get richer once the hours + XP features land.</Text>
    </View>
  );
}

// Thousands separators without leaning on Intl (Hermes builds vary).
function fmt(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function StepsTab({ steps }: { steps: MemberSteps[] }) {
  const styles = useStyles();
  if (steps.length === 0) {
    return (
      <View style={styles.feedEmpty}>
        <Text style={styles.feedEmptyText}>No steps yet</Text>
        <Text style={styles.feedEmptySub}>Steps sync from each member’s iPhone. Check back after a walk.</Text>
      </View>
    );
  }
  const medals = ['🥇', '🥈', '🥉'];
  const crewToday = steps.reduce((s, m) => s + m.today, 0);
  const avgToday = Math.round(crewToday / steps.length);
  const crewWeek = steps.reduce((s, m) => s + m.weekTotal, 0);
  const topToday = Math.max(1, ...steps.map((m) => m.today));

  return (
    <View style={{ gap: space(3) }}>
      <View style={styles.stepsSummary}>
        <View style={styles.stepsStat}>
          <Text style={styles.stepsBig}>{fmt(crewToday)}</Text>
          <Text style={styles.stepsSmall}>steps today</Text>
        </View>
        <View style={styles.stepsDivider} />
        <View style={styles.stepsStat}>
          <Text style={styles.stepsBig}>{fmt(avgToday)}</Text>
          <Text style={styles.stepsSmall}>avg / person</Text>
        </View>
      </View>

      {steps.map((m, i) => {
        const w = Math.min(1, m.today / topToday);
        return (
          <View key={m.profile.id} style={[styles.boardRow, i === 0 && styles.boardRowLead]}>
            <Text style={styles.rank}>{medals[i] ?? `${i + 1}`}</Text>
            <Avatar name={m.profile.display_name} color={colorFor(m.profile.id)} uri={m.profile.avatar_url} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={styles.memberName}>{m.isMe ? 'You' : m.profile.display_name}</Text>
              <Text style={styles.boardMeta}>{fmt(m.weekTotal)} steps this week</Text>
              <View style={styles.boardTrack}><View style={[styles.stepsFill, { width: `${w * 100}%` }]} /></View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.boardNum}>{fmt(m.today)}</Text>
              <Text style={styles.boardNumLabel}>today</Text>
            </View>
          </View>
        );
      })}

      <View style={styles.statsCard}>
        <Text style={styles.statsTitle}>This week</Text>
        <View style={styles.statsRow}><Text style={styles.statsLabel}>🚶 Total steps</Text><Text style={styles.statsVal}>{fmt(crewWeek)}</Text></View>
        <View style={styles.statsRow}><Text style={styles.statsLabel}>👥 Members</Text><Text style={styles.statsVal}>{steps.length}</Text></View>
      </View>
      <Text style={styles.boardNote}>Steps sync from each member’s iPhone. Ranked by steps today.</Text>
    </View>
  );
}

function SettingsTab({
  crew, isOwner, stepsEnabled, savingSteps, onToggleSteps, onRename, onShare, onLeave, onDelete,
}: {
  crew: CrewView; isOwner: boolean; stepsEnabled: boolean; savingSteps: boolean;
  onToggleSteps: (next: boolean) => void;
  onRename: () => void; onShare: () => void; onLeave: () => void; onDelete: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={{ gap: space(3) }}>
      <View style={styles.setGroup}>
        <SettingRow label="Crew name" value={crew.group.name} onPress={isOwner ? onRename : undefined} />
        <SettingRow label="Weekly goal" value={`${crew.group.target_days_per_week}× / week`} />
        <SettingRow label="Invite code" value={crew.group.invite_code} onPress={onShare} action="Share" />
      </View>

      <View style={styles.setGroup}>
        <View style={styles.setRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.setLabel}>Step tracking</Text>
            <Text style={styles.setValue}>
              {isOwner
                ? 'Show everyone’s daily steps'
                : stepsEnabled ? 'On for this crew' : 'Off for this crew'}
            </Text>
          </View>
          {savingSteps ? (
            <ActivityIndicator color={colors.coral} />
          ) : (
            <Switch
              value={stepsEnabled}
              onValueChange={onToggleSteps}
              disabled={!isOwner}
              trackColor={{ true: colors.coral, false: colors.surface2 }}
              thumbColor={colors.onCoral}
            />
          )}
        </View>
      </View>

      <View style={styles.setGroup}>
        <Pressable onPress={onLeave} style={styles.setRow}>
          <Text style={styles.leaveText}>Leave crew</Text>
        </Pressable>
        {isOwner && (
          <Pressable onPress={onDelete} style={styles.setRow}>
            <Text style={styles.deleteText}>Delete crew</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function SettingRow({ label, value, onPress, action }: { label: string; value: string; onPress?: () => void; action?: string }) {
  const styles = useStyles();
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={styles.setRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.setLabel}>{label}</Text>
        <Text style={styles.setValue}>{value}</Text>
      </View>
      {onPress ? <Text style={styles.setAction}>{action ?? 'Edit'}</Text> : null}
    </Pressable>
  );
}

function Feed({ feed, onToggle, myUserId }: { feed: FeedItem[]; onToggle: (item: FeedItem, emoji: string) => void; myUserId?: string }) {
  const styles = useStyles();
  if (feed.length === 0) {
    return (
      <View style={styles.feedEmpty}>
        <Text style={styles.feedEmptyText}>No check-ins yet.</Text>
        <Text style={styles.feedEmptySub}>The crew’s check-ins show up here, newest first.</Text>
      </View>
    );
  }
  return (
    <View style={{ gap: space(3) }}>
      <Text style={styles.feedIntro}>Recent check-ins</Text>
      {feed.map((item) => (
        <FeedCard key={item.id} item={item} onToggle={onToggle} isMine={item.user_id === myUserId} />
      ))}
    </View>
  );
}

function FeedCard({ item, onToggle, isMine }: { item: FeedItem; onToggle: (item: FeedItem, emoji: string) => void; isMine?: boolean }) {
  const styles = useStyles();
  return (
    <View style={styles.feedCard}>
      <View style={styles.feedTop}>
        <Avatar name={item.author.display_name} color={colorFor(item.author.id)} uri={item.author.avatar_url} size={38} />
        <Text style={styles.feedName}>{isMine ? 'You' : item.author.display_name}</Text>
        <Text style={styles.feedTime}>{timeAgo(item.created_at)}</Text>
      </View>
      <View style={styles.activityTag}>
        <Text style={styles.activityTagText}>
          {ACTIVITY_EMOJI[item.activity] ?? '✨'} {ACTIVITY_LABEL[item.activity] ?? 'Moved'}
        </Text>
      </View>
      {item.note ? <Text style={styles.feedNote}>{item.note}</Text> : null}
      {item.photo_url ? <Image source={{ uri: item.photo_url }} style={styles.feedPhoto} contentFit="cover" /> : null}
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
              {count > 0 ? <Text style={[styles.reactionCount, mine && styles.reactionCountOn]}>{count}</Text> : null}
            </Pressable>
          );
        })}
      </View>
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
  scroll: { padding: space(6), paddingBottom: space(12) },

  eyebrow: { fontFamily: fonts.ui, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, color: colors.inkFaint, textTransform: 'uppercase' },
  headRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space(3), marginTop: space(1) },
  title: { fontFamily: fonts.display, fontSize: 34, fontWeight: '800', color: colors.ink, letterSpacing: -0.6 },
  count: { fontFamily: fonts.display, fontSize: 26, fontWeight: '800', color: colors.mint, letterSpacing: -0.5 },
  countLabel: { fontFamily: fonts.ui, fontSize: 11, color: colors.inkFaint, fontWeight: '700', marginTop: -2 },
  track: { height: 6, borderRadius: 999, backgroundColor: colors.surface2, marginTop: space(3), overflow: 'hidden' },
  trackFill: { height: '100%', borderRadius: 999, backgroundColor: colors.mint },

  tabs: { flexDirection: 'row', gap: space(5), marginTop: space(5), marginBottom: space(5), borderBottomWidth: 1, borderBottomColor: colors.line },
  tab: { paddingBottom: space(2.5), alignItems: 'center' },
  tabText: { fontFamily: fonts.ui, fontSize: 14.5, fontWeight: '700', color: colors.inkFaint },
  tabTextOn: { color: colors.ink },
  tabUnderline: { position: 'absolute', bottom: -1, left: 0, right: 0, height: 2, borderRadius: 2, backgroundColor: colors.coral },

  // member card
  memberCard: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: space(4), gap: space(3) },
  memberTop: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  memberName: { fontFamily: fonts.display, fontSize: 16, fontWeight: '800', color: colors.ink, letterSpacing: -0.2 },
  memberStatus: { fontFamily: fonts.ui, fontSize: 12.5, fontWeight: '700', marginTop: 1 },
  statusOk: { color: colors.mint },
  statusBehind: { color: colors.inkFaint },
  nudge: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.coral, borderRadius: radius.pill, paddingHorizontal: space(3.5), paddingVertical: space(2) },
  nudgeText: { color: colors.coral, fontWeight: '800', fontSize: 12.5, fontFamily: fonts.ui },
  flame: { fontSize: 14, fontWeight: '800', color: colors.gold, fontFamily: fonts.ui },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCol: { alignItems: 'center', gap: space(1.5) },
  dot: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  dotHit: { backgroundColor: colors.mint, borderColor: colors.mint },
  dotCheck: { color: colors.onCoral, fontSize: 13, fontWeight: '900' },
  dayLabel: { fontSize: 10, color: colors.inkFaint, fontWeight: '700', fontFamily: fonts.ui },

  // invite
  invite: { backgroundColor: colors.coral, borderRadius: radius.lg, padding: space(4), gap: space(1) },
  inviteTitle: { fontFamily: fonts.display, fontSize: 17, fontWeight: '800', color: colors.onCoral },
  inviteSub: { fontFamily: fonts.ui, fontSize: 12.5, fontWeight: '600', color: colors.onCoral, opacity: 0.75 },
  inviteRow: { flexDirection: 'row', alignItems: 'center', gap: space(2), marginTop: space(3), backgroundColor: 'rgba(0,0,0,0.14)', borderRadius: radius.md, padding: space(2), paddingLeft: space(4) },
  inviteCode: { flex: 1, fontFamily: fonts.display, fontSize: 20, fontWeight: '800', letterSpacing: 1, color: colors.onCoral },
  inviteBtn: { backgroundColor: colors.onCoral, borderRadius: radius.sm, paddingHorizontal: space(4), paddingVertical: space(2.5) },
  inviteBtnText: { color: colors.coral, fontWeight: '800', fontSize: 13, fontFamily: fonts.ui },

  // board
  boardRow: { flexDirection: 'row', alignItems: 'center', gap: space(3), backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: space(3.5) },
  boardRowLead: { borderColor: colors.gold },
  rank: { width: 24, textAlign: 'center', fontSize: 16, fontWeight: '800', color: colors.inkSoft, fontFamily: fonts.ui },
  boardMeta: { fontFamily: fonts.ui, fontSize: 12, color: colors.inkFaint, fontWeight: '600', marginTop: 1 },
  boardTrack: { height: 5, borderRadius: 999, backgroundColor: colors.surface2, marginTop: space(2), overflow: 'hidden' },
  boardFill: { height: '100%', borderRadius: 999, backgroundColor: colors.gold },
  boardNum: { fontFamily: fonts.display, fontSize: 20, fontWeight: '800', color: colors.ink },
  boardNumLabel: { fontFamily: fonts.ui, fontSize: 10, color: colors.inkFaint, fontWeight: '700', marginTop: -2 },
  statsCard: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: space(4), gap: space(2), marginTop: space(1) },
  statsTitle: { fontFamily: fonts.display, fontSize: 15, fontWeight: '800', color: colors.ink, marginBottom: space(1) },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statsLabel: { fontFamily: fonts.ui, fontSize: 14, color: colors.inkSoft, fontWeight: '600' },
  statsVal: { fontFamily: fonts.display, fontSize: 16, fontWeight: '800', color: colors.ink },
  boardNote: { fontFamily: fonts.ui, fontSize: 12, color: colors.inkFaint, textAlign: 'center', marginTop: space(1), lineHeight: 17 },

  // steps
  stepsSummary: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: space(4), alignItems: 'center' },
  stepsStat: { flex: 1, alignItems: 'center', gap: 2 },
  stepsBig: { fontFamily: fonts.display, fontSize: 26, fontWeight: '800', color: colors.ink, letterSpacing: -0.5 },
  stepsSmall: { fontFamily: fonts.ui, fontSize: 12, fontWeight: '700', color: colors.inkFaint },
  stepsDivider: { width: 1, alignSelf: 'stretch', backgroundColor: colors.line, marginVertical: space(1) },
  stepsFill: { height: '100%', borderRadius: 999, backgroundColor: colors.teal },

  // settings
  setGroup: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space(4), paddingVertical: space(4), borderTopWidth: 1, borderTopColor: colors.line },
  setLabel: { fontFamily: fonts.ui, fontSize: 12.5, color: colors.inkFaint, fontWeight: '700' },
  setValue: { fontFamily: fonts.ui, fontSize: 15, color: colors.ink, fontWeight: '600', marginTop: 1 },
  setAction: { fontFamily: fonts.ui, fontSize: 13, color: colors.coral, fontWeight: '800' },
  leaveText: { fontFamily: fonts.ui, fontSize: 15, color: colors.inkSoft, fontWeight: '700' },
  deleteText: { fontFamily: fonts.ui, fontSize: 15, color: colors.danger, fontWeight: '700' },

  // feed
  feedIntro: { fontFamily: fonts.ui, fontSize: 13, color: colors.inkFaint, fontWeight: '700' },
  feedEmpty: { alignItems: 'center', paddingVertical: space(10), gap: space(1) },
  feedEmptyText: { fontFamily: fonts.display, color: colors.ink, fontSize: 17, fontWeight: '800' },
  feedEmptySub: { color: colors.inkFaint, fontSize: 13, textAlign: 'center' },
  feedCard: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: space(4), gap: space(2.5) },
  feedTop: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  feedName: { flex: 1, fontFamily: fonts.display, fontSize: 15, fontWeight: '800', color: colors.ink },
  feedTime: { fontFamily: fonts.ui, fontSize: 12, color: colors.inkFaint, fontWeight: '600' },
  activityTag: { alignSelf: 'flex-start', backgroundColor: colors.surface2, borderRadius: radius.pill, paddingHorizontal: space(3), paddingVertical: space(1.5) },
  activityTagText: { fontFamily: fonts.ui, fontSize: 12, fontWeight: '700', color: colors.inkSoft },
  feedNote: { fontFamily: fonts.ui, fontSize: 14.5, color: colors.ink, lineHeight: 20 },
  feedPhoto: { width: '100%', height: 220, borderRadius: radius.md, backgroundColor: colors.surface2 },
  reactionRow: { flexDirection: 'row', gap: space(2), marginTop: space(1) },
  reaction: { flexDirection: 'row', alignItems: 'center', gap: space(1), backgroundColor: colors.surface2, borderRadius: radius.pill, paddingHorizontal: space(3), paddingVertical: space(1.5) },
  reactionOn: { backgroundColor: 'rgba(220,185,133,0.18)' },
  reactionEmoji: { fontSize: 15 },
  reactionCount: { fontFamily: fonts.ui, fontSize: 12, fontWeight: '800', color: colors.inkSoft },
  reactionCountOn: { color: colors.coral },

  // rename modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: space(6) },
  modalCard: { width: '100%', maxWidth: 380, backgroundColor: colors.surface, borderRadius: radius.lg, padding: space(5), gap: space(4) },
  modalTitle: { fontFamily: fonts.display, fontSize: 18, fontWeight: '800', color: colors.ink },
  modalInput: { borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface2, color: colors.ink, fontSize: 16, paddingHorizontal: space(4), paddingVertical: space(3) },
  modalRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: space(2) },
  modalBtn: { paddingVertical: space(2.5), paddingHorizontal: space(4), borderRadius: radius.md },
  modalCancel: { fontSize: 15, fontWeight: '700', color: colors.inkSoft },
  modalSave: { backgroundColor: colors.coral },
  modalSaveText: { fontSize: 15, fontWeight: '800', color: colors.onCoral },
});
