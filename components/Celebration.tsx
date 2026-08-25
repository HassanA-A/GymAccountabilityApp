import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
} from 'react-native';
import { Milo } from './Milo';
import { useTheme } from '@/lib/theme';

const CONFETTI_COLORS = ['#FF6A3D', '#FFD23E', '#22C1D4', '#12B183', '#FF9E8A', '#FFB23E'];
const COUNT = 16;

/** A quick, tappable confetti + Milo celebration shown after a check-in. */
export function Celebration({
  visible,
  streak,
  onDone,
}: {
  visible: boolean;
  streak: number;
  onDone: () => void;
}) {
  const { colors } = useTheme();
  const { width, height } = Dimensions.get('window');
  const t = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;

  const parts = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => ({
        x: Math.random() * width,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 8 + Math.random() * 7,
        spin: Math.random() * 2 - 1,
      })),
    [width]
  );

  useEffect(() => {
    if (!visible) return;
    t.setValue(0);
    pop.setValue(0);
    Animated.parallel([
      Animated.timing(t, { toValue: 1, duration: 1500, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(pop, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }),
    ]).start();
    const timer = setTimeout(onDone, 2000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" onRequestClose={onDone} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onDone}>
        {parts.map((p, i) => {
          const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [-40, height] });
          const opacity = t.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] });
          const rotate = t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin * 720}deg`] });
          return (
            <Animated.View
              key={i}
              style={[
                styles.confetti,
                {
                  left: p.x,
                  width: p.size,
                  height: p.size,
                  backgroundColor: p.color,
                  opacity,
                  transform: [{ translateY }, { rotate }],
                },
              ]}
            />
          );
        })}

        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              opacity: pop,
              transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
            },
          ]}
        >
          <Milo mood="pumped" size={150} />
          <Text style={[styles.title, { color: colors.ink }]}>You showed up! 🎉</Text>
          {streak > 0 ? (
            <Text style={[styles.streak, { color: colors.coral }]}>🔥 {streak} week streak</Text>
          ) : null}
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,20,25,0.45)',
    padding: 32,
  },
  confetti: { position: 'absolute', top: 0, borderRadius: 2 },
  card: { alignItems: 'center', borderRadius: 28, paddingVertical: 28, paddingHorizontal: 40, gap: 6 },
  title: { fontSize: 22, fontWeight: '800', marginTop: 6 },
  streak: { fontSize: 15, fontWeight: '800' },
});
