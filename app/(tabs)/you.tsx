import { useCallback, useMemo, useState } from 'react';
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
import { useFocusEffect } from 'expo-router';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { choosePhotoSource, confirmAction, showMessage } from '@/lib/dialog';
import { deleteAccount, getMyGroups, getMyProfile, updateAvatar, type Group, type Profile } from '@/lib/db';
import { applyReminder, getReminder, REMINDER_TIMES, type Reminder } from '@/lib/reminders';
import { Card, GhostButton, colorFor } from '@/components/ui';
import { radius, space, useTheme, type ThemeColors } from '@/lib/theme';

export default function You() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [reminder, setReminder] = useState<Reminder>({ enabled: false, hour: 18 });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [p, g, r] = await Promise.all([getMyProfile(user.id), getMyGroups(), getReminder()]);
      setProfile(p);
      setGroups(g);
      setReminder(r);
    } finally {
      setLoading(false);
    }
  }, [user]);

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

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

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
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!res.canceled) applyPhoto(res.assets[0].uri);
  }

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      showMessage('Camera access needed', 'Turn on camera access to take a profile photo.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
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
      message:
        'This permanently deletes your check-ins, photos, and any crews you created. This can’t be undone.',
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
          <Pressable onPress={changePhoto} style={styles.avatarWrap}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, { backgroundColor: colorFor(user?.id ?? 'me') }]}>
                <Text style={styles.avatarLetter}>
                  {(profile?.display_name ?? 'Y').trim().charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.camBadge}>
              {uploading ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M4 8.5A2.5 2.5 0 016.5 6h1l1.2-1.8a1 1 0 01.83-.45h5a1 1 0 01.83.45L16.5 6h1A2.5 2.5 0 0120 8.5v8A2.5 2.5 0 0117.5 19h-11A2.5 2.5 0 014 16.5z"
                    stroke={colors.white}
                    strokeWidth={2}
                    strokeLinejoin="round"
                  />
                  <Path d="M12 15.5a3 3 0 100-6 3 3 0 000 6z" stroke={colors.white} strokeWidth={2} />
                </Svg>
              )}
            </View>
          </Pressable>
          <Text style={styles.name}>{profile?.display_name ?? 'You'}</Text>
          {profile?.username && <Text style={styles.handle}>@{profile.username}</Text>}
          <Text style={styles.changeHint}>Tap your photo to change it</Text>
          <Pressable onPress={() => router.push('/edit-profile')} style={styles.editBtn}>
            <Text style={styles.editBtnText}>Edit profile</Text>
          </Pressable>
        </View>

        <Card style={{ gap: space(3) }}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Your crews</Text>
            <Pressable onPress={() => router.push('/onboarding')} style={styles.addCrew}>
              <Text style={styles.addCrewText}>+ Add crew</Text>
            </Pressable>
          </View>
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

        <View style={{ height: space(4) }} />
        <Card style={{ gap: space(3) }}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Daily reminder</Text>
            <Switch
              value={reminder.enabled}
              onValueChange={toggleReminder}
              trackColor={{ true: colors.coral, false: colors.line }}
              thumbColor={colors.white}
            />
          </View>
          <Text style={styles.muted}>A gentle nudge to check in if you haven’t yet.</Text>
          {reminder.enabled && (
            <View style={styles.timeRow}>
              {REMINDER_TIMES.map((t) => (
                <Pressable
                  key={t.hour}
                  onPress={() => pickReminderTime(t.hour)}
                  style={[styles.timeChip, reminder.hour === t.hour && styles.timeChipOn]}
                >
                  <Text style={[styles.timeChipText, reminder.hour === t.hour && styles.timeChipTextOn]}>
                    {t.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          {Platform.OS === 'web' && (
            <Text style={styles.webNote}>Reminders fire in the installed app, not the web version.</Text>
          )}
        </Card>

        <View style={{ height: space(6) }} />
        <GhostButton label="Sign out" onPress={signOut} />
        <Pressable onPress={handleDelete} style={styles.deleteBtn}>
          <Text style={styles.deleteText}>Delete account</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const AVATAR = 112;

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: space(6), paddingBottom: space(10) },
  hero: { alignItems: 'center', gap: space(1), marginBottom: space(6) },
  avatarWrap: { width: AVATAR, height: AVATAR, marginBottom: space(2) },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface2,
  },
  avatarLetter: { color: colors.white, fontSize: 44, fontWeight: '800' },
  camBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.bg,
  },
  name: { fontSize: 24, fontWeight: '800', color: colors.ink, marginTop: space(1) },
  handle: { fontSize: 14, color: colors.inkSoft, fontWeight: '600' },
  changeHint: { fontSize: 12, color: colors.inkFaint, fontWeight: '600', marginTop: space(1) },
  editBtn: {
    marginTop: space(3),
    paddingHorizontal: space(5),
    paddingVertical: space(2.5),
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  editBtnText: { fontSize: 14, fontWeight: '800', color: colors.ink },
  deleteBtn: { paddingVertical: space(3), alignItems: 'center' },
  deleteText: { fontSize: 14, fontWeight: '700', color: colors.danger },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.ink },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addCrew: { paddingVertical: space(1), paddingHorizontal: space(1) },
  addCrewText: { color: colors.teal, fontSize: 13, fontWeight: '800' },
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
  timeRow: { flexDirection: 'row', gap: space(2), flexWrap: 'wrap' },
  timeChip: {
    paddingHorizontal: space(3.5),
    paddingVertical: space(2),
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface2,
  },
  timeChipOn: { backgroundColor: colors.coral, borderColor: colors.coral },
  timeChipText: { fontSize: 13, fontWeight: '700', color: colors.inkSoft },
  timeChipTextOn: { color: colors.white },
  webNote: { fontSize: 12, color: colors.inkFaint, fontStyle: 'italic' },
});
