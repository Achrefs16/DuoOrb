import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Which earned badges the player has already opened.
 *
 * The NEW pill has two ways to disappear: it ages out (see NEW_WINDOW_MS in
 * the achievements modal), and it disappears the moment the player taps
 * that badge to read it. A "new" label on something you have already
 * looked at is noise, so viewing is a dismissal.
 *
 * Device-scoped like the onboarding flag: it is a UI memory, not account
 * state, and it must never be fetched or synced. Uses localStorage on web
 * and AsyncStorage natively, matching network/auth.ts and storage/onboarding.ts.
 */
const VIEWED_KEY = '@duoorb:achievements:viewed:v1';

function webGet(): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(VIEWED_KEY);
    }
  } catch {
    // ignore
  }
  return null;
}

function webSet(value: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(VIEWED_KEY, value);
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

/** Badge codes already opened on this device. Never throws. */
export async function loadViewedAchievements(): Promise<string[]> {
  try {
    const raw = hasWebStorage() ? webGet() : await AsyncStorage.getItem(VIEWED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((c): c is string => typeof c === 'string') : [];
  } catch {
    // An unreadable store means "nothing viewed": the pill reappears, which
    // is harmless, whereas hiding it wrongly is not.
    return [];
  }
}

/** Marks one badge as read. Best-effort: a failed write only re-shows NEW. */
export async function markAchievementViewed(code: string): Promise<void> {
  try {
    const current = await loadViewedAchievements();
    if (current.includes(code)) return;
    const next = [...current, code].slice(-500);
    const raw = JSON.stringify(next);
    if (hasWebStorage()) webSet(raw);
    else await AsyncStorage.setItem(VIEWED_KEY, raw);
  } catch {
    // ignore
  }
}