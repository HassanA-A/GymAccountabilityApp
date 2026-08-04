import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Path } from 'react-native-svg';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { getMyGroups, getMyProfile, updateAvatar, type Group, type Profile } from '@/lib/db';
import { Card, GhostButton, colorFor } from '@/components/ui';
import { colors, radius, space } from '@/lib/theme';

export default function You() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

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

  async function applyPhoto(uri: string) {
    if (!user) return;
    setUploading(true);
    try {
      const url = await updateAvatar(user.id, uri);
      setProfile((p) => (p ? { ...p, avatar_url: url } : p));
    } catch (e) {
      Alert.alert('Could not update photo', e instanceof Error ? e.message : 'Please try again.');
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
      Alert.alert('Camera access needed', 'Turn on camera access to take a profile photo.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!res.canceled) applyPhoto(res.assets[0].uri);
  }

  function changePhoto() {
    // Camera isn't meaningful in a desktop browser — go straight to the picker.
    if (Platform.OS === 'web') {
      pickFromLibrary();
      return;
    }
    Alert.alert('Profile photo', undefined, [
      { text: 'Take photo', onPress: takePhoto },
      { text: 'Choose from library', onPress: pickFromLibrary },
      { text: 'Cancel', style: 'cancel' },
    ]);
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

const AVATAR = 112;

const styles = StyleSheet.create({
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
