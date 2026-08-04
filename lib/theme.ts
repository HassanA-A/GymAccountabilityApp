// Huddle design tokens — the "soft water / friendly duck" identity.
// Light-first for v1; a dark theme can layer on later.

export const colors = {
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

export const radius = {
  sm: 12,
  md: 18,
  lg: 24,
  xl: 30,
  pill: 999,
} as const;

// 4pt spacing scale
export const space = (n: number) => n * 4;

export const type = {
  display: '800' as const,
  bold: '700' as const,
  semibold: '600' as const,
  regular: '400' as const,
};

export const shadow = {
  card: {
    shadowColor: '#173A40',
    shadowOpacity: 0.12,
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
};
