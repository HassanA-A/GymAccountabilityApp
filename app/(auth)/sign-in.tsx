import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '@/lib/auth';
import { Milo } from '@/components/Milo';
import { GhostButton, PrimaryButton } from '@/components/ui';
import { fonts, radius, space, useTheme, type ThemeColors } from '@/lib/theme';

type Mode = 'in' | 'up';

export default function SignIn() {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [mode, setMode] = useState<Mode>('in');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const isUp = mode === 'up';

  async function google() {
    setMessage(null);
    setGoogleBusy(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) setMessage(error);
      // On success the session arrives and the Gate routes onward.
    } finally {
      setGoogleBusy(false);
    }
  }

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
            <Pressable
              onPress={google}
              disabled={googleBusy || busy}
              style={({ pressed }) => [styles.google, pressed && { opacity: 0.7 }]}
            >
              {googleBusy ? (
                <ActivityIndicator color={colors.ink} />
              ) : (
                <>
                  <GoogleG />
                  <Text style={styles.googleText}>Continue with Google</Text>
                </>
              )}
            </Pressable>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

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

function GoogleG() {
  return (
    <Svg width={18} height={18} viewBox="0 0 48 48">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
}

function Field({
  label,
  ...props
}: { label: string } & React.ComponentProps<typeof TextInput>) {
  const { colors } = useTheme();
  const styles = useStyles();
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

function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => makeStyles(colors), [colors]);
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: space(6), gap: space(6) },
  hero: { alignItems: 'center', gap: space(1) },
  title: { fontSize: 40, fontWeight: '800', color: colors.ink, marginTop: space(2), fontFamily: fonts.display, letterSpacing: -0.8 },
  subtitle: { fontSize: 16, color: colors.inkSoft, fontWeight: '600' },
  form: { gap: space(3) },
  google: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(2.5),
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  googleText: { fontSize: 16, fontWeight: '700', color: colors.ink },
  divider: { flexDirection: 'row', alignItems: 'center', gap: space(3), marginVertical: space(1) },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.line },
  dividerText: { fontSize: 13, fontWeight: '600', color: colors.inkFaint },
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
