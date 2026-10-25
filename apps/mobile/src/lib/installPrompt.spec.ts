import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { Platform } from 'react-native';
import {
  COOLDOWN_MS,
  GOOGLE_PLAY_URL,
  STORAGE_KEY_DISMISSED,
  detectWebInstallPlatform,
  isInstallPromptCooledDown,
} from './installPrompt';

describe('installPrompt lib', () => {
  const originalPlatformOS = Platform.OS;

  beforeEach(() => {
    Platform.OS = 'web';
  });

  afterEach(() => {
    Platform.OS = originalPlatformOS;
    delete (globalThis as Record<string, unknown>).window;
  });

  describe('constants', () => {
    it('targets the verified Android package ID', () => {
      expect(GOOGLE_PLAY_URL).toBe(
        'https://play.google.com/store/apps/details?id=com.achraf.duoorb'
      );
    });

    it('enforces a 7-day cooldown', () => {
      expect(COOLDOWN_MS).toBe(7 * 24 * 60 * 60 * 1000);
      expect(STORAGE_KEY_DISMISSED).toBe('@duoorb:install_prompt_dismissed_at:v1');
    });
  });

  describe('isInstallPromptCooledDown', () => {
    it('returns false if never dismissed', () => {
      expect(isInstallPromptCooledDown(null)).toBe(false);
      expect(isInstallPromptCooledDown(undefined)).toBe(false);
    });

    it('returns true if dismissed 1 day ago', () => {
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      expect(isInstallPromptCooledDown(oneDayAgo)).toBe(true);
    });

    it('returns false if dismissed 8 days ago', () => {
      const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
      expect(isInstallPromptCooledDown(eightDaysAgo)).toBe(false);
    });
  });

  describe('detectWebInstallPlatform', () => {
    it('returns platform none and standalone true on native OS', () => {
      Platform.OS = 'android';
      const result = detectWebInstallPlatform();
      expect(result).toEqual({ platform: 'none', isStandalone: true });
    });

    it('returns none and standalone true when window is undefined', () => {
      Platform.OS = 'web';
      delete (globalThis as Record<string, unknown>).window;
      const result = detectWebInstallPlatform();
      expect(result).toEqual({ platform: 'none', isStandalone: true });
    });

    it('returns none and standalone true when display-mode is standalone', () => {
      Platform.OS = 'web';
      (globalThis as Record<string, unknown>).window = {
        matchMedia: (query: string) => ({
          matches: query === '(display-mode: standalone)',
        }),
        navigator: { userAgent: 'Mozilla/5.0 Chrome' },
      };

      const result = detectWebInstallPlatform();
      expect(result).toEqual({ platform: 'none', isStandalone: true });
    });

    it('detects iOS devices accurately', () => {
      Platform.OS = 'web';
      (globalThis as Record<string, unknown>).window = {
        matchMedia: () => ({ matches: false }),
        navigator: {
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
          platform: 'iPhone',
        },
      };

      const result = detectWebInstallPlatform();
      expect(result.platform).toBe('ios');
      expect(result.isStandalone).toBe(false);
    });

    it('detects Android devices accurately', () => {
      Platform.OS = 'web';
      (globalThis as Record<string, unknown>).window = {
        matchMedia: () => ({ matches: false }),
        navigator: {
          userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36',
          platform: 'Linux armv8l',
        },
      };

      const result = detectWebInstallPlatform();
      expect(result.platform).toBe('android');
      expect(result.isStandalone).toBe(false);
    });

    it('detects desktop browsers accurately', () => {
      Platform.OS = 'web';
      (globalThis as Record<string, unknown>).window = {
        matchMedia: () => ({ matches: false }),
        navigator: {
          userAgent:
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          platform: 'Win32',
        },
      };

      const result = detectWebInstallPlatform();
      expect(result.platform).toBe('desktop');
      expect(result.isStandalone).toBe(false);
    });
  });
});
