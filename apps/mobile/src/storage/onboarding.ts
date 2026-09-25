import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * First-launch onboarding flag.
 *
 * Deliberately a DEVICE flag, not an account flag: the welcome screen is a
 * first-run experience, so signing in or out must never bring it back on its
 * own. Only an explicit sign-out (or a data clear) resets it.
 *
 * Uses localStorage on web and AsyncStorage natively, matching the pattern in
 * network/auth.ts so it actually persists on device.
 */
const ONBOARDING_KEY = '@duoorb:onboarding:v1';

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

/** True when this device has already been through onboarding. */
export async function hasCompletedOnboarding(): Promise<boolean> {
  try {
    if (hasWebStorage()) return webGet(ONBOARDING_KEY) === '1';
    return (await AsyncStorage.getItem(ONBOARDING_KEY)) === '1';
  } catch {
    // Treat an unreadable store as "not onboarded" so the flow still runs.
    return false;
  }
}

export async function markOnboardingComplete(): Promise<void> {
  try {
    if (hasWebStorage()) webSet(ONBOARDING_KEY, '1');
    else await AsyncStorage.setItem(ONBOARDING_KEY, '1');
  } catch {
    // Best-effort: a failed write only means the welcome screen reappears.
  }
}

/** Called on an explicit sign-out so the next launch is a clean first run. */
export async function clearOnboarding(): Promise<void> {
  try {
    if (hasWebStorage()) webRemove(ONBOARDING_KEY);
    else await AsyncStorage.removeItem(ONBOARDING_KEY);
  } catch {
    // ignore
  }
}
