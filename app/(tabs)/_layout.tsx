import { Tabs } from 'expo-router';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { useTheme } from '@/lib/theme';

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Mount every tab at launch (not on first tap) so each screen loads
        // its data in the background. Tapping Crew or You is then instant
        // instead of showing a spinner the first time.
        lazy: false,
        // Pause off-screen tabs (and their animations, like the crew pet) so
        // keeping them mounted doesn't cost battery while you're elsewhere.
        freezeOnBlur: true,
        tabBarActiveTintColor: colors.coral,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
          height: 88,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="today"
        options={{ title: 'Today', tabBarIcon: ({ color }) => <TodayIcon color={color as string} /> }}
      />
      <Tabs.Screen
        name="crew"
        options={{ title: 'Crew', tabBarIcon: ({ color }) => <CrewIcon color={color as string} /> }}
      />
      <Tabs.Screen
        name="you"
        options={{ title: 'You', tabBarIcon: ({ color }) => <YouIcon color={color as string} /> }}
      />
    </Tabs>
  );
}

function TodayIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="5" fill={color} />
      <G stroke={color} strokeWidth={2} strokeLinecap="round">
        <Path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6L19 19M19 5l-1.4 1.4M6.4 17.6L5 19" />
      </G>
    </Svg>
  );
}

function CrewIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Circle cx="9" cy="9" r="3.2" stroke={color} strokeWidth={2} />
      <Circle cx="17" cy="10" r="2.6" stroke={color} strokeWidth={2} />
      <Path
        d="M3.5 19c.6-3 3-4.5 5.5-4.5s4.9 1.5 5.5 4.5M15 15c2 .2 4 1.5 4.5 4"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function YouIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth={2} />
      <Path d="M4.5 20c.8-4 4-6 7.5-6s6.7 2 7.5 6" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
