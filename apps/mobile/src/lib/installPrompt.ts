import { Platform } from 'react-native';

export const STORAGE_KEY_DISMISSED = '@duoorb:install_prompt_dismissed_at:v1';
export const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const GOOGLE_PLAY_URL = 'https://play.google.com/store/apps/details?id=com.achraf.duoorb';

export type WebInstallPlatform = 'ios' | 'android' | 'desktop' | 'none';

export interface WebInstallDetection {
  platform: WebInstallPlatform;
  isStandalone: boolean;
}

/**
 * Detects whether the current browser session is a standalone PWA or eligible
 * for an install banner (iOS instructions vs Android Play Store / PWA vs desktop).
 */
export function detectWebInstallPlatform(): WebInstallDetection {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return { platform: 'none', isStandalone: true };
  }

  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;

  if (isStandalone) {
    return { platform: 'none', isStandalone: true };
  }

  const ua = window.navigator.userAgent || '';
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);

  if (isIOS) return { platform: 'ios', isStandalone: false };

  const isAndroid = /Android/i.test(ua);
  if (isAndroid) return { platform: 'android', isStandalone: false };

  return { platform: 'desktop', isStandalone: false };
}

/**
 * Checks whether the prompt is still in its 7-day cooldown period.
 */
export function isInstallPromptCooledDown(
  lastDismissedAt: number | null | undefined,
  now = Date.now()
): boolean {
  if (!lastDismissedAt || isNaN(lastDismissedAt)) {
    return false; // Not cooled down, can show
  }
  return now - lastDismissedAt < COOLDOWN_MS;
}
