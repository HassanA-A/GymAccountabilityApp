import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { Platform } from 'react-native';

// "Caffeine" palette — warm, premium dark. Token names are kept from the
// original theme so the whole app restyles by swapping values here:
// `coral` = primary accent (tan), `teal` = secondary accent (clay),
// `mint` = success, `gold` = reward, `danger` = destructive.
// `onCoral` = the text/icon color that sits ON the accent fill (dark, because
// the tan accent is light — white text would be unreadable there).

export const lightColors = {
  bg: '#F7F4EE',
  bg2: '#EFEAE0',
  surface: '#FFFFFF',
  surface2: '#F3EEE4',
  ink: '#241E15',
  inkSoft: '#6B6154',
  inkFaint: '#A79C8B',
  line: '#E7E0D3',
  coral: '#B4823C',
  coralDeep: '#9A6C2C',
  blush: '#D8B98A',
  mint: '#5E8A3A',
  mintBg: '#E6EDD6',
  teal: '#B0714E',
  gold: '#C6942F',
  duck: '#E7B44E',
  white: '#FFFFFF',
  onCoral: '#1C1509',
  danger: '#C0503A',
} as const;

export const darkColors: ThemeColors = {
  bg: '#0E0D0C',
  bg2: '#16130F',
  surface: '#1A1917',
  surface2: '#232120',
  ink: '#F4EEE4',
  inkSoft: '#B7AB99',
  inkFaint: '#877C6B',
  line: '#2A2723',
  coral: '#DCB985',
  coralDeep: '#C9A46B',
  blush: '#E7CFA5',
  mint: '#C4D89A',
  mintBg: '#23261A',
  teal: '#D6A98C',
  gold: '#EBC06A',
  duck: '#F2C97A',
  white: '#FFFFFF',
  onCoral: '#1C1509',
  danger: '#E88A6F',
};

export type ThemeColors = { [K in keyof typeof lightColors]: string };

// Web loads Bricolage Grotesque + Figtree via Google Fonts (see the PWA
// injector); native falls back to the system font until we ship font files
// with the native build. Platform-gating keeps native from referencing a
// family it hasn't registered.
export const fonts = {
  display: Platform.OS === 'web' ? 'Bricolage Grotesque' : undefined,
  ui: Platform.OS === 'web' ? 'Figtree' : undefined,
} as const;

type ThemeValue = {
  colors: ThemeColors;
  isDark: boolean;
};

const ThemeContext = createContext<ThemeValue>({ colors: darkColors, isDark: true });

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Huddle commits to the Caffeine look. (Swap to `useColorScheme() === 'dark'`
  // to follow the device's light/dark setting instead.)
  const value = useMemo(() => ({ colors: darkColors, isDark: true }), []);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}

export const radius = {
  sm: 12,
  md: 18,
  lg: 24,
  xl: 30,
  pill: 999,
} as const;

export const space = (n: number) => n * 4;

export const type = {
  display: '800' as const,
  bold: '700' as const,
  semibold: '600' as const,
  regular: '400' as const,
};

export function shadows(colors: ThemeColors) {
  return {
    card: {
      shadowColor: '#000000',
      shadowOpacity: 0.4,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 3,
    },
    // Soft neutral lift — no colored glow (reads dated / AI-ish).
    button: {
      shadowColor: '#000000',
      shadowOpacity: 0.35,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
  } as const;
}
