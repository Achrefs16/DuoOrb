import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Repeatable SFX verification (no phone required).
 *
 * Maps to the device test plan: A single play, B 5 rapid, C alternating,
 * D 10+ rapid, E/F fast AI+opponent bursts, G enter/leave (re-init), H mute,
 * I kill/reopen (fresh module state). J (same-file ear comparison) is a
 * manual device step by construction and is documented, not automated here.
 *
 * Two suites, one per backend, each with a FRESH module instance
 * (vi.resetModules + doMock + dynamic import), because sounds.ts chooses its
 * backend once at module load from Platform.OS:
 * - native  (OS=android): the new SoundPool/AVAudioPlayer bridge. Asserts the
 *   new architecture's invariants directly: synchronous fire-and-forget (no
 *   timer advancement needed), zero setTimeout-based sequencing, and the
 *   legacy expo-audio path untouched (so seekTo(0) is unreachable).
 * - web     (OS=web): the preserved legacy path. Asserts it behaves exactly
 *   as before (seekTo(0)+play per sound, 10 players, mute respected).
 */

interface Harness {
  sounds: typeof import('./sounds');
  native: {
    loadSounds: ReturnType<typeof vi.fn>;
    playSound: ReturnType<typeof vi.fn>;
    setNativeMuted: ReturnType<typeof vi.fn>;
    releaseSounds: ReturnType<typeof vi.fn>;
    seenUris: Record<string, string>;
  };
  webAudio: {
    createAudioPlayer: ReturnType<typeof vi.fn>;
    players: { play: ReturnType<typeof vi.fn>; seekTo: ReturnType<typeof vi.fn>; muted: boolean }[];
  };
  assetIds: number[];
}

async function loadFresh(os: 'android' | 'web', nativeBehavior: 'ok' | 'reject' | 'absent' = 'ok'): Promise<Harness> {
  vi.resetModules();
  vi.doMock('react-native', () => ({
    Platform: { OS: os, select: (s: Record<string, unknown>) => s.default },
    AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
  }));
  // Sound assets resolve via the vitest asset-stub alias (vitest.config.ts);
  // every require lands on the same numeric stand-in, which is all the
  // expo-asset mock below needs to prove the wiring.

  const seenUris: Record<string, string> = {};
  if (nativeBehavior === 'absent') {
    vi.doMock('duoorb-sfx', () => {
      throw new Error('no native module');
    });
  } else {
    vi.doMock('duoorb-sfx', () => ({
      isNativeSfxAvailable: () => true,
      loadSounds: vi.fn(async (uris: Record<string, string>) => {
        Object.assign(seenUris, uris);
        if (nativeBehavior === 'reject') throw new Error('load failed');
        return true;
      }),
      playSound: vi.fn(),
      setNativeMuted: vi.fn(),
      releaseSounds: vi.fn(),
      isNativeReady: () => true,
    }));
  }
  const assetIds: number[] = [];
  vi.doMock('expo-asset', () => ({
    Asset: {
      fromModule: (id: number) => {
        assetIds.push(id);
        return {
          downloadAsync: async () => ({
            localUri: `file:///sfx/${assetIds.length}.wav`,
            uri: `file:///sfx/${assetIds.length}.wav`,
          }),
        };
      },
    },
  }));
  vi.doMock('expo-constants', () => ({ default: { appOwnership: 'standalone' } }));
  const players: Harness['webAudio']['players'] = [];
  const createAudioPlayer = vi.fn(() => {
    const p = { play: vi.fn(), seekTo: vi.fn(async () => {}), muted: false };
    players.push(p);
    return p;
  });
  vi.doMock('expo-audio', () => ({ createAudioPlayer }));

  const sounds = await import('./sounds');
  const native = await import('duoorb-sfx');
  return {
    sounds,
    native: {
      loadSounds: native.loadSounds as ReturnType<typeof vi.fn>,
      playSound: native.playSound as ReturnType<typeof vi.fn>,
      setNativeMuted: native.setNativeMuted as ReturnType<typeof vi.fn>,
      releaseSounds: native.releaseSounds as ReturnType<typeof vi.fn>,
      seenUris,
    },
    webAudio: { createAudioPlayer, players },
    assetIds,
  };
}

