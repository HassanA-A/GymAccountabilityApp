import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { fonts, radius, space, useTheme, type ThemeColors } from '@/lib/theme';

// Public page — reachable at gymhud.app/privacy without signing in (the auth
// gate in app/_layout.tsx exempts this route). Also linked from You › Settings.
// This is the URL to paste into App Store Connect's Privacy Policy field.

const CONTACT_EMAIL = 'privacy@gymhud.app';
const LAST_UPDATED = 'September 3, 2026';

export default function Privacy() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Text style={styles.brand}>Huddle</Text>
        <Pressable onPress={close} hitSlop={12} style={styles.done}>
          <Text style={styles.doneText}>Done</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.updated}>Last updated: {LAST_UPDATED}</Text>

        <Text style={styles.p}>
          Huddle is a gym-accountability app for small groups of friends (“crews”). This policy
          explains what we collect, why, who can see it, and the choices you have. By using Huddle
          you agree to this policy.
        </Text>

        <Section title="Information we collect" styles={styles}>
          <Bullet styles={styles} label="Account">
            Your name and email address, provided when you sign up with email or sign in with Google.
          </Bullet>
          <Bullet styles={styles} label="Profile">
            A display name, username, an optional profile photo, and your device’s time zone.
          </Bullet>
          <Bullet styles={styles} label="Check-ins">
            When you check in: the activity type, an optional duration, an optional note, an optional
            photo, and the time.
          </Bullet>
          <Bullet styles={styles} label="Location (optional)">
            If you grant location permission, we record the location of a check-in so your crew can
            see it was logged at a gym. You can decline — check-ins still work without it.
          </Bullet>
          <Bullet styles={styles} label="Steps (optional)">
            Only in crews that turn on step tracking, and only if you grant Motion &amp; Fitness
            permission, we read your daily step count from your device to show your crew’s steps and
            averages. You can decline, and it is never collected in crews without the feature on.
          </Bullet>
          <Bullet styles={styles} label="Notifications">
            A device push token, so we can send you crew nudges and reminders.
          </Bullet>
          <Bullet styles={styles} label="Crews">
            The crews you create or join and your membership in them.
          </Bullet>
        </Section>

        <Section title="How we use your information" styles={styles}>
          <Text style={styles.p}>
            We use it only to run Huddle: to show your crew your check-ins and progress, send nudges
            and reminders, and calculate streaks, stats, and leaderboards. We do not use your data
            for advertising, and we do not sell it.
          </Text>
        </Section>

        <Section title="What your crew can see" styles={styles}>
          <Text style={styles.p}>
            Huddle is social by design. Members of a crew you belong to can see your display name and
            photo, your check-ins in that crew (including any note or photo you attach), your
            streaks, your reactions, and — where the crew has step tracking on — your step counts.
            People who are not in a crew with you cannot see your activity.
          </Text>
        </Section>

        <Section title="How your information is shared" styles={styles}>
          <Text style={styles.p}>
            We share data with a small number of service providers who process it on our behalf:
          </Text>
          <Bullet styles={styles} label="Supabase">
            Hosts our database, authentication, and stored photos.
          </Bullet>
          <Bullet styles={styles} label="Google">
            Handles sign-in if you choose “Continue with Google.”
          </Bullet>
          <Bullet styles={styles} label="Expo">
            Delivers push notifications to your device.
          </Bullet>
          <Bullet styles={styles} label="Apple">
            Distributes the app through the App Store and TestFlight.
          </Bullet>
          <Text style={styles.p}>
            We may also disclose information if required by law. We never sell your personal data.
          </Text>
        </Section>

        <Section title="Data retention and deletion" styles={styles}>
          <Text style={styles.p}>
            We keep your data for as long as your account exists. You can permanently delete your
            account at any time from the app (You › Profile &amp; Settings › Delete account), which
            removes your profile, check-ins, and related data. You can also remove a single check-in
            by undoing it, or leave a crew to stop sharing with it.
          </Text>
        </Section>

        <Section title="Security" styles={styles}>
          <Text style={styles.p}>
            Data is transmitted over encrypted connections and protected with per-user access rules
            so people can only read the data they’re entitled to. No system is perfectly secure, but
            we work to protect your information.
          </Text>
        </Section>

        <Section title="Children" styles={styles}>
          <Text style={styles.p}>
            Huddle is not directed to children under 13, and we do not knowingly collect data from
            them. If you believe a child has provided us information, contact us and we’ll remove it.
          </Text>
        </Section>

        <Section title="Changes to this policy" styles={styles}>
          <Text style={styles.p}>
            We may update this policy from time to time. We’ll revise the “Last updated” date above
            when we do, and significant changes will be noted in the app.
          </Text>
        </Section>

        <Section title="Contact" styles={styles}>
          <Text style={styles.p}>
            Questions about this policy or your data? Email us at{' '}
            <Text style={styles.email}>{CONTACT_EMAIL}</Text>.
          </Text>
        </Section>

        <View style={{ height: space(8) }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children, styles }: { title: string; children: React.ReactNode; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.section}>
      <Text style={styles.h2}>{title}</Text>
      {children}
    </View>
  );
}

function Bullet({ label, children, styles }: { label: string; children: React.ReactNode; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.bullet}>
      <View style={styles.dot} />
      <Text style={styles.bulletText}>
        <Text style={styles.bulletLabel}>{label}. </Text>
        {children}
      </Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space(6), paddingVertical: space(3),
    borderBottomWidth: 1, borderBottomColor: colors.line,
  },
  brand: { fontFamily: fonts.display, fontSize: 18, fontWeight: '800', color: colors.ink, letterSpacing: -0.3 },
  done: { paddingHorizontal: space(2), paddingVertical: space(1) },
  doneText: { fontFamily: fonts.ui, fontSize: 15, fontWeight: '800', color: colors.coral },

  scroll: { paddingHorizontal: space(6), paddingTop: space(5), paddingBottom: space(10), maxWidth: 720, width: '100%', alignSelf: 'center' },
  title: { fontFamily: fonts.display, fontSize: 30, fontWeight: '800', color: colors.ink, letterSpacing: -0.5 },
  updated: { fontFamily: fonts.ui, fontSize: 13, fontWeight: '600', color: colors.inkFaint, marginTop: space(1), marginBottom: space(5) },

  section: { marginTop: space(6), gap: space(2) },
  h2: { fontFamily: fonts.display, fontSize: 19, fontWeight: '800', color: colors.ink, letterSpacing: -0.3, marginBottom: space(1) },
  p: { fontFamily: fonts.ui, fontSize: 15, lineHeight: 23, color: colors.inkSoft },

  bullet: { flexDirection: 'row', gap: space(2.5), alignItems: 'flex-start' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.coral, marginTop: 9 },
  bulletText: { flex: 1, fontFamily: fonts.ui, fontSize: 15, lineHeight: 23, color: colors.inkSoft },
  bulletLabel: { color: colors.ink, fontWeight: '800' },
  email: { color: colors.coral, fontWeight: '700' },
});
