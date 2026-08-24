import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { setPendingJoin } from '@/lib/pending-join';
import { Milo } from '@/components/Milo';
import { useTheme } from '@/lib/theme';

/**
 * Entry point for an invite link (/join/CODE). We stash the code, then hand
 * off to the bootstrap ("/"), which signs the user in if needed and redeems
 * the code once a profile exists.
 */
export default function JoinByCode() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { colors } = useTheme();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      if (code) await setPendingJoin(String(code));
      setSaved(true);
    })();
  }, [code]);

  if (saved) return <Redirect href="/" />;

  return (
    <View style={[styles.wrap, { backgroundColor: colors.bg }]}>
      <Milo mood="happy" size={140} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
