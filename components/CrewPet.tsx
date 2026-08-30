import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Milo, type Mood } from './Milo';
import { tap } from '@/lib/haptics';
import { fonts, radius, space, useTheme, type ThemeColors } from '@/lib/theme';

// The crew's shared pet, sitting right on the page (no floating card). It has a
// barely-there idle sway, you can tap to pet it (bounce + hearts + haptic), and
// it has passing thoughts. Mood + message come from how the crew is doing.

const THOUGHTS: Record<Mood, string[]> = {
  pumped: ['let’s GO 🔥', 'crew’s unstoppable 💪', 'so proud rn'],
  happy: ['nice work today 😊', 'keep it rolling', 'good crew energy ✨'],
  sleepy: ['rest up 😌', 'recovery counts too', 'zzz…'],
  worried: ['who’s missing? 👀', 'don’t break the streak…', 'someone check in 🙏'],
};

type Heart = { id: number; x: number; v: Animated.Value };

export function CrewPet({ mood, message }: { mood: Mood; message: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const idle = useRef(new Animated.Value(0)).current;
  const petAnim = useRef(new Animated.Value(0)).current;
  const [hearts, setHearts] = useState<Heart[]>([]);
  const [bubble, setBubble] = useState<string | null>(null);
  const heartId = useRef(0);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Very subtle idle sway.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(idle, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(idle, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [idle]);

  useEffect(() => {
    const t = setInterval(() => showThought(), 11000);
    const first = setTimeout(() => showThought(), 1400);
    return () => { clearInterval(t); clearTimeout(first); if (bubbleTimer.current) clearTimeout(bubbleTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mood]);

  function showThought() {
    const options = THOUGHTS[mood];
    setBubble(options[Math.floor(Math.random() * options.length)]);
    if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
    bubbleTimer.current = setTimeout(() => setBubble(null), 3200);
  }

  function spawnHeart() {
    const id = heartId.current++;
    const v = new Animated.Value(0);
    const x = Math.random() * 70 - 35;
    setHearts((prev) => [...prev, { id, x, v }]);
    Animated.timing(v, { toValue: 1, duration: 950, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => {
      setHearts((prev) => prev.filter((h) => h.id !== id));
    });
  }

  function pet() {
    tap();
    spawnHeart();
    showThought();
    Animated.sequence([
      Animated.spring(petAnim, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 18 }),
      Animated.spring(petAnim, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 8 }),
    ]).start();
  }

  const translateY = idle.interpolate({ inputRange: [0, 1], outputRange: [1.5, -2.5] });
  const breathe = idle.interpolate({ inputRange: [0, 1], outputRange: [1, 1.012] });
  const petScale = petAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] });
  const petRotate = petAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '3deg'] });

  return (
    <View style={styles.wrap}>
      {bubble ? (
        <View style={styles.bubble}>
          <Text style={styles.bubbleText}>{bubble}</Text>
          <View style={styles.bubbleTail} />
        </View>
      ) : null}

      <Pressable onPress={pet} style={styles.petZone} accessibilityRole="button" accessibilityLabel="Pet the crew mascot">
        <Animated.View style={{ transform: [{ translateY }, { scale: Animated.multiply(breathe, petScale) }, { rotate: petRotate }] }}>
          <Milo mood={mood} size={128} />
        </Animated.View>
        {hearts.map((h) => {
          const ty = h.v.interpolate({ inputRange: [0, 1], outputRange: [0, -70] });
          const op = h.v.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] });
          const sc = h.v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.2] });
          return (
            <Animated.Text key={h.id} style={[styles.heart, { transform: [{ translateX: h.x }, { translateY: ty }, { scale: sc }], opacity: op }]}>
              ❤️
            </Animated.Text>
          );
        })}
      </Pressable>

      <Text style={styles.message}>{message}</Text>
      <Text style={styles.hint}>tap to pet</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: space(1), paddingBottom: space(2) },
  petZone: { alignItems: 'center', justifyContent: 'center', height: 138 },
  heart: { position: 'absolute', fontSize: 20 },
  bubble: {
    position: 'absolute',
    top: 0,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: space(3),
    paddingVertical: space(2),
    zIndex: 5,
  },
  bubbleText: { fontFamily: fonts.ui, fontSize: 12.5, fontWeight: '700', color: colors.ink },
  bubbleTail: { position: 'absolute', bottom: -5, left: 18, width: 10, height: 10, backgroundColor: colors.surface, borderRightWidth: 1, borderBottomWidth: 1, borderColor: colors.line, transform: [{ rotate: '45deg' }] },
  message: { fontFamily: fonts.display, fontSize: 15, fontWeight: '800', color: colors.ink, textAlign: 'center', marginTop: space(1), letterSpacing: -0.2 },
  hint: { fontFamily: fonts.ui, fontSize: 11, color: colors.inkFaint, fontWeight: '700', marginTop: space(1) },
});
