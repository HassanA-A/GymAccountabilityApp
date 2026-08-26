import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { radius, space, useTheme } from '@/lib/theme';

// A web-only "Add to Home Screen" banner. On iOS Safari there's no install
// API, so we show instructions; on Android/Chrome we capture the native
// beforeinstallprompt event and offer an Install button. Dismissal is
// remembered so it never nags.
export function InstallPrompt() {
  const { colors } = useTheme();
  const [show, setShow] = useState(false);
  const [kind, setKind] = useState<'ios' | 'android' | null>(null);
  const deferred = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    try {
      if (window.localStorage.getItem('huddle.a2hs')) return;
    } catch {
      /* private mode */
    }

    const nav: any = window.navigator;
    const standalone =
      nav.standalone === true ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    if (standalone) return; // already installed

    const ua: string = nav.userAgent || '';
    if (/iphone|ipad|ipod/i.test(ua)) {
      setKind('ios');
      setShow(true);
      return;
    }

    const onPrompt = (e: any) => {
      e.preventDefault();
      deferred.current = e;
      setKind('android');
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  function dismiss() {
    try {
      window.localStorage.setItem('huddle.a2hs', '1');
    } catch {
      /* ignore */
    }
    setShow(false);
  }

  async function install() {
    const e = deferred.current;
    if (e) {
      e.prompt();
      try {
        await e.userChoice;
      } catch {
        /* ignore */
      }
    }
    dismiss();
  }

  if (Platform.OS !== 'web' || !show) return null;

  return (
    <View style={[styles.wrap, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      <Text style={styles.emoji}>🐼</Text>
      <View style={styles.textCol}>
        <Text style={[styles.title, { color: colors.ink }]}>Add Huddle to your Home Screen</Text>
        {kind === 'ios' ? (
          <Text style={[styles.body, { color: colors.inkSoft }]}>
            Tap the Share icon below, then “Add to Home Screen.”
          </Text>
        ) : (
          <Text style={[styles.body, { color: colors.inkSoft }]}>
            Install it for a full-screen, app-like experience.
          </Text>
        )}
      </View>

      {kind === 'android' ? (
        <Pressable onPress={install} style={[styles.install, { backgroundColor: colors.coral }]}>
          <Text style={[styles.installText, { color: colors.onCoral }]}>Install</Text>
        </Pressable>
      ) : (
        <ShareGlyph color={colors.coral} />
      )}

      <Pressable onPress={dismiss} hitSlop={12} style={styles.close}>
        <Text style={[styles.closeText, { color: colors.inkFaint }]}>✕</Text>
      </Pressable>
    </View>
  );
}

function ShareGlyph({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3v11M12 3l-3.5 3.5M12 3l3.5 3.5"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M7 10H6a2 2 0 00-2 2v7a2 2 0 002 2h12a2 2 0 002-2v-7a2 2 0 00-2-2h-1"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: space(3),
    right: space(3),
    bottom: space(3),
    zIndex: 1000,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: space(3),
    paddingHorizontal: space(4),
    shadowColor: '#000000',
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    maxWidth: 520,
    alignSelf: 'center',
    width: '100%',
  },
  emoji: { fontSize: 28 },
  textCol: { flex: 1 },
  title: { fontSize: 14, fontWeight: '800' },
  body: { fontSize: 12.5, fontWeight: '600', marginTop: 2 },
  install: { borderRadius: radius.pill, paddingHorizontal: space(4), paddingVertical: space(2.5) },
  installText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  close: { paddingHorizontal: space(1) },
  closeText: { fontSize: 15, fontWeight: '700' },
});
