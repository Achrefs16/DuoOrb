import { Platform } from 'react-native';
import Constants from 'expo-constants';
import {
  isNativeSfxAvailable as hasNativeModule,
  loadSounds,
  playSound,
  releaseSounds,
  setNativeMuted,
} from 'duoorb-sfx';

/**
 * Platform router between the game and the SFX backends.
 *
 * - Native iOS/Android dev/production builds: the DuoOrbSfx module
 *   (SoundPool / AVAudioPlayer pool). One new native voice per event.
 * - Web: untouched legacy path lives in sounds.ts (expo-audio players).
 * - Expo Go / tests / any runtime without the module: every function below
 *   is a safe no-op. Callers branch on `isNativeSfxAvailable()` and fall back
 *   explicitly — never silently.
 *
 * This file holds NO audio timing of its own: no queues, no gaps, no
 * setTimeout. Allocation and eviction are the native mixer's job.
 */

const DEV =
  typeof __DEV__ !== 'undefined' ? __DEV__ : false;

let ready = false;
let initPromise: Promise<boolean> | null = null;
let muted = false;
let missingReported = false;

/** True only where the native module is linked and reachable. */
export function isNativeSfxAvailable(): boolean {
  if (Platform.OS === 'web') return false;
  return hasNativeModule();
}

/** True once every clip is decoded and playable in the native mixer. */
export function isSfxReady(): boolean {
  return ready;
}

function reportMissing(): void {
  if (missingReported) return;
  missingReported = true;
  const ownership =
    (Constants as { appOwnership?: string } | null)?.appOwnership ?? 'unknown';
  if (ownership === 'expo') {
    // Expo Go has no custom native code by design — expected, not a bug.
    if (DEV) console.warn('[sfx] running in Expo Go: native SFX unavailable, using fallback.');
    return;
  }
  // A native build without the module is a build configuration bug, and
  // falling back quietly would mask it as "bad audio". Say so loudly.
  console.error(
    '[sfx] NATIVE MODULE MISSING in a native build — falling back to the ' +
      'legacy player. SFX quality will be degraded. ' +
      'Check that duoorb-sfx is linked (EAS dev/production build required).'
  );
}

/**
 * Resolves each Metro asset to a device file URI and hands the set to the
 * native mixer, which decodes everything before resolving. Idempotent:
 * concurrent callers share one in-flight init.
 */
export function initializeSfx(sources: Record<string, number>): Promise<boolean> {
  if (initPromise) return initPromise;
  initPromise = (async (): Promise<boolean> => {
    try {
      const { Asset } = await import('expo-asset');
      const entries = await Promise.all(
        Object.entries(sources).map(async ([name, id]) => {
          const asset = Asset.fromModule(id);
          const done = await asset.downloadAsync();
          const uri = done.localUri ?? done.uri;
          if (!uri) throw new Error(`no uri for ${name}`);
          return [name, uri] as const;
        })
      );
      const ok = await loadSounds(Object.fromEntries(entries));
      ready = ok;
      if (DEV) console.log(`[sfx] native ready=${ok} (${entries.length} clips)`);
      if (!ok) reportMissing();
      return ok;
    } catch (e) {
      if (DEV) console.warn('[sfx] init failed, SFX disabled:', e);
      reportMissing();
      ready = false;
      return false;
    }
  })();
  return initPromise;
}

/** One native voice per call. Synchronous, fire-and-forget. */
export function playSfx(name: string): void {
  if (muted) return;
  try {
    playSound(name);
  } catch {
    // Audio must never break gameplay.
  }
}

export function setSfxMuted(value: boolean): void {
  muted = value;
  try {
    setNativeMuted(value);
  } catch {
    // ignore
  }
}

/** Tears down the mixer and resets init state (tests, lifecycle). */
export function releaseSfx(): void {
  try {
    releaseSounds();
  } catch {
    // ignore
  }
  ready = false;
  initPromise = null;
  missingReported = false;
}
