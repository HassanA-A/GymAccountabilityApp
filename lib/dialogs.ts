import { Alert, Platform } from 'react-native';

/**
 * A yes/no confirmation that works everywhere.
 *
 * Why this exists: React Native's `Alert.alert` does NOT work on the web —
 * on a browser it silently does nothing, so buttons like "Undo" appear dead.
 * On the web we fall back to the browser's built-in `window.confirm`; on a
 * real phone we use the native Alert. Both return a simple true/false.
 */
export function confirmAction(opts: {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}): Promise<boolean> {
  const { title, message, confirmText = 'OK', cancelText = 'Cancel', destructive } = opts;

  if (Platform.OS === 'web') {
    const text = message ? `${title}\n\n${message}` : title;
    return Promise.resolve(window.confirm(text));
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelText, style: 'cancel', onPress: () => resolve(false) },
      {
        text: confirmText,
        style: destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]);
  });
}

/** A simple informational popup that works on web and native. */
export function notify(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}
