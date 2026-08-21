import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// Haptics only exist on real phones. Guard so web/desktop never throws, and
// swallow errors so a missing motor never interrupts a user action.
const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

/** A light tap — for button presses. */
export function tap() {
  if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** A crisp selection tick — for toggles/chips. */
export function select() {
  if (enabled) Haptics.selectionAsync().catch(() => {});
}

/** A celebratory buzz — for completing something (a check-in). */
export function success() {
  if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
