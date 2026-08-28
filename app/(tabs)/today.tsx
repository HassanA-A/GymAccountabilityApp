import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '@/lib/auth';
import { useActiveGroup } from '@/lib/active-group';
import { confirmAction, showMessage } from '@/lib/dialog';
import {
  createCheckIn,
  getIncomingNudges,
  getMyWeekStatus,
  getTodayCheckIn,
  getTodayStatus,
  markNudgesSeen,
  undoTodayCheckIn,
  type Activity,
  type CheckIn,
  type IncomingNudge,
  type WeekStatus,
} from '@/lib/db';
import { getCheckInLocation } from '@/lib/location';
import { Milo, type Mood } from '@/components/Milo';
import { Celebration } from '@/components/Celebration';
import { StreakDots } from '@/components/StreakDots';
import { Card, CrewSwitcher, PrimaryButton } from '@/components/ui';
import { success, select, tap } from '@/lib/haptics';
import { fonts, radius, space, useTheme, type ThemeColors } from '@/lib/theme';

const ACTIVITIES: { key: Activity; label: string }[] = [
  { key: 'gym', label: 'Gym' },
  { key: 'run', label: 'Run' },
  { key: 'lift', label: 'Lift' },
  { key: 'other', label: 'Other' },
];

const PRETTY_DATE = () =>
  new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

/** Milo's face + a one-liner, driven by how your week is going. */
function miloState(done: boolean, w: WeekStatus | null): { mood: Mood; line: string | null } {
  if (done) {
    const streak = w?.streak ?? 0;
    return { mood: 'pumped', line: streak > 0 ? `🔥 ${streak} week streak` : 'Milo’s proud of you.' };
  }
  if (!w) return { mood: 'happy', line: null };
  const needed = Math.max(0, w.target - w.daysThisWeek);
  if (needed === 0) return { mood: 'sleepy', line: 'Weekly goal done — rest easy. 😌' };
  if (needed >= w.daysLeftInWeek) {
    return {
      mood: 'worried',
      line:
        w.streak > 0
          ? `Don’t break your ${w.streak}-week streak — check in today.`
          : 'Cutting it close — check in today.',
    };
  }
  return {
    mood: 'happy',
    line: w.streak > 0 ? `🔥 ${w.streak} week streak — keep it alive.` : 'You’re on track this week.',
  };
}

