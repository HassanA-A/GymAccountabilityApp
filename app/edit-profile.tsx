import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { getMyProfile, updateProfile } from '@/lib/db';
import { GhostButton, PrimaryButton } from '@/components/ui';
import { radius, space, useTheme, type ThemeColors } from '@/lib/theme';

export default function EditProfile() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const profile = await getMyProfile(user.id);
      if (profile) {
        setDisplayName(profile.display_name);
        setUsername(profile.username);
      }
      setLoading(false);
    })();
  }, [user]);

  async function save() {
    if (!user) return;
    setError(null);
    if (!displayName.trim()) {
      setError('Enter your name.');
      return;
    }
    if (username.trim().length < 2) {
      setError('Username must be at least 2 characters.');
      return;
    }
    setSaving(true);
    try {
      await updateProfile(user.id, { display_name: displayName, username });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
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
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Edit profile</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Your name</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Alex"
              placeholderTextColor={colors.inkFaint}
              autoCapitalize="words"
              maxLength={40}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Username</Text>
            <View style={styles.usernameRow}>
              <Text style={styles.at}>@</Text>
              <TextInput
                style={[styles.input, styles.usernameInput]}
                value={username}
                onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="alex"
                placeholderTextColor={colors.inkFaint}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={24}
              />
            </View>
            <Text style={styles.hint}>Letters, numbers, and underscores.</Text>
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.actions}>
            <PrimaryButton label="Save" onPress={save} loading={saving} />
            <GhostButton label="Cancel" onPress={() => router.back()} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
    flex: { flex: 1 },
    scroll: { padding: space(6), gap: space(4) },
    title: { fontSize: 28, fontWeight: '800', color: colors.ink, marginBottom: space(2) },
    field: { gap: space(1.5) },
    label: { fontSize: 13, fontWeight: '700', color: colors.inkSoft, marginLeft: space(1) },
    input: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radius.md,
      paddingHorizontal: space(4),
      paddingVertical: space(3.5),
      fontSize: 16,
      color: colors.ink,
    },
    usernameRow: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
    at: { fontSize: 20, fontWeight: '800', color: colors.inkSoft },
    usernameInput: { flex: 1 },
    hint: { fontSize: 12, color: colors.inkFaint, marginLeft: space(1) },
    error: { color: colors.coralDeep, fontSize: 14, fontWeight: '600', textAlign: 'center' },
    actions: { gap: space(1), marginTop: space(2) },
  });
