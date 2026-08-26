import { useMemo } from 'react';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '@/lib/theme';

// The signature "streak moment": a dot-matrix waveform that rises toward the
// present week — momentum you can see. Lit dots glow in the reward color; the
// rest sit faint behind them. Renders identically on web and native (SVG).
export function StreakDots({ width = 260, rows = 7, gap = 10 }: { width?: number; rows?: number; gap?: number }) {
  const { colors } = useTheme();
  const cols = Math.max(8, Math.floor(width / gap));
  const height = rows * gap;

  const dots = useMemo(() => {
    const arr: { cx: number; cy: number; on: boolean; t: number }[] = [];
    for (let c = 0; c < cols; c++) {
      const t = cols === 1 ? 1 : c / (cols - 1);
      // A rising, gently wavy envelope that peaks at the current week.
      const env = 0.32 + 0.52 * t + 0.16 * Math.sin(t * 7.5) + 0.09 * Math.sin(t * 19);
      const lit = Math.max(1, Math.min(rows, Math.round(env * rows)));
      for (let r = 0; r < rows; r++) {
        const on = r >= rows - lit;
        arr.push({ cx: c * gap + gap / 2, cy: height - (r * gap + gap / 2), on, t });
      }
    }
    return arr;
  }, [cols, rows, gap, height]);

  return (
    <Svg width={cols * gap} height={height}>
      {dots.map((d, i) => (
        <Circle
          key={i}
          cx={d.cx}
          cy={d.cy}
          r={d.on ? 2 : 1.3}
          fill={d.on ? colors.gold : colors.inkFaint}
          opacity={d.on ? 0.5 + 0.5 * d.t : 0.4}
        />
      ))}
    </Svg>
  );
}
