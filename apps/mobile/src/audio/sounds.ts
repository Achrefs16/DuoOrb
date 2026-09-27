import type { AudioPlayer } from 'expo-audio';

// Metro resolves static asset requires to numeric IDs at bundle time.
declare const require: (path: string) => number;

type SoundName =
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
  ownMove: require('../../assets/sounds/move-self.wav'),
  opponentMove: require('../../assets/sounds/move-opponent.wav'),
  // A move that hops over another orb.
  jump: require('../../assets/sounds/dot jumponoter.wav'),
  wall: require('../../assets/sounds/placewall.wav'),
  goal: require('../../assets/sounds/goal.wav'),
  gameStart: require('../../assets/sounds/game-start.wav'),
  gameEnd: require('../../assets/sounds/game-end.wav'),
  illegal: require('../../assets/sounds/illegalmove.wav'),
  // No .wav provided for notify: the mp3 stays.
  notify: require('../../assets/sounds/notify.mp3'),
  thirtySeconds: require('../../assets/sounds/30secondsleft.wav'),
};

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
    loaded = true;
  } catch {
    // Audio unavailable — stay silent.
  }
}

async function play(name: SoundName): Promise<void> {
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

export function setSoundsMuted(value: boolean): void {
  muted = value;
  for (const player of Object.values(players)) {
    if (player) player.muted = value;
  }
}

export function areSoundsMuted(): boolean {
  return muted;
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
