import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Three swappable palettes. Token names stay stable so the whole app restyles
// by switching the active set: `coral` = primary accent, `teal` = secondary,
// `mint` = success, `gold` = reward, `danger` = destructive, and `onCoral` =
// the text/icon color that sits ON the accent fill.

export const lightColors = {
  bg: '#F7F4EE',
  bg2: '#EFEAE0',
  surface: '#FFFFFF',
  surface2: '#F1EBDF',
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
  gold: '#B8862A',
  duck: '#E7B44E',
  white: '#FFFFFF',
  onCoral: '#FFFFFF',
  danger: '#C0503A',
} as const;

// Caffeine — warm premium dark (the default).
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

// Matcha — calm green dark.
export const matchaColors: ThemeColors = {
  bg: '#0A0F0A',
  bg2: '#0E140D',
  surface: '#131A12',
  surface2: '#1C241A',
  ink: '#EAF1E4',
  inkSoft: '#A6B79C',
  inkFaint: '#6F8168',
  line: '#243024',
  coral: '#A8D08A',
  coralDeep: '#8FBF6E',
  blush: '#C6E1AB',
  mint: '#7ED0A0',
  mintBg: '#152A1D',
  teal: '#D8C58A',
  gold: '#E6C866',
  duck: '#EAD98A',
  white: '#FFFFFF',
  onCoral: '#0C1A0C',
  danger: '#E88A6F',
};

export type ThemeColors = { [K in keyof typeof lightColors]: string };

export type ThemeName = 'caffeine' | 'matcha' | 'cream';

export const THEMES: Record<ThemeName, { label: string; colors: ThemeColors; isDark: boolean; swatches: string[] }> = {
  caffeine: { label: 'Caffeine', colors: darkColors, isDark: true, swatches: ['#8B5E3C', '#DCB985', '#C4D89A'] },
  matcha: { label: 'Matcha', colors: matchaColors, isDark: true, swatches: ['#4E7A3E', '#A8D08A', '#D8C58A'] },
  cream: { label: 'Cream', colors: lightColors, isDark: false, swatches: ['#B4823C', '#5E8A3A', '#E7B44E'] },
};

const THEME_ORDER: ThemeName[] = ['caffeine', 'matcha', 'cream'];
const STORAGE_KEY = 'huddle.theme';

// Web loads Bricolage Grotesque + Figtree via Google Fonts (see the PWA
// injector); native falls back to the system font until we ship font files.
export const fonts = {
  display: Platform.OS === 'web' ? 'Bricolage Grotesque' : undefined,
  ui: Platform.OS === 'web' ? 'Figtree' : undefined,
} as const;

type ThemeValue = {
  colors: ThemeColors;
  isDark: boolean;
  theme: ThemeName;
  setTheme: (name: ThemeName) => void;
  themes: { name: ThemeName; label: string; swatches: string[] }[];
};

const ThemeContext = createContext<ThemeValue>({
  colors: darkColors,
  isDark: true,
  theme: 'caffeine',
  setTheme: () => {},
  themes: [],
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>('caffeine');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved && saved in THEMES) setThemeState(saved as ThemeName);
      })
      .catch(() => {});
  }, []);

  const setTheme = (name: ThemeName) => {
    setThemeState(name);
    AsyncStorage.setItem(STORAGE_KEY, name).catch(() => {});
  };

  const value = useMemo<ThemeValue>(() => {
    const t = THEMES[theme];
    return {
      colors: t.colors,
      isDark: t.isDark,
      theme,
      setTheme,
      themes: THEME_ORDER.map((name) => ({ name, label: THEMES[name].label, swatches: THEMES[name].swatches })),
    };
  }, [theme]);

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
    button: {
      shadowColor: '#000000',
      shadowOpacity: 0.35,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
  } as const;
}
