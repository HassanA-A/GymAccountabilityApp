import { useMemo } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { useActiveGroup } from '@/lib/active-group';
import { inviteLink } from '@/lib/pending-join';
import { tap } from '@/lib/haptics';
import { Milo } from '@/components/Milo';
import { GhostButton, PrimaryButton } from '@/components/ui';
import { radius, space, useTheme, type ThemeColors } from '@/lib/theme';

export default function Invite() {
  const router = useRouter();
  const { activeGroup } = useActiveGroup();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (!activeGroup) return <Redirect href="/(tabs)/today" />;

  const link = inviteLink(activeGroup.invite_code);

  async function share() {
    if (!activeGroup) return;
    tap();
    await Share.share({
      message: `Join my crew "${activeGroup.name}" on Huddle 🦆\n${link}`,
    });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        <Milo mood="pumped" size={150} />
        <Text style={styles.title}>Crew created! 🎉</Text>
        <Text style={styles.subtitle}>
          Huddle only works with friends — invite your crew to {activeGroup.name}.
        </Text>

        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>Invite code</Text>
          <Text style={styles.code}>{activeGroup.invite_code}</Text>
          <Text style={styles.link} numberOfLines={1}>
            {link}
          </Text>
        </View>

        <View style={styles.actions}>
          <PrimaryButton label="Share invite" onPress={share} />
          <GhostButton label="I’ll invite later" onPress={() => router.replace('/(tabs)/today')} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space(6), gap: space(2) },
    title: { fontSize: 26, fontWeight: '800', color: colors.ink, marginTop: space(2) },
    subtitle: {
      fontSize: 15,
      color: colors.inkSoft,
      fontWeight: '500',
      textAlign: 'center',
      maxWidth: 320,
      lineHeight: 21,
    },
    codeCard: {
      alignSelf: 'stretch',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radius.lg,
      paddingVertical: space(5),
      paddingHorizontal: space(4),
      gap: space(1.5),
      marginVertical: space(4),
    },
    codeLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.inkSoft,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    code: { fontSize: 34, fontWeight: '800', color: colors.ink, letterSpacing: 6 },
    link: { fontSize: 12, color: colors.teal, fontWeight: '600', maxWidth: '100%' },
    actions: { alignSelf: 'stretch', gap: space(1) },
  });