export default function Today() {
  const { user } = useAuth();
  const { activeGroup: group, loading: groupsLoading, refreshGroups } = useActiveGroup();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [checkIn, setCheckIn] = useState<CheckIn | null>(null);
  const [status, setStatus] = useState({ inCount: 0, total: 0 });
  const [week, setWeek] = useState<WeekStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState<Activity>('gym');
  const [duration, setDuration] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [celebrateStreak, setCelebrateStreak] = useState(0);
  const [nudges, setNudges] = useState<IncomingNudge[]>([]);

  useFocusEffect(useCallback(() => {
    refreshGroups();
    let active = true;
    getIncomingNudges().then((n) => { if (active) setNudges(n); }).catch(() => {});
    return () => { active = false; };
  }, [refreshGroups]));

  async function dismissNudges() {
    setNudges([]);
    try { await markNudgesSeen(); } catch { /* best effort */ }
  }

  const onRefresh = useCallback(async () => {
    if (!user || !group) return;
    setRefreshing(true);
    try {
      await refreshGroups();
      const [ci, st, wk] = await Promise.all([
        getTodayCheckIn(group.id, user.id),
        getTodayStatus(group.id),
        getMyWeekStatus(group, user.id),
      ]);
      setCheckIn(ci);
      setStatus(st);
      setWeek(wk);
    } catch {
      // A pull-to-refresh failing silently is fine; the next load will retry.
    } finally {
      setRefreshing(false);
    }
  }, [user, group, refreshGroups]);

  useEffect(() => {
    setActivity('gym');
    setDuration(null);
    setNote('');
    setPhoto(null);
  }, [group?.id]);

  useEffect(() => {
    if (!user || groupsLoading) return;
    if (!group) {
      setCheckIn(null);
      setStatus({ inCount: 0, total: 0 });
      setLoading(false);
      return;
    }

    let current = true;
    setLoading(true);
    setCheckIn(null);
    Promise.all([
      getTodayCheckIn(group.id, user.id),
      getTodayStatus(group.id),
      getMyWeekStatus(group, user.id),
    ])
      .then(([ci, st, wk]) => {
        if (!current) return;
        setCheckIn(ci);
        setStatus(st);
        setWeek(wk);
      })
      .catch((error) => {
        if (current) showMessage('Could not load today', error instanceof Error ? error.message : 'Please try again.');
      })
      .finally(() => current && setLoading(false));
    return () => { current = false; };
  }, [group?.id, groupsLoading, user]);

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      showMessage('Camera access needed', 'Turn on camera access in Settings to snap a check-in photo.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.6, allowsEditing: true, aspect: [4, 5] });
    if (!res.canceled) setPhoto(res.assets[0].uri);
  }

  async function pickPhoto() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
      allowsEditing: true,
      aspect: [4, 5],
    });
    if (!res.canceled) setPhoto(res.assets[0].uri);
  }

  async function submit() {
    if (!group || !user) return;
    tap();
    setSubmitting(true);
    try {
      // Try to confirm they're actually out moving. Never block the check-in on
      // it — a denied/unavailable fix just logs without coordinates.
      const loc = await getCheckInLocation();
      const ci = await createCheckIn({
        groupId: group.id,
        userId: user.id,
        activity,
        note,
        photoUri: photo,
        durationMin: duration,
        lat: loc.status === 'granted' ? loc.lat : null,
        lng: loc.status === 'granted' ? loc.lng : null,
        locationGranted: loc.status === 'granted',
      });
      success();
      setCheckIn(ci);
      setPhoto(null);
      setNote('');
      setDuration(null);
      const [st, wk] = await Promise.all([getTodayStatus(group.id), getMyWeekStatus(group, user.id)]);
      setStatus(st);
      setWeek(wk);
      setCelebrateStreak(wk.streak);
      setCelebrate(true);
    } catch (error) {
      showMessage('Could not check in', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmUndo() {
    if (!checkIn) return;
    const shouldUndo = await confirmAction({
      title: 'Undo check-in?',
      message: `This removes today’s check-in from ${group?.name ?? 'this crew'}.`,
      confirmLabel: 'Undo',
      cancelLabel: 'Keep it',
      destructive: true,
    });
    if (!shouldUndo) return;
    try {
      tap();
      await undoTodayCheckIn(checkIn.id);
      setCheckIn(null);
      if (group) {
        setStatus(await getTodayStatus(group.id));
        if (user) setWeek(await getMyWeekStatus(group, user.id));
      }
    } catch (error) {
      showMessage('Could not undo', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  if (loading || groupsLoading) {
    return <SafeAreaView style={styles.center}><ActivityIndicator color={colors.coral} /></SafeAreaView>;
  }

  if (!group) {
    return <SafeAreaView style={styles.center}><Text style={styles.empty}>No crew yet.</Text></SafeAreaView>;
  }

  const done = !!checkIn;
  const milo = miloState(done, week);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.coral} colors={[colors.coral]} />
        }
      >
        <Text style={styles.title}>Today</Text>
        <Text style={styles.date}>{PRETTY_DATE()}</Text>
        <CrewSwitcher />

        {nudges.length > 0 && (
          <Pressable onPress={dismissNudges} style={styles.nudgeBanner}>
            <Text style={styles.nudgeBannerIcon}>👋</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.nudgeBannerText}>{nudgeLine(nudges)}</Text>
              <Text style={styles.nudgeBannerSub}>Tap to dismiss</Text>
            </View>
          </Pressable>
        )}

        <View style={styles.miloWrap}>
          <Milo mood={milo.mood} size={168} />
          {milo.line ? <Text style={styles.miloLine}>{milo.line}</Text> : null}
          {(week?.streak ?? 0) > 0 ? <StreakDots width={260} /> : null}
        </View>

        {done ? (
          <Card style={styles.doneCard}>
            <Text style={styles.doneTitle}>You showed up! 🎉</Text>
            <Text style={styles.doneSub}>{labelFor(checkIn.activity)} · {group.name}</Text>
            {checkIn.location_granted === true ? (
              <Text style={styles.locOk}>📍 Location confirmed</Text>
            ) : checkIn.location_granted === false ? (
              <Text style={styles.locOff}>
                📍 Location was off — turn it on to confirm you’re at the gym.
              </Text>
            ) : null}
            {checkIn.note ? <Text style={styles.doneNote}>{checkIn.note}</Text> : null}
            {checkIn.photo_url && (
              <Image source={{ uri: checkIn.photo_url }} style={styles.donePhoto} contentFit="cover" />
            )}
            <Pressable onPress={confirmUndo} style={styles.undo}>
              <Text style={styles.undoText}>Undo</Text>
            </Pressable>
          </Card>
        ) : (
          <Card>
            <Text style={styles.prompt}>Did you move today?</Text>
            <Text style={styles.checkingInto}>Checking in to {group.name}</Text>

            <View style={styles.chips}>
              {ACTIVITIES.map((item) => (
                <Pressable
                  key={item.key}
                  onPress={() => {
                    select();
                    setActivity(item.key);
                  }}
                  style={[styles.chip, activity === item.key && styles.chipOn]}
                >
                  <Text style={[styles.chipText, activity === item.key && styles.chipTextOn]}>{item.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.durationLabel}>How long? (optional)</Text>
            <View style={styles.chips}>
              {[30, 45, 60, 90].map((min) => {
                const on = duration === min;
                return (
                  <Pressable
                    key={min}
                    onPress={() => { select(); setDuration(on ? null : min); }}
                    style={[styles.chip, on && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>
                      {min === 90 ? '1h 30m' : min === 60 ? '1h' : `${min}m`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Add a note (optional)"
              placeholderTextColor={colors.inkFaint}
              maxLength={280}
              multiline
              style={styles.noteInput}
            />
            {note.length > 240 ? <Text style={styles.noteCount}>{note.length}/280</Text> : null}

            {photo ? (
              <View style={styles.photoWrap}>
                <Image source={{ uri: photo }} style={styles.photo} contentFit="cover" />
                <Pressable onPress={() => setPhoto(null)} style={styles.photoRemove}>
                  <Text style={styles.photoRemoveText}>Remove photo</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.photoRow}>
                <PhotoButton label="Camera" onPress={takePhoto} icon="camera" />
                <PhotoButton label="Library" onPress={pickPhoto} icon="image" />
              </View>
            )}

            <View style={{ height: space(2) }} />
            <PrimaryButton label="I showed up" onPress={submit} loading={submitting} icon={<CheckIcon />} />
          </Card>
        )}

        <Text style={styles.crewLine}>
          <Text style={styles.crewCount}>{status.inCount} of {status.total}</Text>{' '}
          in {group.name} {status.inCount === 1 ? 'is' : 'are'} in today
        </Text>
      </ScrollView>
      <Celebration
        visible={celebrate}
        streak={celebrateStreak}
        onDone={() => setCelebrate(false)}
      />
    </SafeAreaView>
  );
}

function labelFor(activity: Activity) {
  return ACTIVITIES.find((item) => item.key === activity)?.label ?? 'Logged';
}

function nudgeLine(nudges: IncomingNudge[]): string {
  const names = Array.from(new Set(nudges.map((n) => n.sender_name)));
  if (names.length === 1) return `${names[0]} nudged you — go move today.`;
  if (names.length === 2) return `${names[0]} and ${names[1]} nudged you — go move today.`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} more nudged you — go move today.`;
}

function PhotoButton({ label, onPress, icon }: { label: string; onPress: () => void; icon: 'camera' | 'image' }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.photoBtn, pressed && { opacity: 0.6 }]}>
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        {icon === 'camera' ? (
          <>
            <Path d="M4 8.5A2.5 2.5 0 016.5 6h1l1.2-1.8a1 1 0 01.83-.45h5a1 1 0 01.83.45L16.5 6h1A2.5 2.5 0 0120 8.5v8A2.5 2.5 0 0117.5 19h-11A2.5 2.5 0 014 16.5z" stroke={colors.teal} strokeWidth={2} strokeLinejoin="round" />
            <Path d="M12 15.5a3 3 0 100-6 3 3 0 000 6z" stroke={colors.teal} strokeWidth={2} />
          </>
        ) : (
          <>
            <Path d="M4 5.5A1.5 1.5 0 015.5 4h13A1.5 1.5 0 0120 5.5v13a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 18.5z" stroke={colors.teal} strokeWidth={2} />
            <Path d="M4 16l4-4 3 3 4-5 5 6" stroke={colors.teal} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}
      </Svg>
      <Text style={styles.photoBtnText}>{label}</Text>
    </Pressable>
  );
}

function CheckIcon() {
  const { colors } = useTheme();
  return <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"><Path d="M5 12.5l4.5 4.5L19 7" stroke={colors.onCoral} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  empty: { color: colors.inkSoft, fontSize: 15, fontWeight: '600' },
  scroll: { padding: space(6), paddingBottom: space(10), gap: space(1) },
  title: { fontSize: 32, fontWeight: '800', color: colors.ink, fontFamily: fonts.display, letterSpacing: -0.5 },
  date: { fontSize: 14, color: colors.inkSoft, fontWeight: '600', marginBottom: space(2), fontFamily: fonts.ui },
  miloWrap: { alignItems: 'center', marginVertical: space(2), gap: space(1) },
  miloLine: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.inkSoft,
    textAlign: 'center',
    maxWidth: 300,
  },
  prompt: { fontSize: 19, fontWeight: '800', color: colors.ink, textAlign: 'center', fontFamily: fonts.display },
  checkingInto: { fontSize: 12, color: colors.teal, fontWeight: '700', textAlign: 'center', marginBottom: space(4) },
  durationLabel: { fontSize: 12, color: colors.inkFaint, fontWeight: '700', textAlign: 'center', marginTop: space(4), marginBottom: space(2), fontFamily: fonts.ui },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), justifyContent: 'center' },
  chip: { borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: space(4), paddingVertical: space(2.5), backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.coral, borderColor: colors.coral },
  chipText: { fontSize: 14, fontWeight: '700', color: colors.inkSoft },
  chipTextOn: { color: colors.onCoral },
  noteInput: { minHeight: 78, marginTop: space(4), paddingHorizontal: space(4), paddingVertical: space(3), textAlignVertical: 'top', borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface2, color: colors.ink, fontSize: 15 },
  noteCount: { color: colors.inkFaint, fontSize: 11, textAlign: 'right', marginTop: space(1) },
  photoRow: { flexDirection: 'row', gap: space(3), marginTop: space(4) },
  photoBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space(2), borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.md, paddingVertical: space(3.5), backgroundColor: colors.surface2 },
  photoBtnText: { color: colors.teal, fontWeight: '700', fontSize: 14 },
  photoWrap: { marginTop: space(4), alignItems: 'center', gap: space(2) },
  photo: { width: '100%', height: 220, borderRadius: radius.md, backgroundColor: colors.surface2 },
  photoRemove: { paddingVertical: space(1) },
  photoRemoveText: { color: colors.inkSoft, fontWeight: '600', fontSize: 13 },
  doneCard: { alignItems: 'center', gap: space(2) },
  doneTitle: { fontSize: 22, fontWeight: '800', color: colors.ink, fontFamily: fonts.display, letterSpacing: -0.3 },
  doneSub: { fontSize: 14, color: colors.inkSoft, fontWeight: '600', textAlign: 'center' },
  locOk: { fontSize: 13, color: colors.mint, fontWeight: '700', textAlign: 'center' },
  locOff: { fontSize: 13, color: colors.gold, fontWeight: '700', textAlign: 'center', maxWidth: 300 },
  nudgeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    backgroundColor: colors.surface2,
    borderWidth: 1.5,
    borderColor: colors.coral,
    borderRadius: radius.md,
    padding: space(3.5),
    marginTop: space(3),
  },
  nudgeBannerIcon: { fontSize: 22 },
  nudgeBannerText: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  nudgeBannerSub: { color: colors.inkFaint, fontSize: 12, fontWeight: '600', marginTop: 2 },
  doneNote: { alignSelf: 'stretch', color: colors.ink, fontSize: 14, lineHeight: 20, backgroundColor: colors.surface2, borderRadius: radius.md, padding: space(3), marginTop: space(1) },
  donePhoto: { width: '100%', height: 240, borderRadius: radius.md, marginTop: space(2), backgroundColor: colors.surface2 },
  undo: { marginTop: space(2), paddingVertical: space(2) },
  undoText: { color: colors.inkSoft, fontWeight: '600', fontSize: 14 },
  crewLine: { textAlign: 'center', color: colors.inkSoft, fontSize: 14, marginTop: space(5) },
  crewCount: { color: colors.mint, fontWeight: '800' },
});
