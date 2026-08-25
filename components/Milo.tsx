import { Image } from 'expo-image';

// The mascot — a gym panda with four moods. (Component name kept as `Milo`
// so every screen that already renders it picks up the panda automatically.)
export type Mood = 'happy' | 'pumped' | 'sleepy' | 'worried';

const SOURCES: Record<Mood, ReturnType<typeof require>> = {
  happy: require('../assets/panda/happy.png'),
  pumped: require('../assets/panda/pumped.png'),
  sleepy: require('../assets/panda/sleepy.png'),
  worried: require('../assets/panda/worried.png'),
};

export function Milo({ mood = 'happy', size = 160 }: { mood?: Mood; size?: number }) {
  return (
    <Image
      source={SOURCES[mood]}
      style={{ width: size, height: size }}
      contentFit="contain"
      transition={150}
    />
  );
}
