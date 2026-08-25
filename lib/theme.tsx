import { createContext, useContext, useMemo, type ReactNode } from 'react';

// "Midnight" palette. Token names are kept from the original theme so the whole
// app restyles by swapping values here: `coral` = primary (blue), `teal` =
// accent (violet), `mint` = success, `gold` = reward, `danger` = destructive.

export const lightColors = {
  bg: '#F5F7FB',
  bg2: '#E7EDF9',
  surface: '#FFFFFF',
  surface2: '#F1F5FB',
  ink: '#1E2A3A',
  inkSoft: '#5A6B85',
  inkFaint: '#9AA8BF',
  line: '#E2E8F2',
  coral: '#3B6FF6',
  coralDeep: '#2F5BD8',
  blush: '#93B4FF',
  mint: '#12B36A',
  mintBg: '#DCF5E8',
  teal: '#7C6FF0',
  gold: '#F59E0B',
  duck: '#FFD23E',
  white: '#FFFFFF',
  danger: '#E5484D',
} as const;

export const darkColors: ThemeColors = {
  bg: '#0F172A',
  bg2: '#172136',
  surface: '#1E293B',
  surface2: '#273449',
  ink: '#E8EEF7',
  inkSoft: '#9FB0C9',
  inkFaint: '#64748B',
  line: '#2C3A52',
  coral: '#4C8DFF',
  coralDeep: '#3B76E0',
  blush: '#8FB4FF',
  mint: '#34D399',
  mintBg: '#16342B',
  teal: '#8B7CF6',
  gold: '#FBBF24',
  duck: '#FFD95A',
  white: '#FFFFFF',
  danger: '#F87171',
};

export type ThemeColors = { [K in keyof typeof lightColors]: string };

type ThemeValue = {
  colors: ThemeColors;
  isDark: boolean;
};

const ThemeContext = createContext<ThemeValue>({ colors: darkColors, isDark: true });

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Huddle commits to the Midnight look. (Swap to `useColorScheme() === 'dark'`
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
      shadowOpacity: 0.35,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 3,
    },
    button: {
      shadowColor: colors.coral,
      shadowOpacity: 0.4,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
    },
  } as const;
}
