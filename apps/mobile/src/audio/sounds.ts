import type { AudioPlayer } from 'expo-audio';

// Metro resolves static asset requires to numeric IDs at bundle time.
declare const require: (path: string) => number;

let moveSound: AudioPlayer | null = null;
let wallSound: AudioPlayer | null = null;
let goalSound: AudioPlayer | null = null;
let loaded = false;
let muted = false;
// Rapid moves (fast opponent, AI bursts) used to stack overlapping taps
// into harsh noise. Sounds take turns with a small breathing gap instead.
let playChain: Promise<void> = Promise.resolve();
let lastPlayAt = 0;
const MIN_GAP_MS = 35;

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  try {
    // Import lazily so the audio native module is not touched during app
    // startup. Sounds are only needed after gameplay begins.
    const { createAudioPlayer, setAudioModeAsync } = await import('expo-audio');
    // Game effects must play at full volume on the music stream and mix
    // with other apps (not duck under them). Relying on library defaults
    // here is what made the effects nearly inaudible on some devices.
    await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' });
    moveSound = createAudioPlayer(require('../../assets/sounds/move.wav'));
    wallSound = createAudioPlayer(require('../../assets/sounds/wall.wav'));
    goalSound = createAudioPlayer(require('../../assets/sounds/goal.wav'));
    for (const sound of [moveSound, wallSound, goalSound]) {
      sound.volume = 1.0;
      sound.muted = muted;
    }
    loaded = true;
  } catch {
    // Audio unavailable — stay silent.
  }
}

async function play(sound: AudioPlayer | null): Promise<void> {
  if (muted || !sound) return;
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

export function setSoundsMuted(value: boolean): void {
  muted = value;
  for (const sound of [moveSound, wallSound, goalSound]) {
    if (sound) sound.muted = value;
  }
}

export function areSoundsMuted(): boolean {
  return muted;
}

/**
 * Warm up the audio engine (native module, WAV decode, players) while the
 * game screen is opening — never inside the first move's commit, where the
 * cold start used to cause a visible hitch.
 */
export function preloadSounds(): void {
  void ensureLoaded();
}

export async function playMoveSound(): Promise<void> {
  await ensureLoaded();
  await play(moveSound);
}

export async function playWallSound(): Promise<void> {
  await ensureLoaded();
  await play(wallSound);
}

export async function playGoalSound(): Promise<void> {
  await ensureLoaded();
  await play(goalSound);
}
