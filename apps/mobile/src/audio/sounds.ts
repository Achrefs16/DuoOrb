import { Audio } from 'expo-av';

// Metro resolves static asset requires to numeric IDs at bundle time.
declare const require: (path: string) => number;

let moveSound: Audio.Sound | null = null;
let wallSound: Audio.Sound | null = null;
let goalSound: Audio.Sound | null = null;
let loaded = false;
let muted = false;

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  try {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    const [move, wall, goal] = await Promise.all([
      Audio.Sound.createAsync(require('../../assets/sounds/move.wav')),
      Audio.Sound.createAsync(require('../../assets/sounds/wall.wav')),
      Audio.Sound.createAsync(require('../../assets/sounds/goal.wav')),
    ]);
    moveSound = move.sound;
    wallSound = wall.sound;
    goalSound = goal.sound;
    loaded = true;
  } catch {
    // Audio unavailable (e.g. web without user gesture yet) — stay silent.
  }
}

async function play(sound: Audio.Sound | null): Promise<void> {
  if (muted || !sound) return;
  try {
    await sound.replayAsync();
  } catch {
    // Ignore playback races; never break gameplay.
  }
}

export function setSoundsMuted(value: boolean): void {
  muted = value;
}

export function areSoundsMuted(): boolean {
  return muted;
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
