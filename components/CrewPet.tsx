import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Milo, type Mood } from './Milo';
import { tap } from '@/lib/haptics';
import { fonts, radius, space, useTheme, type ThemeColors } from '@/lib/theme';

// The crew's shared pet. It idles (breathes + bobs), you can tap to pet it
// (bounce + hearts + haptic), it has passing thoughts, and its little world
// changes with the time of day. Mood + message come from how the crew is doing.

type Scene = { key: 'morning' | 'day' | 'evening' | 'night'; bg: string; glow: string; icon: string };

function sceneForHour(h: number): Scene {
  if (h < 6) return { key: 'night', bg: '#131A2C', glow: '#2A3358', icon: '🌙' };
  if (h < 12) return { key: 'morning', bg: '#2B2117', glow: '#6B4E28', icon: '🌅' };
  if (h < 18) return { key: 'day', bg: '#1E2620', glow: '#3E5233', icon: '☀️' };
  if (h < 22) return { key: 'evening', bg: '#281B23', glow: '#553040', icon: '🌆' };
  return { key: 'night', bg: '#131A2C', glow: '#2A3358', icon: '🌙' };
}

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
  const scene = useMemo(() => sceneForHour(new Date().getHours()), []);

  const idle = useRef(new Animated.Value(0)).current;
  const petAnim = useRef(new Animated.Value(0)).current;
  const [hearts, setHearts] = useState<Heart[]>([]);
  const [bubble, setBubble] = useState<string | null>(null);
  const heartId = useRef(0);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Idle breathing + bob.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(idle, { toValue: 1, duration: 1900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(idle, { toValue: 0, duration: 1900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [idle]);

  // A passing thought every so often.
  useEffect(() => {
    const t = setInterval(() => showThought(), 11000);
    const first = setTimeout(() => showThought(), 1200);
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
      Animated.spring(petAnim, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 20 }),
      Animated.spring(petAnim, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 10 }),
    ]).start();
  }

  const translateY = idle.interpolate({ inputRange: [0, 1], outputRange: [5, -7] });
  const breathe = idle.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] });
  const petScale = petAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.13] });
  const petRotate = petAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '4deg'] });

  return (
    <View style={[styles.card, { backgroundColor: scene.bg }]}>
      <View style={[styles.glow, { backgroundColor: scene.glow }]} />
      <Text style={styles.sceneIcon}>{scene.icon}</Text>
      {scene.key === 'night' && (
        <>
          <View style={[styles.star, { top: 18, left: 34 }]} />
          <View style={[styles.star, { top: 40, left: 90, opacity: 0.6 }]} />
          <View style={[styles.star, { top: 26, right: 70, opacity: 0.8 }]} />
        </>
      )}

      {bubble ? (
        <View style={styles.bubble}>
          <Text style={styles.bubbleText}>{bubble}</Text>
          <View style={styles.bubbleTail} />
        </View>
      ) : null}

      <Pressable onPress={pet} style={styles.petZone} accessibilityRole="button" accessibilityLabel="Pet the crew mascot">
        <Animated.View style={{ transform: [{ translateY }, { scale: Animated.multiply(breathe, petScale) }, { rotate: petRotate }] }}>
          <Milo mood={mood} size={132} />
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
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: space(5),
    paddingHorizontal: space(4),
    alignItems: 'center',
    overflow: 'hidden',
  },
  glow: { position: 'absolute', width: 200, height: 200, borderRadius: 100, opacity: 0.35, top: 30 },
  sceneIcon: { position: 'absolute', top: 14, right: 16, fontSize: 22 },
  star: { position: 'absolute', width: 3, height: 3, borderRadius: 2, backgroundColor: '#FFFFFF', opacity: 0.9 },
  petZone: { alignItems: 'center', justifyContent: 'center', height: 148 },
  heart: { position: 'absolute', fontSize: 20 },
  bubble: {
    position: 'absolute',
    top: 10,
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
  message: { fontFamily: fonts.display, fontSize: 15, fontWeight: '800', color: '#F4EEE4', textAlign: 'center', marginTop: space(2), letterSpacing: -0.2 },
  hint: { fontFamily: fonts.ui, fontSize: 11, color: 'rgba(244,238,228,0.5)', fontWeight: '700', marginTop: space(1) },
});
