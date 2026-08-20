import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '@/lib/auth';
import {
  createCheckIn,
  getMyGroups,
  getTodayCheckIn,
  getTodayStatus,
  undoTodayCheckIn,
  type Activity,
  type CheckIn,
  type Group,
} from '@/lib/db';
import { Milo } from '@/components/Milo';
import { Card, PrimaryButton } from '@/components/ui';
import { confirmAction, notify } from '@/lib/dialogs';
import { colors, radius, space } from '@/lib/theme';

const ACTIVITIES: { key: Activity; label: string }[] = [
  { key: 'gym', label: 'Gym' },
  { key: 'run', label: 'Run' },
  { key: 'lift', label: 'Lift' },
  { key: 'other', label: 'Other' },
];

const PRETTY_DATE = () =>
  new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

export default function Today() {
  const { user } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [checkIn, setCheckIn] = useState<CheckIn | null>(null);
  const [status, setStatus] = useState<{ inCount: number; total: number }>({ inCount: 0, total: 0 });
  const [loading, setLoading] = useState(true);

  const [activity, setActivity] = useState<Activity>('gym');
  const [photo, setPhoto] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const groups = await getMyGroups();
      const g = groups[0] ?? null;
      setGroup(g);
      if (g) {
        const [ci, st] = await Promise.all([getTodayCheckIn(g.id, user.id), getTodayStatus(g.id)]);
        setCheckIn(ci);
        setStatus(st);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      notify('Camera access needed', 'Turn on camera access in Settings to snap a check-in photo.');
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
    setSubmitting(true);
    try {
      const ci = await createCheckIn({ groupId: group.id, userId: user.id, activity, photoUri: photo });
      setCheckIn(ci);
      setPhoto(null);
      const st = await getTodayStatus(group.id);
      setStatus(st);
    } catch (e) {
      notify('Could not check in', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmUndo() {
    if (!checkIn) return;
    const ok = await confirmAction({
      title: 'Undo check-in?',
      message: 'This removes today’s check-in.',
      confirmText: 'Undo',
      cancelText: 'Keep it',
      destructive: true,
    });
    if (!ok) return;
    await undoTodayCheckIn(checkIn.id);
    setCheckIn(null);
    if (group) setStatus(await getTodayStatus(group.id));
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.coral} />
      </SafeAreaView>
    );
  }

  const done = !!checkIn;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Today</Text>
        <Text style={styles.date}>{PRETTY_DATE()}</Text>

        <View style={styles.miloWrap}>
          <Milo mood={done ? 'pumped' : 'happy'} size={168} />
        </View>

        {done ? (
          <Card style={styles.doneCard}>
            <Text style={styles.doneTitle}>You showed up! 🎉</Text>
            <Text style={styles.doneSub}>
              {checkIn?.activity ? labelFor(checkIn.activity) : 'Logged'} · Milo’s thrilled.
            </Text>
            {checkIn?.photo_url && (
              <Image source={{ uri: checkIn.photo_url }} style={styles.donePhoto} contentFit="cover" />
            )}
            <Pressable onPress={confirmUndo} style={styles.undo}>
              <Text style={styles.undoText}>Undo</Text>
            </Pressable>
          </Card>
        ) : (
          <Card>
            <Text style={styles.prompt}>Did you move today?</Text>

            <View style={styles.chips}>
              {ACTIVITIES.map((a) => (
                <Pressable
                  key={a.key}
                  onPress={() => setActivity(a.key)}
                  style={[styles.chip, activity === a.key && styles.chipOn]}
                >
                  <Text style={[styles.chipText, activity === a.key && styles.chipTextOn]}>
                    {a.label}
                  </Text>
                </Pressable>
              ))}
            </View>

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
            <PrimaryButton
              label="I showed up"
              onPress={submit}
              loading={submitting}
              icon={<CheckIcon />}
            />
          </Card>
        )}

        <Text style={styles.crewLine}>
          <Text style={styles.crewCount}>
            {status.inCount} of {status.total}
          </Text>{' '}
          of your crew {status.inCount === 1 ? 'is' : 'are'} in today
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function labelFor(a: Activity) {
  return ACTIVITIES.find((x) => x.key === a)?.label ?? 'Logged';
}

function PhotoButton({
  label,
  onPress,
  icon,
}: {
  label: string;
  onPress: () => void;
  icon: 'camera' | 'image';
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.photoBtn, pressed && { opacity: 0.6 }]}>
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        {icon === 'camera' ? (
          <>
            <Path
              d="M4 8.5A2.5 2.5 0 016.5 6h1l1.2-1.8a1 1 0 01.83-.45h5a1 1 0 01.83.45L16.5 6h1A2.5 2.5 0 0120 8.5v8A2.5 2.5 0 0117.5 19h-11A2.5 2.5 0 014 16.5z"
              stroke={colors.teal}
              strokeWidth={2}
              strokeLinejoin="round"
            />
            <Path d="M12 15.5a3 3 0 100-6 3 3 0 000 6z" stroke={colors.teal} strokeWidth={2} />
          </>
        ) : (
          <>
            <Path
              d="M4 5.5A1.5 1.5 0 015.5 4h13A1.5 1.5 0 0120 5.5v13a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 18.5z"
              stroke={colors.teal}
              strokeWidth={2}
            />
            <Path d="M4 16l4-4 3 3 4-5 5 6" stroke={colors.teal} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}
      </Svg>
      <Text style={styles.photoBtnText}>{label}</Text>
    </Pressable>
  );
}

function CheckIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12.5l4.5 4.5L19 7" stroke={colors.white} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: space(6), paddingBottom: space(10), gap: space(1) },
  title: { fontSize: 30, fontWeight: '800', color: colors.ink },
  date: { fontSize: 14, color: colors.inkSoft, fontWeight: '600', marginBottom: space(2) },
  miloWrap: { alignItems: 'center', marginVertical: space(2) },
  prompt: { fontSize: 19, fontWeight: '800', color: colors.ink, textAlign: 'center', marginBottom: space(4) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), justifyContent: 'center' },
  chip: {
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: space(4),
    paddingVertical: space(2.5),
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.coral, borderColor: colors.coral },
  chipText: { fontSize: 14, fontWeight: '700', color: colors.inkSoft },
  chipTextOn: { color: colors.white },
  photoRow: { flexDirection: 'row', gap: space(3), marginTop: space(4) },
  photoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(2),
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingVertical: space(3.5),
    backgroundColor: colors.surface2,
  },
  photoBtnText: { color: colors.teal, fontWeight: '700', fontSize: 14 },
  photoWrap: { marginTop: space(4), alignItems: 'center', gap: space(2) },
  photo: { width: '100%', height: 220, borderRadius: radius.md, backgroundColor: colors.surface2 },
  photoRemove: { paddingVertical: space(1) },
  photoRemoveText: { color: colors.inkSoft, fontWeight: '600', fontSize: 13 },
  doneCard: { alignItems: 'center', gap: space(2) },
  doneTitle: { fontSize: 20, fontWeight: '800', color: colors.ink },
  doneSub: { fontSize: 14, color: colors.inkSoft, fontWeight: '600', textAlign: 'center' },
  donePhoto: { width: '100%', height: 240, borderRadius: radius.md, marginTop: space(2), backgroundColor: colors.surface2 },
  undo: { marginTop: space(2), paddingVertical: space(2) },
  undoText: { color: colors.inkSoft, fontWeight: '600', fontSize: 14 },
  crewLine: { textAlign: 'center', color: colors.inkSoft, fontSize: 14, marginTop: space(5) },
  crewCount: { color: colors.mint, fontWeight: '800' },
});
