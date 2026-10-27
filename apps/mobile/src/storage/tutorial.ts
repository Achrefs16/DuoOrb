import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * First-launch tutorial completion flag.
 *
 * Device-scoped flag (matching storage/onboarding.ts): once completed or skipped,
 * it won't prompt the player again on subsequent app opens unless replayed from Settings.
 */
const TUTORIAL_KEY = '@duoorb:tutorial:v1';

function webGet(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
  } catch {
    // ignore
  }
  return null;
}

function webSet(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // ignore
  }
}

function webRemove(key: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

const hasWebStorage = () => {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
};

/** True when the device has already completed or skipped the interactive tutorial. */
export async function hasCompletedTutorial(): Promise<boolean> {
  try {
    if (hasWebStorage()) return webGet(TUTORIAL_KEY) === '1';
    return (await AsyncStorage.getItem(TUTORIAL_KEY)) === '1';
  } catch {
    return false;
  }
}

/** Marks the interactive tutorial as completed. */
export async function markTutorialComplete(): Promise<void> {
  try {
    if (hasWebStorage()) webSet(TUTORIAL_KEY, '1');
    else await AsyncStorage.setItem(TUTORIAL_KEY, '1');
  } catch {
    // best-effort
  }
}

/** Clears tutorial state (e.g. for replaying from Settings). */
export async function clearTutorial(): Promise<void> {
  try {
    if (hasWebStorage()) webRemove(TUTORIAL_KEY);
    else await AsyncStorage.removeItem(TUTORIAL_KEY);
  } catch {
    // ignore
  }
}
