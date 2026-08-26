import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { createGroup, joinGroupByCode } from '@/lib/db';
import { useActiveGroup } from '@/lib/active-group';
import { Milo } from '@/components/Milo';
import { PrimaryButton } from '@/components/ui';
import { fonts, radius, space, useTheme, type ThemeColors } from '@/lib/theme';

type Tab = 'create' | 'join';

export default function Onboarding() {
  const router = useRouter();
  const { groups, setActiveGroup, refreshGroups } = useActiveGroup();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [tab, setTab] = useState<Tab>('create');
  const [name, setName] = useState('');
  const [target, setTarget] = useState(4);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setError(null);
    setBusy(true);
    try {
      let addedGroup;
      if (tab === 'create') {
        if (!name.trim()) {
          setError('Give your crew a name.');
          return;
        }
        addedGroup = await createGroup(name, target);
      } else {
        if (code.trim().length < 4) {
          setError('Enter the invite code your friend sent you.');
          return;
        }
        addedGroup = await joinGroupByCode(code);
      }
      await refreshGroups();
      await setActiveGroup(addedGroup);
      // After creating a crew, nudge them to invite friends; joining goes
      // straight into the app.
      router.replace(tab === 'create' ? '/invite' : '/(tabs)/today');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Milo mood="happy" size={116} />
            <Text style={styles.title}>{groups.length ? 'Add a crew' : 'Start your crew'}</Text>
            <Text style={styles.subtitle}>
              A crew is you and a few friends chasing the same weekly goal.
            </Text>
          </View>

          <View style={styles.segment}>
            <Seg label="Create one" active={tab === 'create'} onPress={() => setTab('create')} />
            <Seg label="Join one" active={tab === 'join'} onPress={() => setTab('join')} />
          </View>

          {tab === 'create' ? (
            <View style={styles.form}>
              <Field label="Crew name" value={name} onChangeText={setName} placeholder="Sunday Squad" />
              <Text style={styles.fieldLabel}>Weekly goal</Text>
              <View style={styles.targets}>
                {[3, 4, 5, 6].map((n) => (
                  <Pressable
                    key={n}
                    onPress={() => setTarget(n)}
                    style={[styles.target, target === n && styles.targetOn]}
                  >
                    <Text style={[styles.targetText, target === n && styles.targetTextOn]}>
                      {n}×
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.hint}>Everyone aims to check in {target} days a week.</Text>
            </View>
          ) : (
            <View style={styles.form}>
              <Field
                label="Invite code"
                value={code}
                onChangeText={(t) => setCode(t.toUpperCase())}
                placeholder="A1B2C3"
                autoCapitalize="characters"
              />
              <Text style={styles.hint}>Ask a crew member for their 6-character code.</Text>
            </View>
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          <PrimaryButton
            label={tab === 'create' ? 'Create crew' : 'Join crew'}
            onPress={go}
            loading={busy}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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

function Field({
  label,
  ...props
}: { label: string } & React.ComponentProps<typeof TextInput>) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={{ gap: space(1.5) }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={styles.input} placeholderTextColor={colors.inkFaint} {...props} />
    </View>
  );
}

function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => makeStyles(colors), [colors]);
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: space(6), gap: space(5) },
  hero: { alignItems: 'center', gap: space(1) },
  title: { fontSize: 28, fontWeight: '800', color: colors.ink, marginTop: space(2), fontFamily: fonts.display, letterSpacing: -0.4 },
  subtitle: {
    fontSize: 15,
    color: colors.inkSoft,
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 21,
  },
  segment: { flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: radius.pill, padding: 4, borderWidth: 1, borderColor: colors.line },
  seg: { flex: 1, paddingVertical: space(2.5), borderRadius: radius.pill, alignItems: 'center' },
  segOn: { backgroundColor: colors.coral },
  segText: { fontSize: 14, fontWeight: '700', color: colors.inkSoft },
  segTextOn: { color: colors.onCoral },
  form: { gap: space(3) },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: colors.inkSoft, marginLeft: space(1) },
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
  targets: { flexDirection: 'row', gap: space(2.5) },
  target: {
    flex: 1,
    paddingVertical: space(3.5),
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  targetOn: { backgroundColor: colors.teal, borderColor: colors.teal },
  targetText: { fontSize: 17, fontWeight: '800', color: colors.inkSoft },
  targetTextOn: { color: colors.onCoral },
  hint: { fontSize: 13, color: colors.inkSoft, textAlign: 'center' },
  error: { color: colors.coralDeep, fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
