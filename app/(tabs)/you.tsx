import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Path } from 'react-native-svg';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useActiveGroup } from '@/lib/active-group';
import { choosePhotoSource, confirmAction, showMessage } from '@/lib/dialog';
import {
  deleteAccount, getMyGroups, getMyProfile, getMyStats, updateAvatar,
  type Activity, type Group, type MyStats, type Profile,
} from '@/lib/db';
import { applyReminder, getReminder, REMINDER_TIMES, type Reminder } from '@/lib/reminders';
import { GhostButton, colorFor } from '@/components/ui';
import { fonts, radius, space, useTheme, type ThemeColors, type ThemeName } from '@/lib/theme';

const ACTIVITY_LABEL: Record<Activity, string> = { gym: 'Gym', run: 'Run', lift: 'Lift', other: 'Other' };

type Tab = 'stats' | 'settings';

export default function You() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const { activeGroup } = useActiveGroup();
  const { colors, theme, setTheme, themes } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [tab, setTab] = useState<Tab>('stats');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [stats, setStats] = useState<MyStats | null>(null);
  const [reminder, setReminder] = useState<Reminder>({ enabled: false, hour: 18 });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const loadedRef = useRef(false);

  const load = useCallback(async () => {
    if (!user) return;
    if (!loadedRef.current) setLoading(true); // spinner only on first load; refocus refreshes quietly
    try {
      const [p, g, r] = await Promise.all([getMyProfile(user.id), getMyGroups(), getReminder()]);
      setProfile(p);
      setGroups(g);
      setReminder(r);
      if (activeGroup) {
        try {
          setStats(await getMyStats(user.id, activeGroup));
        } catch {
          // Before migration 0009 (duration column) this can fail — show a
          // valid empty state rather than an endless spinner.
          setStats({ sessions: 0, hours: 0, streak: 0, weekly: [], byType: [], byDay: [] });
        }
      } else {
        setStats(null);
      }
      loadedRef.current = true;
    } finally {
      setLoading(false);
    }
  }, [user, activeGroup]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function toggleReminder(value: boolean) {
    const applied = await applyReminder({ ...reminder, enabled: value });
    setReminder(applied);
    if (value && !applied.enabled) {
      showMessage('Notifications are off', 'Enable notifications for Huddle in your settings to get reminders.');
    }
  }

  async function pickReminderTime(hour: number) {
    setReminder(await applyReminder({ ...reminder, hour }));
  }

  async function applyPhoto(uri: string) {
    if (!user) return;
    setUploading(true);
    try {
      const url = await updateAvatar(user.id, uri);
      setProfile((p) => (p ? { ...p, avatar_url: url } : p));
    } catch (e) {
      showMessage('Could not update photo', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function pickFromLibrary() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!res.canceled) applyPhoto(res.assets[0].uri);
  }

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      showMessage('Camera access needed', 'Turn on camera access to take a profile photo.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!res.canceled) applyPhoto(res.assets[0].uri);
  }

  async function changePhoto() {
    const source = await choosePhotoSource();
    if (source === 'camera') await takePhoto();
    if (source === 'library') await pickFromLibrary();
  }

  async function handleDelete() {
    const ok = await confirmAction({
      title: 'Delete your account?',
      message: 'This permanently deletes your check-ins, photos, and any crews you created. This can’t be undone.',
      confirmLabel: 'Delete account',
      cancelLabel: 'Keep account',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteAccount();
      await signOut();
    } catch (e) {
      showMessage('Could not delete account', e instanceof Error ? e.message : 'Please try again.');
    }
  }

  if (loading) {
    return <SafeAreaView style={styles.center}><ActivityIndicator color={colors.coral} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Hero */}
        <View style={styles.hero}>
          <Pressable onPress={changePhoto} style={styles.avatarWrap}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, { backgroundColor: colorFor(user?.id ?? 'me') }]}>
                <Text style={styles.avatarLetter}>{(profile?.display_name ?? 'Y').trim().charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.camBadge}>
              {uploading ? (
                <ActivityIndicator color={colors.onCoral} size="small" />
              ) : (
                <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                  <Path d="M4 8.5A2.5 2.5 0 016.5 6h1l1.2-1.8a1 1 0 01.83-.45h5a1 1 0 01.83.45L16.5 6h1A2.5 2.5 0 0120 8.5v8A2.5 2.5 0 0117.5 19h-11A2.5 2.5 0 014 16.5z" stroke={colors.onCoral} strokeWidth={2} strokeLinejoin="round" />
                  <Path d="M12 15.5a3 3 0 100-6 3 3 0 000 6z" stroke={colors.onCoral} strokeWidth={2} />
                </Svg>
              )}
            </View>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{profile?.display_name ?? 'You'}</Text>
            <Text style={styles.handle}>
              {profile?.username ? `@${profile.username}` : ''}{activeGroup ? ` · ${activeGroup.name}` : ''}
            </Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {(['stats', 'settings'] as Tab[]).map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={styles.tab}>
              <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>{t === 'stats' ? 'My Stats' : 'Profile & Settings'}</Text>
              {tab === t ? <View style={styles.tabUnderline} /> : null}
            </Pressable>
          ))}
        </View>

        {tab === 'stats' ? (
          <StatsTab stats={stats} hasCrew={!!activeGroup} />
        ) : (
          <View style={{ gap: space(4) }}>
            {/* Theme switcher */}
            <View>
              <Text style={styles.sectionLabel}>THEME</Text>
              <View style={styles.themeRow}>
                {themes.map((t) => (
                  <ThemeCard key={t.name} name={t.name} label={t.label} swatches={t.swatches} active={theme === t.name} onPress={() => setTheme(t.name)} />
                ))}
              </View>
            </View>

            {/* Crews */}
            <View style={styles.group}>
              <View style={styles.groupHead}>
                <Text style={styles.groupTitle}>Your crews</Text>
                <Pressable onPress={() => router.push('/onboarding')}><Text style={styles.addCrew}>+ Add crew</Text></Pressable>
              </View>
              {groups.length === 0 ? (
                <Text style={styles.muted}>You’re not in a crew yet.</Text>
              ) : groups.map((g) => (
                <View key={g.id} style={styles.crewRow}>
                  <Text style={styles.crewName}>{g.name}</Text>
                  <Text style={styles.muted}>{g.target_days_per_week}× / week</Text>
                </View>
              ))}
            </View>

            {/* Reminder */}
            <View style={styles.group}>
              <View style={styles.groupHead}>
                <Text style={styles.groupTitle}>Daily reminder</Text>
                <Switch value={reminder.enabled} onValueChange={toggleReminder} trackColor={{ true: colors.coral, false: colors.line }} thumbColor={colors.white} />
              </View>
              <Text style={styles.muted}>A gentle nudge to check in if you haven’t yet.</Text>
              {reminder.enabled && (
                <View style={styles.timeRow}>
                  {REMINDER_TIMES.map((t) => (
                    <Pressable key={t.hour} onPress={() => pickReminderTime(t.hour)} style={[styles.timeChip, reminder.hour === t.hour && styles.timeChipOn]}>
                      <Text style={[styles.timeChipText, reminder.hour === t.hour && styles.timeChipTextOn]}>{t.label}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {Platform.OS === 'web' && <Text style={styles.webNote}>Reminders fire in the installed app, not the web version.</Text>}
            </View>

            {/* Account */}
            <View style={styles.group}>
              <Pressable onPress={() => router.push('/edit-profile')} style={styles.linkRow}>
                <Text style={styles.linkLabel}>Edit profile</Text><Text style={styles.chev}>›</Text>
              </Pressable>
              <View style={styles.rowDivider} />
              <View style={styles.linkRow}>
                <Text style={styles.linkLabel}>About Huddle</Text><Text style={styles.muted}>v1.0</Text>
              </View>
            </View>

            <View style={{ height: space(2) }} />
            <GhostButton label="Sign out" onPress={signOut} />
            <Pressable onPress={handleDelete} style={styles.deleteBtn}><Text style={styles.deleteText}>Delete account</Text></Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatsTab({ stats, hasCrew }: { stats: MyStats | null; hasCrew: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  if (!hasCrew) return <Text style={styles.empty}>Join a crew to see your stats.</Text>;
  if (!stats) return <ActivityIndicator color={colors.coral} style={{ marginTop: space(8) }} />;

  const maxWeek = Math.max(1, ...stats.weekly.map((w) => w.hours));
  const maxType = Math.max(1, ...stats.byType.map((t) => t.sessions));
  const maxDay = Math.max(1, ...stats.byDay.map((d) => d.sessions));
  const noHours = stats.hours === 0;

  return (
    <View style={{ gap: space(4) }}>
      <View style={styles.statCards}>
        <StatCard icon="🔥" value={`${stats.streak}`} label={stats.streak === 1 ? 'week streak' : 'week streak'} />
        <StatCard icon="🏋️" value={`${stats.sessions}`} label="sessions" />
        <StatCard icon="⏱️" value={noHours ? '—' : `${stats.hours}h`} label="hours" />
      </View>

      {/* Weekly hours */}
      <View style={styles.group}>
        <Text style={styles.groupTitle}>Hours logged — last 4 weeks</Text>
        {noHours ? (
          <Text style={styles.muted}>Log a workout’s length on check-in to see your hours here.</Text>
        ) : stats.weekly.map((w) => (
          <View key={w.label} style={styles.hRow}>
            <Text style={styles.hLabel}>{w.label}</Text>
            <View style={styles.hTrack}><View style={[styles.hFill, { width: `${(w.hours / maxWeek) * 100}%` }]} /></View>
            <Text style={styles.hVal}>{w.hours}h</Text>
          </View>
        ))}
      </View>

      {/* Type breakdown */}
      {stats.byType.length > 0 && (
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Workout type breakdown</Text>
          {stats.byType.map((t) => (
            <View key={t.activity} style={styles.hRow}>
              <Text style={[styles.hLabel, { width: 44 }]}>{ACTIVITY_LABEL[t.activity]}</Text>
              <View style={styles.hTrack}><View style={[styles.hFill, { width: `${(t.sessions / maxType) * 100}%`, backgroundColor: colors.coral }]} /></View>
              <Text style={styles.hVal}>{t.sessions}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Most active days */}
      <View style={styles.group}>
        <Text style={styles.groupTitle}>Most active days</Text>
        <View style={styles.dayChart}>
          {stats.byDay.map((d, i) => (
            <View key={i} style={styles.dayBarCol}>
              <View style={styles.dayBarTrack}>
                <View style={[styles.dayBar, { height: `${(d.sessions / maxDay) * 100}%` }]} />
              </View>
              <Text style={styles.dayBarLabel}>{d.label.charAt(0)}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function StatCard({ icon, value, label }: { icon: string; value: string; label: string }) {
  const styles = useStyles();
  return (
    <View style={styles.statCard}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ThemeCard({ name, label, swatches, active, onPress }: { name: ThemeName; label: string; swatches: string[]; active: boolean; onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable onPress={onPress} style={[styles.themeCard, active && styles.themeCardOn]}>
      <Text style={styles.themeName}>{label}</Text>
      <View style={styles.swatches}>
        {swatches.map((c, i) => <View key={i} style={[styles.swatch, { backgroundColor: c }]} />)}
      </View>
      {active ? <Text style={styles.themeCheck}>✓</Text> : null}
    </Pressable>
  );
}

function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => makeStyles(colors), [colors]);
}

const AVATAR = 76;

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: space(6), paddingBottom: space(12) },
  empty: { color: colors.inkSoft, fontSize: 14, textAlign: 'center', marginTop: space(8), fontWeight: '600' },

  hero: { flexDirection: 'row', alignItems: 'center', gap: space(4), marginBottom: space(5) },
  avatarWrap: { width: AVATAR, height: AVATAR },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface2 },
  avatarLetter: { color: colors.white, fontSize: 30, fontWeight: '800', fontFamily: fonts.display },
  camBadge: { position: 'absolute', right: -2, bottom: -2, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.bg },
  name: { fontSize: 26, fontWeight: '800', color: colors.ink, fontFamily: fonts.display, letterSpacing: -0.4 },
  handle: { fontSize: 13.5, color: colors.inkSoft, fontWeight: '600', marginTop: 1 },

  tabs: { flexDirection: 'row', gap: space(5), marginBottom: space(5), borderBottomWidth: 1, borderBottomColor: colors.line },
  tab: { paddingBottom: space(2.5) },
  tabText: { fontFamily: fonts.ui, fontSize: 14.5, fontWeight: '700', color: colors.inkFaint },
  tabTextOn: { color: colors.ink },
  tabUnderline: { position: 'absolute', bottom: -1, left: 0, right: 0, height: 2, borderRadius: 2, backgroundColor: colors.coral },

  // stat cards
  statCards: { flexDirection: 'row', gap: space(3) },
  statCard: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, paddingVertical: space(4), alignItems: 'center', gap: space(1) },
  statIcon: { fontSize: 20 },
  statValue: { fontFamily: fonts.display, fontSize: 22, fontWeight: '800', color: colors.ink, letterSpacing: -0.5 },
  statLabel: { fontFamily: fonts.ui, fontSize: 11, color: colors.inkFaint, fontWeight: '700', textAlign: 'center' },

  group: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: space(4), gap: space(3) },
  groupHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  groupTitle: { fontFamily: fonts.display, fontSize: 15, fontWeight: '800', color: colors.ink },
  muted: { fontSize: 13, color: colors.inkSoft, fontWeight: '500', fontFamily: fonts.ui },

  // horizontal bars (weekly hours + type)
  hRow: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  hLabel: { width: 56, fontSize: 13, color: colors.inkSoft, fontWeight: '700', fontFamily: fonts.ui },
  hTrack: { flex: 1, height: 8, borderRadius: 999, backgroundColor: colors.surface2, overflow: 'hidden' },
  hFill: { height: '100%', borderRadius: 999, backgroundColor: colors.gold },
  hVal: { width: 40, textAlign: 'right', fontSize: 13, fontWeight: '800', color: colors.ink, fontFamily: fonts.ui },

  // day chart
  dayChart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 96, gap: space(2) },
  dayBarCol: { flex: 1, alignItems: 'center', gap: space(1.5), height: '100%', justifyContent: 'flex-end' },
  dayBarTrack: { width: '100%', flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  dayBar: { width: '72%', minHeight: 4, borderRadius: 5, backgroundColor: colors.coral },
  dayBarLabel: { fontSize: 10, color: colors.inkFaint, fontWeight: '700', fontFamily: fonts.ui },

  // theme switcher
  sectionLabel: { fontFamily: fonts.ui, fontSize: 11, fontWeight: '800', letterSpacing: 1, color: colors.inkFaint, marginBottom: space(2) },
  themeRow: { flexDirection: 'row', gap: space(3) },
  themeCard: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.line, padding: space(4), alignItems: 'center', gap: space(2) },
  themeCardOn: { borderColor: colors.coral },
  themeName: { fontFamily: fonts.display, fontSize: 14, fontWeight: '800', color: colors.ink },
  swatches: { flexDirection: 'row', gap: space(1) },
  swatch: { width: 12, height: 12, borderRadius: 6 },
  themeCheck: { color: colors.coral, fontWeight: '900', fontSize: 14 },

  // crews / rows
  addCrew: { color: colors.teal, fontSize: 13, fontWeight: '800', fontFamily: fonts.ui },
  crewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  crewName: { fontSize: 15, fontWeight: '700', color: colors.ink, fontFamily: fonts.ui },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  linkLabel: { fontSize: 15, fontWeight: '700', color: colors.ink, fontFamily: fonts.ui },
  chev: { fontSize: 22, color: colors.inkFaint, fontWeight: '400' },
  rowDivider: { height: 1, backgroundColor: colors.line },

  timeRow: { flexDirection: 'row', gap: space(2), flexWrap: 'wrap' },
  timeChip: { paddingHorizontal: space(3.5), paddingVertical: space(2), borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface2 },
  timeChipOn: { backgroundColor: colors.coral, borderColor: colors.coral },
  timeChipText: { fontSize: 13, fontWeight: '700', color: colors.inkSoft, fontFamily: fonts.ui },
  timeChipTextOn: { color: colors.onCoral },
  webNote: { fontSize: 12, color: colors.inkFaint, fontStyle: 'italic' },

  deleteBtn: { paddingVertical: space(3), alignItems: 'center' },
  deleteText: { fontSize: 14, fontWeight: '700', color: colors.danger, fontFamily: fonts.ui },
});
