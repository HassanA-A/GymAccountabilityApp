import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

export const lightColors = {
  bg: '#E7F6F4',
  bg2: '#D6EFEC',
  surface: '#FFFFFF',
  surface2: '#F1FAF9',
  ink: '#213A40',
  inkSoft: '#5E7C80',
  inkFaint: '#9DBCBE',
  line: '#D5EBE8',
  coral: '#FF6A3D',
  coralDeep: '#E8542A',
  blush: '#FF9E8A',
  mint: '#12B183',
  mintBg: '#D2F1E7',
  teal: '#1AA6B8',
  gold: '#FFB23E',
  duck: '#FFD23E',
  white: '#FFFFFF',
  danger: '#E8542A',
} as const;

export const darkColors: ThemeColors = {
  bg: '#0D2023',
  bg2: '#132B2E',
  surface: '#173034',
  surface2: '#1D393D',
  ink: '#ECF8F6',
  inkSoft: '#A8C7C7',
  inkFaint: '#729496',
  line: '#2B4B4E',
  coral: '#FF7952',
  coralDeep: '#FF8B69',
  blush: '#FFAB99',
  mint: '#39C99C',
  mintBg: '#204E43',
  teal: '#45C2D0',
  gold: '#FFC15C',
  duck: '#FFD95A',
  white: '#FFFFFF',
  danger: '#FF7952',
};

export type ThemeColors = { [K in keyof typeof lightColors]: string };

type ThemeValue = {
  colors: ThemeColors;
  isDark: boolean;
};

const ThemeContext = createContext<ThemeValue>({ colors: lightColors, isDark: false });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const isDark = useColorScheme() === 'dark';
  const value = useMemo(() => ({ colors: isDark ? darkColors : lightColors, isDark }), [isDark]);
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
      shadowOpacity: 0.18,
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
