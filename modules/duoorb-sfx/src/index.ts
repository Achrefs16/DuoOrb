import { Platform } from 'react-native';
import { requireNativeModule } from 'expo';

/**
 * JS bridge to the DuoOrbSfx native module.
 *
 * Android runs SoundPool (pre-decoded, multi-stream); iOS runs a preloaded
 * AVAudioPlayer pool. Both expose the same four functions. This file does NO
 * audio logic of its own — no queues, no gaps, no timing — it only forwards.
 *
 * Absent native module (Web, Expo Go, unit tests): `native` is null and every
 * function below is a safe no-op returning a failure/negative value. Callers
 * must branch on `isNativeSfxAvailable()` and use their own fallback.
 */

export interface NativeSfxModule {
  /**
   * Preloads every sound. Resolves true only when ALL native loads completed.
   * Never resolves before the mixer can actually play.
   */
  loadSounds(sounds: Record<string, string>): Promise<boolean>;
  /** Plays one new native voice. Fire-and-forget; never throws. */
  playSound(name: string): void;
  /** Gates future plays. In-flight tails (<=0.7s) decay naturally. */
  setNativeMuted(muted: boolean): void;
  /** Releases native resources. */
  releaseSounds(): void;
  /** True when the mixer holds every requested sound. */
  isNativeReady(): boolean;
}

let native: NativeSfxModule | null = null;
let attempted = false;

function getNative(): NativeSfxModule | null {
  if (!attempted) {
    attempted = true;
    try {
      native = requireNativeModule<NativeSfxModule>('DuoOrbSfx');
    } catch {
      native = null;
    }
  }
  return native;
}

/** True only on iOS/Android dev/production builds that include the module. */
export function isNativeSfxAvailable(): boolean {
  if (Platform.OS === 'web') return false;
  return getNative() !== null;
}

export async function loadSounds(sounds: Record<string, string>): Promise<boolean> {
  const mod = getNative();
  if (!mod) return false;
  try {
    return await mod.loadSounds(sounds);
  } catch {
    return false;
  }
}

export function playSound(name: string): void {
  try {
    getNative()?.playSound(name);
  } catch {
    // Audio must never break gameplay.
  }
}

export function setNativeMuted(muted: boolean): void {
  try {
    getNative()?.setNativeMuted(muted);
  } catch {
    // ignore
  }
}

export function releaseSounds(): void {
  try {
    getNative()?.releaseSounds();
  } catch {
    // ignore
  }
}

export function isNativeReady(): boolean {
  try {
    return getNative()?.isNativeReady() ?? false;
  } catch {
    return false;
  }
}
