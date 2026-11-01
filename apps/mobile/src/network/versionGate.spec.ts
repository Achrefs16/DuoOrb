import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkAppVersion,
  dismissOptionalUpdate,
  OPTIONAL_UPDATE_COOLDOWN_MS,
  UPDATE_DISMISS_KEY,
  type AppVersionConfig,
} from './versionGate';

const store = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: async (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: async (key: string) => {
      store.delete(key);
    },
    clear: async () => {
      store.clear();
    },
  },
}));

vi.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      android: { versionCode: 16 },
      version: '1.0.4',
    },
  },
}));

describe('versionGate', () => {
  const baseConfig: AppVersionConfig = {
    latestVersion: '1.0.5',
    latestVersionCode: 17,
    minSupportedVersionCode: 15,
    title: "What's New",
    message: 'New features available',
    forceMessage: 'Update required',
    storeUrl: 'market://details?id=com.asdigital.duoorb',
    webStoreUrl: 'https://play.google.com/store/apps/details?id=com.asdigital.duoorb',
    releaseNotes: ['Feature 1', 'Feature 2'],
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    store.clear();
  });

  it('triggers forced update when installed version is below minSupportedVersionCode', async () => {
    const strictConfig: AppVersionConfig = {
      ...baseConfig,
      minSupportedVersionCode: 17, // Current installed is 16
    };

    const res = await checkAppVersion(strictConfig);
    expect(res.status).toBe('forced');
    expect(res.installedVersionCode).toBe(16);
  });

  it('triggers optional update when installed version is between min and latest with no prior dismissal', async () => {
    const res = await checkAppVersion(baseConfig);
    expect(res.status).toBe('optional');
    expect(res.installedVersionCode).toBe(16);
  });

  it('returns none when installed version meets or exceeds latestVersionCode', async () => {
    const upToDateConfig: AppVersionConfig = {
      ...baseConfig,
      latestVersionCode: 16, // Current installed is 16
    };

    const res = await checkAppVersion(upToDateConfig);
    expect(res.status).toBe('none');
  });

  it('respects 3-day fatigue cooldown when the same version was dismissed recently', async () => {
    // Record recent dismissal for version 17
    await dismissOptionalUpdate(17);

    const res = await checkAppVersion(baseConfig);
    expect(res.status).toBe('none');
  });

  it('re-prompts when the cooldown period expires', async () => {
    // Save dismissal 4 days ago
    const fourDaysAgo = Date.now() - (OPTIONAL_UPDATE_COOLDOWN_MS + 86400000);
    store.set(
      UPDATE_DISMISS_KEY,
      JSON.stringify({ timestamp: fourDaysAgo, dismissedVersionCode: 17 })
    );

    const res = await checkAppVersion(baseConfig);
    expect(res.status).toBe('optional');
  });

  it('re-prompts immediately if a newer version is released even within cooldown', async () => {
    // User previously dismissed version 16, but now version 17 is available
    await dismissOptionalUpdate(16);

    const res = await checkAppVersion(baseConfig);
    expect(res.status).toBe('optional');
  });
});
