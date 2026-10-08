import type { AudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';
import ownMoveSrc from '../../assets/sounds/move-self.wav';
import opponentMoveSrc from '../../assets/sounds/move-opponent.wav';
// A move that hops over another orb.
import jumpSrc from '../../assets/sounds/dot jumponoter.wav';
import wallSrc from '../../assets/sounds/placewall.wav';
import goalSrc from '../../assets/sounds/goal.wav';
import gameStartSrc from '../../assets/sounds/game-start.wav';
import gameEndSrc from '../../assets/sounds/game-end.wav';
import illegalSrc from '../../assets/sounds/illegalmove.wav';
import notifySrc from '../../assets/sounds/notify.mp3';
import thirtySecondsSrc from '../../assets/sounds/30secondsleft.wav';
import {
  initializeSfx,
  isNativeSfxAvailable,
  isSfxReady,
  playSfx,
  releaseSfx,
  setSfxMuted,
} from './sfx';

// Metro resolves static asset imports to numeric IDs at bundle time —
// identical to the require() form this replaced, so the packaged assets and
// the IDs handed to expo-asset are unchanged. Static import (rather than
// require) keeps this module loadable outside Metro, e.g. in unit tests.

export type SoundName =
  | 'ownMove'
  | 'opponentMove'
  | 'jump'
  | 'wall'
  | 'goal'
  | 'gameStart'
  | 'gameEnd'
  | 'illegal'
  | 'notify'
  | 'thirtySeconds';

const SOURCES: Record<SoundName, number> = {
  ownMove: ownMoveSrc,
  opponentMove: opponentMoveSrc,
  // A move that hops over another orb.
  jump: jumpSrc,
  wall: wallSrc,
  goal: goalSrc,
  gameStart: gameStartSrc,
  gameEnd: gameEndSrc,
  illegal: illegalSrc,
  notify: notifySrc,
  thirtySeconds: thirtySecondsSrc,
};

/**
 * Two backends, chosen once per session:
 *
 * - NATIVE (iOS/Android builds with the DuoOrbSfx module): pre-decoded
 *   multi-voice mixer. Every event starts a new native voice; nothing here
 *   queues, gaps, or seeks.
 * - LEGACY (Web, Expo Go, tests): the original expo-audio players, preserved
 *   verbatim. Web showed no playback defect, so it keeps the implementation
 *   it was verified with.
 */
const useNative = Platform.OS !== 'web' && isNativeSfxAvailable();

/* ------------------------------------------------------------------ */
/* Legacy Web/expo-audio path (unchanged behavior)                     */
/* ------------------------------------------------------------------ */

const players: Record<SoundName, AudioPlayer | null> = {
  ownMove: null,
  opponentMove: null,
  jump: null,
  wall: null,
  goal: null,
  gameStart: null,
  gameEnd: null,
  illegal: null,
  notify: null,
  thirtySeconds: null,
};

let webLoaded = false;
/**
 * Shared legacy init. The original code re-ran the whole body for every
 * concurrent caller (each saw webLoaded === false), creating duplicate
 * players; joining one promise preserves the exact single-threaded behavior
 * while making mount + first-tap races safe.
 */
let webInit: Promise<void> | null = null;
// Rapid moves (fast opponent, AI bursts) used to stack overlapping taps
// into harsh noise. Sounds take turns with a small breathing gap instead.
let playChain: Promise<void> = Promise.resolve();
let lastPlayAt = 0;
const MIN_GAP_MS = 35;

async function ensureWebLoaded(): Promise<void> {
  if (!webInit) {
    webInit = (async (): Promise<void> => {
      try {
        // Import lazily so the audio native module is not touched during app
        // startup. Sounds are only needed after gameplay begins.
        const { createAudioPlayer } = await import('expo-audio');
        // Files play exactly as they are: no volume, rate or mode tweaks.
        (Object.keys(SOURCES) as SoundName[]).forEach((name) => {
          players[name] = createAudioPlayer(SOURCES[name]);
        });
        for (const player of Object.values(players)) {
          if (player) {
            player.muted = muted;
          }
        }
        webLoaded = true;
      } catch {
        // Audio unavailable — stay silent.
      }
    })();
  }
  await webInit;
}

async function playWeb(name: SoundName): Promise<void> {
  if (muted) return;
  const sound = players[name];
  if (!sound) return;
  const run = playChain.then(async () => {
    const wait = MIN_GAP_MS - (Date.now() - lastPlayAt);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    try {
      await sound.seekTo(0);
      sound.play();
    } catch {
      // Ignore playback races; never break gameplay.
    }
    lastPlayAt = Date.now();
  });
  playChain = run.catch(() => {});
  await playChain;
}

/* ------------------------------------------------------------------ */
/* Shared surface                                                      */
/* ------------------------------------------------------------------ */

let muted = false;
/**
 * Shared init promise. Concurrent callers JOIN it instead of each starting
 * (or worse: skipping) init — a tap landing mid-preload must wait for the
 * mixer, not sail past it into a silent native no-op.
 */
let nativeInit: Promise<boolean> | null = null;

/**
 * Warms the backend before gameplay: native pre-decode on device builds,
 * legacy player creation on Web. Safe to call repeatedly; concurrent callers
 * share one init. Never inside the first move's commit — GameScreen calls
 * this on mount.
 */
async function ensureLoaded(): Promise<void> {
  if (useNative) {
    if (!nativeInit) {
      nativeInit = initializeSfx(SOURCES);
    }
    await nativeInit;
    return;
  }
  await ensureWebLoaded();
}

async function play(name: SoundName): Promise<void> {
  if (muted) return;
  if (useNative) {
    // Synchronous fire-and-forget into the native mixer. No await, no queue,
    // no gap: overlapping voices are the mixer's job, not ours.
    playSfx(name);
    return;
  }
  await playWeb(name);
}

export function setSoundsMuted(value: boolean): void {
  muted = value;
  setSfxMuted(value);
  for (const player of Object.values(players)) {
    if (player) player.muted = value;
  }
}

export function areSoundsMuted(): boolean {
  return muted;
}

/** True once every clip is decoded and playable in the active backend. */
export function isSoundReady(): boolean {
  if (useNative) return isSfxReady();
  return webLoaded;
}

/**
 * Frees decoded audio after a match closes. The next GameScreen mount (or a
 * notify toast) re-initializes transparently via ensureLoaded — init state is
 * reset here so re-entry re-decodes instead of hitting a torn-down mixer.
 * Device builds never create legacy players (native path), so only the
 * native mixer is released; legacy players are a web/Expo-Go concern and are
 * left for process teardown.
 */
export function releaseSounds(): void {
  releaseSfx();
  nativeInit = null;
}

/** For tests and lifecycle teardown. Not used by gameplay. */
export function releaseSoundsForTest(): void {
  releaseSounds();
}

/**
 * Warm up the audio engine (native module, decode, players) while the
 * game screen is opening — never inside the first move's commit, where the
 * cold start used to cause a visible hitch.
 */
export function preloadSounds(): void {
  void ensureLoaded();
}

/** Your own orb moving one cell. */
export async function playOwnMoveSound(): Promise<void> {
  await ensureLoaded();
  await play('ownMove');
}

/** Any other player's orb moving one cell — including the opponent whose
 *  moves you hear while watching. */
export async function playOpponentMoveSound(): Promise<void> {
  await ensureLoaded();
  await play('opponentMove');
}

/** A move that jumps over another orb. */
export async function playJumpSound(): Promise<void> {
  await ensureLoaded();
  await play('jump');
}

export async function playWallSound(): Promise<void> {
  await ensureLoaded();
  await play('wall');
}

export async function playGoalSound(): Promise<void> {
  await ensureLoaded();
  await play('goal');
}

export async function playGameStartSound(): Promise<void> {
  await ensureLoaded();
  await play('gameStart');
}

export async function playGameEndSound(): Promise<void> {
  await ensureLoaded();
  await play('gameEnd');
}

/** A move the rules rejected (offline play validates synchronously). */
export async function playIllegalMoveSound(): Promise<void> {
  await ensureLoaded();
  await play('illegal');
}

/** An incoming challenge or room invite. */
export async function playNotifySound(): Promise<void> {
  await ensureLoaded();
  await play('notify');
}

/** Your clock crossing 30 seconds. */
export async function playThirtySecondsSound(): Promise<void> {
  await ensureLoaded();
  await play('thirtySeconds');
}
