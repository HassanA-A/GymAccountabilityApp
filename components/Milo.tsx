import { useId } from 'react';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Ellipse,
  Path,
  Circle,
  G,
  Text as SvgText,
} from 'react-native-svg';

export type Mood = 'happy' | 'pumped' | 'sleepy' | 'worried';

const INK = '#223A40';

export function Milo({ mood = 'happy', size = 160 }: { mood?: Mood; size?: number }) {
  // useId() contains colons (":r0:") which are invalid in SVG ids / url() refs.
  const gid = 'milo' + useId().replace(/:/g, '');
  // viewBox is 200 x 210
  const height = (size * 210) / 200;

  return (
    <Svg width={size} height={height} viewBox="0 0 200 210">
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFE06A" />
          <Stop offset="1" stopColor="#F7C230" />
        </LinearGradient>
      </Defs>

      {/* shadow */}
      <Ellipse cx="100" cy="201" rx="50" ry="9" fill="#173A40" opacity={0.13} />

      {/* feet */}
      <Path d="M70,184 C64,197 71,201 80,199 C89,201 95,197 89,184 Z" fill="#FF9E33" />
      <Path
        d="M80,199 v-11 M73,198 l2,-10 M87,198 l-2,-10"
        stroke="#EF821A"
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
      />
      <Path d="M111,184 C105,197 112,201 120,199 C129,201 135,197 129,184 Z" fill="#FF9E33" />
      <Path
        d="M120,199 v-11 M113,198 l2,-10 M127,198 l-2,-10"
        stroke="#EF821A"
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
      />

      {/* wings */}
      <Ellipse cx="41" cy="126" rx="12" ry="19" fill="#F4C233" />
      <Ellipse cx="159" cy="126" rx="12" ry="19" fill="#F4C233" />

      {/* tuft */}
      <Path d="M97,58 Q92,41 85,52 Q90,59 98,60 Z" fill="#FFD23E" />
      <Path d="M101,56 Q101,37 109,49 Q106,58 101,60 Z" fill="#FFD23E" />
      <Path d="M105,58 Q114,45 116,55 Q110,61 104,61 Z" fill="#FFD23E" />

      {/* body + belly + highlight */}
      <Ellipse cx="100" cy="118" rx="60" ry="62" fill={`url(#${gid})`} />
      <Ellipse cx="100" cy="136" rx="33" ry="33" fill="#FFF6D8" opacity={0.85} />
      <Ellipse cx="76" cy="82" rx="24" ry="14" fill="#FFFFFF" opacity={0.3} />

      {/* headband */}
      <Path d="M44,90 Q100,66 156,90 L156,103 Q100,79 44,103 Z" fill="#FF6A3D" />
      <Circle cx="49" cy="95" r="7" fill="#E8542A" />
      <Path d="M43,92 l-13,-6 l4,11 z" fill="#FF6A3D" />
      <Path d="M43,99 l-14,3 l6,9 z" fill="#FF8A5E" />

      {/* cheeks */}
      <Ellipse cx="63" cy="128" rx="9" ry="6.5" fill="#FF9E8A" opacity={0.7} />
      <Ellipse cx="137" cy="128" rx="9" ry="6.5" fill="#FF9E8A" opacity={0.7} />

      {/* bill */}
      <Ellipse cx="100" cy="132" rx="19" ry="10" fill="#FF9E33" />
      <Path d="M81,132 h38" stroke="#EF821A" strokeWidth={2} strokeLinecap="round" fill="none" />

      <Face mood={mood} />
    </Svg>
  );
}

function Face({ mood }: { mood: Mood }) {
  if (mood === 'pumped') {
    return (
      <G>
        <Path d="M71,113 Q80,104 89,113" fill="none" stroke={INK} strokeWidth={5.5} strokeLinecap="round" />
        <Path d="M111,113 Q120,104 129,113" fill="none" stroke={INK} strokeWidth={5.5} strokeLinecap="round" />
        <Path
          d="M154,54 l2.4,6.8 l6.8,2.4 l-6.8,2.4 l-2.4,6.8 l-2.4,-6.8 l-6.8,-2.4 l6.8,-2.4 z"
          fill="#FFB23E"
        />
      </G>
    );
  }
  if (mood === 'sleepy') {
    return (
      <G>
        <Path d="M72,113 Q80,119 88,113" fill="none" stroke={INK} strokeWidth={4.5} strokeLinecap="round" />
        <Path d="M112,113 Q120,119 128,113" fill="none" stroke={INK} strokeWidth={4.5} strokeLinecap="round" />
        <SvgText x="150" y="70" fontSize="16" fontWeight="800" fill="#5E7C80">
          z
        </SvgText>
        <SvgText x="163" y="55" fontSize="11" fontWeight="800" fill="#9DBCBE">
          z
        </SvgText>
      </G>
    );
  }
  if (mood === 'worried') {
    return (
      <G>
        <Path d="M69,103 L87,107" stroke={INK} strokeWidth={4} strokeLinecap="round" />
        <Path d="M131,103 L113,107" stroke={INK} strokeWidth={4} strokeLinecap="round" />
        <Circle cx="80" cy="115" r="6.5" fill={INK} />
        <Circle cx="120" cy="115" r="6.5" fill={INK} />
        <Path d="M137,120 q4,7 0,11 q-4,-4 0,-11 z" fill="#2FC0D2" />
      </G>
    );
  }
  // happy
  return (
    <G>
      <Circle cx="80" cy="113" r="8" fill={INK} />
      <Circle cx="120" cy="113" r="8" fill={INK} />
      <Circle cx="83" cy="110" r="2.6" fill="#FFFFFF" />
      <Circle cx="123" cy="110" r="2.6" fill="#FFFFFF" />
    </G>
  );
}
