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

const players: Record<SoundName, AudioPlayer[]> = {
  ownMove: [],
  opponentMove: [],
  jump: [],
  wall: [],
  goal: [],
  gameStart: [],
  gameEnd: [],
  illegal: [],
  notify: [],
  thirtySeconds: [],
};

/**
 * Rapid-fire board sounds get two voices each. On Android every player is
 * an ExoPlayer, and restarting an in-flight micro-clip (seekTo + play)
 * flushes its decoder mid-render — an audible glitch that made board
 * sounds read as noise on the phone while the browser (plain HTML audio)
 * restarted them cleanly. Alternating voices means a new hit never seeks
 * a playing player: it starts the idle one from zero while the other
 * decays naturally. One-shot sounds keep a single voice.
 */
const BOARD_SOUNDS: SoundName[] = ['ownMove', 'opponentMove', 'jump', 'wall', 'illegal'];
const voiceCursor: Record<SoundName, number> = {
  ownMove: 0,
  opponentMove: 0,
  jump: 0,
  wall: 0,
  goal: 0,
  gameStart: 0,
  gameEnd: 0,
  illegal: 0,
  notify: 0,
  thirtySeconds: 0,
};

let loaded = false;
let muted = false;
// One-shot sounds (never rapid-fire) still take turns with a small
// breathing gap so a burst of toasts does not stack into harsh noise.
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
    for (const name of Object.keys(SOURCES) as SoundName[]) {
      const voices = BOARD_SOUNDS.includes(name) ? 2 : 1;
      for (let i = 0; i < voices; i++) {
        const player = createAudioPlayer(SOURCES[name]);
        player.muted = muted;
        players[name].push(player);
      }
    }
    loaded = true;
  } catch {
    // Audio unavailable — stay silent.
  }
}

/** Immediate, alternating voices. Never waits, never restarts in-flight audio. */
async function playBoard(name: SoundName): Promise<void> {
  if (muted) return;
  const voices = players[name];
  if (voices.length === 0) return;
  voiceCursor[name] = (voiceCursor[name] + 1) % voices.length;
  const sound = voices[voiceCursor[name]];
  try {
    await sound.seekTo(0);
    sound.play();
  } catch {
    // Ignore playback races; never break gameplay.
  }
}

async function playSolo(name: SoundName): Promise<void> {
  if (muted) return;
  const sound = players[name][0];
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
  for (const name of Object.keys(players) as SoundName[]) {
    for (const player of players[name]) player.muted = value;
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
  await playBoard('ownMove');
}

/** Any other player's orb moving one cell — including the opponent whose
 *  moves you hear while watching. */
export async function playOpponentMoveSound(): Promise<void> {
  await ensureLoaded();
  await playBoard('opponentMove');
}

/** A move that jumps over another orb. */
export async function playJumpSound(): Promise<void> {
  await ensureLoaded();
  await playBoard('jump');
}

export async function playWallSound(): Promise<void> {
  await ensureLoaded();
  await playBoard('wall');
}

export async function playGoalSound(): Promise<void> {
  await ensureLoaded();
  await playSolo('goal');
}

export async function playGameStartSound(): Promise<void> {
  await ensureLoaded();
  await playSolo('gameStart');
}

export async function playGameEndSound(): Promise<void> {
  await ensureLoaded();
  await playSolo('gameEnd');
}

/** A move the rules rejected (offline play validates synchronously). */
export async function playIllegalMoveSound(): Promise<void> {
  await ensureLoaded();
  await playBoard('illegal');
}

/** An incoming challenge or room invite. */
export async function playNotifySound(): Promise<void> {
  await ensureLoaded();
  await playSolo('notify');
}

/** Your clock crossing 30 seconds. */
export async function playThirtySecondsSound(): Promise<void> {
  await ensureLoaded();
  await playSolo('thirtySeconds');
}