describe('native SFX backend (device builds)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('A/setup: preloads all 10 clips once and reports ready', async () => {
    const h = await loadFresh('android');
    h.sounds.preloadSounds();
    // Drive init to completion through an awaited public call: the shared
    // init promise drains deterministically, unlike blind timer flushing.
    await h.sounds.playOwnMoveSound();
    expect(h.native.loadSounds).toHaveBeenCalledTimes(1);
    expect(Object.keys(h.native.seenUris)).toHaveLength(10);
    expect(h.sounds.isSoundReady()).toBe(true);
    // Second entry is free: init is idempotent (test plan G).
    h.sounds.preloadSounds();
    await vi.runAllTimersAsync();
    expect(h.native.loadSounds).toHaveBeenCalledTimes(1);
  });

  it('A: one move plays exactly one native voice, synchronously', async () => {
    const h = await loadFresh('android');
    await h.sounds.playOwnMoveSound();
    expect(h.native.playSound).toHaveBeenCalledTimes(1);
    expect(h.native.playSound).toHaveBeenCalledWith('ownMove');
    // No timer advancement was needed: fire-and-forget, not scheduled.
  });

  it('B: 5 rapid plays produce 5 native calls with zero scheduled timers', async () => {
    const h = await loadFresh('android');
    await Promise.all([
      h.sounds.playOwnMoveSound(),
      h.sounds.playOwnMoveSound(),
      h.sounds.playOwnMoveSound(),
      h.sounds.playOwnMoveSound(),
      h.sounds.playOwnMoveSound(),
    ]);
    expect(h.native.playSound).toHaveBeenCalledTimes(5);
    // The old architecture's 35ms chain scheduled a timer per sound.
    // The new path must schedule none.
    expect(vi.getTimerCount()).toBe(0);
  });

  it('C: alternating move/wall/move/wall keeps names in order', async () => {
    const h = await loadFresh('android');
    await h.sounds.playOwnMoveSound();
    await h.sounds.playWallSound();
    await h.sounds.playOpponentMoveSound();
    await h.sounds.playWallSound();
    expect(h.native.playSound.mock.calls.map((c) => c[0])).toEqual([
      'ownMove',
      'wall',
      'opponentMove',
      'wall',
    ]);
  });

  it('D/E/F: 10+ mixed events in rapid succession, incl. AI+opponent bursts', async () => {
    const h = await loadFresh('android');
    const burst = [
      h.sounds.playOwnMoveSound(),
      h.sounds.playOpponentMoveSound(),
      h.sounds.playOpponentMoveSound(),
      h.sounds.playWallSound(),
      h.sounds.playJumpSound(),
      h.sounds.playOpponentMoveSound(),
      h.sounds.playOwnMoveSound(),
      h.sounds.playIllegalMoveSound(),
      h.sounds.playGoalSound(),
      h.sounds.playNotifySound(),
      h.sounds.playGameStartSound(),
      h.sounds.playGameEndSound(),
    ];
    await Promise.all(burst);
    expect(h.native.playSound).toHaveBeenCalledTimes(12);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('mapping: every public function reaches the mixer under its own name', async () => {
    const h = await loadFresh('android');
    const s = h.sounds;
    await s.playOwnMoveSound();
    await s.playOpponentMoveSound();
    await s.playJumpSound();
    await s.playWallSound();
    await s.playGoalSound();
    await s.playGameStartSound();
    await s.playGameEndSound();
    await s.playIllegalMoveSound();
    await s.playNotifySound();
    await s.playThirtySecondsSound();
    expect(h.native.playSound.mock.calls.map((c) => c[0])).toEqual([
      'ownMove',
      'opponentMove',
      'jump',
      'wall',
      'goal',
      'gameStart',
      'gameEnd',
      'illegal',
      'notify',
      'thirtySeconds',
    ]);
  });

  it('H: mute suppresses plays and unmute resumes, mixer notified both ways', async () => {
    const h = await loadFresh('android');
    h.sounds.setSoundsMuted(true);
    expect(h.sounds.areSoundsMuted()).toBe(true);
    await h.sounds.playOwnMoveSound();
    await h.sounds.playWallSound();
    expect(h.native.playSound).not.toHaveBeenCalled();
    expect(h.native.setNativeMuted).toHaveBeenCalledWith(true);
    h.sounds.setSoundsMuted(false);
    await h.sounds.playOwnMoveSound();
    expect(h.native.playSound).toHaveBeenCalledTimes(1);
    expect(h.native.setNativeMuted).toHaveBeenCalledWith(false);
  });

  it('G/I: release tears down and the next preload re-initializes cleanly', async () => {
    const h = await loadFresh('android');
    await h.sounds.playOwnMoveSound();
    expect(h.sounds.isSoundReady()).toBe(true);
    h.sounds.releaseSoundsForTest();
    expect(h.sounds.isSoundReady()).toBe(false);
    expect(h.native.releaseSounds).toHaveBeenCalledTimes(1);
    h.sounds.preloadSounds();
    await h.sounds.playOwnMoveSound();
    expect(h.native.loadSounds).toHaveBeenCalledTimes(2);
    expect(h.sounds.isSoundReady()).toBe(true);
  });

  it('error handling: failed init reports not-ready and play never throws', async () => {
    const h = await loadFresh('android', 'reject');
    // A failed init must surface as not-ready, never as a crash. The play
    // call itself still reaches the (empty) mixer, which drops the unknown
    // name — the guarantee is "no throw", not "no call".
    await expect(h.sounds.playOwnMoveSound()).resolves.toBeUndefined();
    expect(h.sounds.isSoundReady()).toBe(false);
  });

  it('legacy path untouched: expo-audio is never instantiated on native', async () => {
    const h = await loadFresh('android');
    await h.sounds.playOwnMoveSound();
    await h.sounds.playWallSound();
    // createAudioPlayer is the ONLY way to reach seekTo(); zero players
    // means repeated playback cannot call seekTo(0). Statically verified too:
    // sounds.ts contains no seekTo outside the legacy playWeb function.
    expect(h.webAudio.createAudioPlayer).not.toHaveBeenCalled();
  });
});

