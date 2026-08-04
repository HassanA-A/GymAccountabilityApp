import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';
import { Milo } from '@/components/Milo';
import { GhostButton, PrimaryButton } from '@/components/ui';
import { colors, radius, space } from '@/lib/theme';

type Mode = 'in' | 'up';

export default function SignIn() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('in');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const isUp = mode === 'up';

  async function submit() {
    setMessage(null);
    if (!email.trim() || !password) {
      setMessage('Enter your email and a password.');
      return;
    }
    if (isUp && !displayName.trim()) {
      setMessage('What should your crew call you?');
      return;
    }
    setBusy(true);
    try {
      if (isUp) {
        const { error, needsConfirm } = await signUp(email, password, displayName);
        if (error) setMessage(error);
        else if (needsConfirm)
          setMessage('Check your email to confirm, then come back and sign in.');
        // On success with a session, the Gate + index route onward automatically.
      } else {
        const { error } = await signIn(email, password);
        if (error) setMessage(error);
      }
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
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.hero}>
            <Milo mood="happy" size={132} />
            <Text style={styles.title}>Huddle</Text>
            <Text style={styles.subtitle}>Show up. Together.</Text>
          </View>

          <View style={styles.form}>
            {isUp && (
              <Field
                label="Your name"
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Alex"
                autoCapitalize="words"
              />
            )}
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@email.com"
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              autoCapitalize="none"
            />

            {message && <Text style={styles.message}>{message}</Text>}

            <PrimaryButton
              label={isUp ? 'Create account' : 'Sign in'}
              onPress={submit}
              loading={busy}
            />
            <GhostButton
              label={isUp ? 'Already have an account? Sign in' : 'New here? Create an account'}
              onPress={() => {
                setMode(isUp ? 'in' : 'up');
                setMessage(null);
              }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  ...props
}: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor={colors.inkFaint}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: space(6), gap: space(6) },
  hero: { alignItems: 'center', gap: space(1) },
  title: { fontSize: 40, fontWeight: '800', color: colors.ink, marginTop: space(2) },
  subtitle: { fontSize: 16, color: colors.inkSoft, fontWeight: '600' },
  form: { gap: space(3) },
  field: { gap: space(1.5) },
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
  message: { color: colors.coralDeep, fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
