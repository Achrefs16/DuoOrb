import AsyncStorage from '@react-native-async-storage/async-storage';
import { LEGAL_VERSION } from '../legal-content';

/**
 * Terms + Privacy acceptance (Play UGC requirement).
 *
 * Recorded when the player ticks "I agree" on Welcome BEFORE any account is
 * created (guest or Google) - so acceptance always precedes the first UGC
 * (username, bio, avatar). Device-scoped like onboarding: signing out does
 * not un-accept, but a version bump re-asks.
 */
const KEY = '@duoorb:legal-accept:v1';

export interface LegalAcceptance {
  version: string;
  acceptedAt: string;
}

function hasWebStorage(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

/** True when the device accepted the CURRENT legal version. */
export async function hasAcceptedLegal(version: string = LEGAL_VERSION): Promise<boolean> {
  try {
    const raw = hasWebStorage()
      ? window.localStorage.getItem(KEY)
      : await AsyncStorage.getItem(KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Partial<LegalAcceptance>;
    return parsed.version === version && !!parsed.acceptedAt;
  } catch {
    return false;
  }
}

export async function markLegalAccepted(version: string = LEGAL_VERSION): Promise<void> {
  const payload: LegalAcceptance = { version, acceptedAt: new Date().toISOString() };
  const raw = JSON.stringify(payload);
  try {
    if (hasWebStorage()) window.localStorage.setItem(KEY, raw);
    else await AsyncStorage.setItem(KEY, raw);
  } catch {
    // Best-effort only.
  }
}
