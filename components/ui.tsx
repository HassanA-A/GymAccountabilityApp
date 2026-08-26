import { useMemo, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { useActiveGroup } from '@/lib/active-group';
import { fonts, lightColors, radius, shadows, space, useTheme, type ThemeColors } from '@/lib/theme';

export function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
  icon,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        styles.btn,
        shadows(colors).button,
        off && styles.btnOff,
        pressed && !off && styles.btnPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.onCoral} />
      ) : (
        <>
          {icon}
          <Text style={styles.btnText}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function GhostButton({ label, onPress }: { label: string; onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.ghost, pressed && { opacity: 0.6 }]}>
      <Text style={styles.ghostText}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return <View style={[styles.card, shadows(colors).card, style]}>{children}</View>;
}

export function CrewSwitcher() {
  const { groups, activeGroup, setActiveGroup } = useActiveGroup();
  const styles = useStyles();
  if (groups.length < 2) return null;

  return (
    <View style={styles.switcherWrap}>
      <Text style={styles.switcherLabel}>Active crew</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.switcher}>
        {groups.map((group) => {
          const active = group.id === activeGroup?.id;
          return (
            <Pressable
              key={group.id}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setActiveGroup(group)}
              style={[styles.crewChip, active && styles.crewChipOn]}
            >
              <Text style={[styles.crewChipText, active && styles.crewChipTextOn]}>{group.name}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function Avatar({
  name,
  color,
  size = 34,
  uri,
}: {
  name: string;
  color: string;
  size?: number;
  uri?: string | null;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const dim = { width: size, height: size, borderRadius: size * 0.34 };
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.avatar, dim, { backgroundColor: colors.surface2 }]}
        contentFit="cover"
      />
    );
  }
  return (
    <View style={[styles.avatar, dim, { backgroundColor: color }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.42 }]}>
        {name.trim().charAt(0).toUpperCase() || '?'}
      </Text>
    </View>
  );
}

/** Deterministic accent color from a string, so avatars stay stable. */
export function colorFor(seed: string): string {
  const palette = [lightColors.teal, lightColors.coral, lightColors.gold, lightColors.mint, '#7C6FF0', '#F06FA8'];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => makeStyles(colors), [colors]);
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  btn: {
    backgroundColor: colors.coral,
    borderRadius: radius.lg,
    paddingVertical: space(4.5),
    paddingHorizontal: space(5),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(2),
  },
  btnOff: { opacity: 0.5 },
  btnPressed: { transform: [{ translateY: 1 }], opacity: 0.92 },
  btnText: { color: colors.onCoral, fontSize: 18, fontWeight: '800', fontFamily: fonts.display },
  ghost: { paddingVertical: space(3), alignItems: 'center' },
  ghostText: { color: colors.inkSoft, fontSize: 15, fontWeight: '600', fontFamily: fonts.ui },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space(5),
  },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white, fontWeight: '800', fontFamily: fonts.display },
  switcherWrap: { gap: space(1.5), marginBottom: space(4) },
  switcherLabel: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontFamily: fonts.ui,
  },
  switcher: { gap: space(2) },
  crewChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: space(3.5),
    paddingVertical: space(2),
  },
  crewChipOn: { backgroundColor: colors.coral, borderColor: colors.coral },
  crewChipText: { color: colors.inkSoft, fontSize: 13, fontWeight: '700', fontFamily: fonts.ui },
  crewChipTextOn: { color: colors.onCoral },
});