describe('legacy Web backend (browser behavior preserved)', () => {
  it('preload builds 10 players, play seeks+fires, mute respected', async () => {
    const h = await loadFresh('web');
    h.sounds.preloadSounds();
    // The legacy path paces itself with a 35ms setTimeout chain, so every
    // awaited public call must run beside advancing fake timers — awaiting
    // the call alone hangs forever. (This timer-dependence is exactly what
    // the native path eliminates; the web path keeps it by design.)
    const firstPlay = h.sounds.playOwnMoveSound();
    await vi.runAllTimersAsync();
    await firstPlay;
    expect(h.webAudio.createAudioPlayer).toHaveBeenCalledTimes(10);
    expect(h.sounds.isSoundReady()).toBe(true);
    expect(h.native.playSound).not.toHaveBeenCalled();

    const secondPlay = h.sounds.playOwnMoveSound();
    await vi.runAllTimersAsync();
    await secondPlay;
    const first = h.webAudio.players[0];
    expect(first.seekTo).toHaveBeenCalledWith(0);
    expect(first.play).toHaveBeenCalled();

    h.sounds.setSoundsMuted(true);
    const callsBefore = first.play.mock.calls.length;
    const mutedPlay = h.sounds.playOwnMoveSound();
    await vi.runAllTimersAsync();
    await mutedPlay;
    expect(first.play.mock.calls.length).toBe(callsBefore);
  });
});
