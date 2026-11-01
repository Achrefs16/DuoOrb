import { Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { API_URL } from './config';

export interface AppVersionConfig {
  latestVersion: string;
  latestVersionCode: number;
  minSupportedVersionCode: number;
  title: string;
  message: string;
  forceMessage: string;
  storeUrl: string;
  webStoreUrl: string;
  releaseNotes: string[];
}

export type VersionGateStatus = 'none' | 'optional' | 'forced';

export interface VersionGateResult {
  status: VersionGateStatus;
  config: AppVersionConfig | null;
  installedVersionCode: number;
  installedVersionName: string;
}

export const UPDATE_DISMISS_KEY = '@duoorb:update_dismissed_v1';
export const OPTIONAL_UPDATE_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

/**
 * Returns currently installed version metadata.
 */
export function getInstalledVersion(): { versionCode: number; versionName: string } {
  const expoConfig = Constants.expoConfig;
  const versionCode =
    Number(expoConfig?.android?.versionCode) ||
    Number(Constants.nativeBuildVersion) ||
    17;
  const versionName =
    expoConfig?.version ||
    Constants.nativeAppVersion ||
    '1.0.5';

  return { versionCode, versionName };
}

/**
 * Evaluates remote version configuration against installed version and local dismissal state.
 */
export async function checkAppVersion(
  remoteConfig?: AppVersionConfig | null
): Promise<VersionGateResult> {
  const { versionCode: installedCode, versionName: installedName } =
    getInstalledVersion();

  let config = remoteConfig;
  if (!config) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(`${API_URL}/app-version`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        config = (await res.json()) as AppVersionConfig;
      }
    } catch {
      // Offline or network timeout: gracefully fail open to not block offline games
      return {
        status: 'none',
        config: null,
        installedVersionCode: installedCode,
        installedVersionName: installedName,
      };
    }
  }

  if (!config) {
    return {
      status: 'none',
      config: null,
      installedVersionCode: installedCode,
      installedVersionName: installedName,
    };
  }

  // 1. Strict / Forced update check: installed build is below minimum allowed version
  if (installedCode < config.minSupportedVersionCode) {
    return {
      status: 'forced',
      config,
      installedVersionCode: installedCode,
      installedVersionName: installedName,
    };
  }

  // 2. Optional update check: a newer version exists in the store
  if (installedCode < config.latestVersionCode) {
    try {
      const raw = await AsyncStorage.getItem(UPDATE_DISMISS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          timestamp?: number;
          dismissedVersionCode?: number;
        };
        const isSameVersion = parsed.dismissedVersionCode === config.latestVersionCode;
        const isWithinCooldown =
          typeof parsed.timestamp === 'number' &&
          Date.now() - parsed.timestamp < OPTIONAL_UPDATE_COOLDOWN_MS;

        // User dismissed this specific version recently -> don't spam them
        if (isSameVersion && isWithinCooldown) {
          return {
            status: 'none',
            config,
            installedVersionCode: installedCode,
            installedVersionName: installedName,
          };
        }
      }
    } catch {
      // storage read failed; show update
    }

    return {
      status: 'optional',
      config,
      installedVersionCode: installedCode,
      installedVersionName: installedName,
    };
  }

  return {
    status: 'none',
    config,
    installedVersionCode: installedCode,
    installedVersionName: installedName,
  };
}

/**
 * Persists user dismissal timestamp to enforce 3-day fatigue cooldown.
 */
export async function dismissOptionalUpdate(versionCode: number): Promise<void> {
  try {
    await AsyncStorage.setItem(
      UPDATE_DISMISS_KEY,
      JSON.stringify({
        timestamp: Date.now(),
        dismissedVersionCode: versionCode,
      })
    );
  } catch {
    // Ignore storage write error
  }
}

/**
 * Deep links directly to Google Play Store / Web Store listing.
 */
export function openStoreUpdate(storeUrl?: string, webUrl?: string): void {
  const primary =
    storeUrl ||
    (Platform.OS === 'android'
      ? 'market://details?id=com.asdigital.duoorb'
      : 'https://play.google.com/store/apps/details?id=com.asdigital.duoorb');

  const fallback =
    webUrl || 'https://play.google.com/store/apps/details?id=com.asdigital.duoorb';

  Linking.openURL(primary).catch(() => {
    Linking.openURL(fallback).catch(() => {});
  });
}

