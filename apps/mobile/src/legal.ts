import { Linking } from 'react-native';
import { SERVER_URL } from './network/config';

/**
 * Public legal documents (Play Console privacy URL + Data Safety deletion
 * link + in-app Settings/Welcome links all point here).
 *
 * Served by the game server with no login required:
 *   GET /legal/privacy
 *   GET /legal/terms
 *   GET /legal/delete-account
 *
 * Override with EXPO_PUBLIC_LEGAL_BASE_URL when the docs move to a
 * marketing domain (e.g. https://duoorb.com). Otherwise they resolve
 * against the same server the app already talks to.
 */
function legalBase(): string {
  const override = process.env.EXPO_PUBLIC_LEGAL_BASE_URL?.trim();
  if (override) return override.replace(/\/$/, '');
  return SERVER_URL.replace(/\/$/, '');
}

export const LEGAL_URLS = {
  get privacy(): string {
    return `${legalBase()}/legal/privacy`;
  },
  get terms(): string {
    return `${legalBase()}/legal/terms`;
  },
  get deleteAccount(): string {
    return `${legalBase()}/legal/delete-account`;
  },
};

export const LEGAL_CONTACT_EMAIL =
  process.env.EXPO_PUBLIC_LEGAL_CONTACT_EMAIL?.trim() || 'support@duoorb.com';

export async function openLegalUrl(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    // No browser available (rare on device) - caller already shows the URL
    // as text, so swallowing here never hides the destination.
  }
}
