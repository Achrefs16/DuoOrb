import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  applyAction,
  GameState,
} from '@duoorb/game-core';
import { AuthoritativeGameService } from './authoritative-game.service.js';

function buildLiveGame() {
  const initial = createInitialState({
    gameId: 'rec-test',
    mode: '2p',
    playerNames: ['Alice', 'Bob'],
    wallsEach: 15,
  });
  let state: GameState = initial;
  const actions = [
    { type: 'MOVE', to: { row: 7, col: 4 } },
    { type: 'MOVE', to: { row: 1, col: 4 } },
    { type: 'PLACE_WALL', wall: { row: 4, col: 4, orientation: 'H' } },
    { type: 'MOVE', to: { row: 2, col: 4 } },
  ] as const;
  const recorded: any[] = [];
  for (const a of actions) {
    const res = applyAction(state, a as any, { timestamp: Date.now(), clockRemainingMs: 170000 });
    expect(res.success).toBe(true);
    if (res.success) {
      state = res.state;
      recorded.push({ ...res.state.lastMove });
    }
  }
  return { initial, state, recorded };
}

describe('crash recovery reconstruction', () => {
  it('reconstructs exact live state from persisted rows', async () => {
    const svc = new AuthoritativeGameService(undefined as any);
    const { state: live } = buildLiveGame();

    const { game, completed } = await svc.reconstructGame(
      {
        id: 'rec-test',
        mode: '2p',
        timeControlMinutes: 3,
        incrementSeconds: 2,
        wallsEach: 15,
        isRanked: false,
      },
      [
        { userId: 'u-alice', playerIndex: 0, ratingBefore: 1500, rdBefore: 350, volBefore: 0.06, displayName: 'Alice' },
        { userId: 'u-bob', playerIndex: 1, ratingBefore: 1500, rdBefore: 350, volBefore: 0.06, displayName: 'Bob' },
      ],
      [0, 1, 2, 3].map((i) => ({
        sequence: i + 1,
        playerIndex: [0, 1, 0, 1][i],
        actionType: 'X',
        payload: [
          { type: 'MOVE', to: { row: 7, col: 4 } },
          { type: 'MOVE', to: { row: 1, col: 4 } },
          { type: 'PLACE_WALL', wall: { row: 4, col: 4, orientation: 'H' } },
          { type: 'MOVE', to: { row: 2, col: 4 } },
        ][i],
        clockRemainingMs: 170000,
        serverTimestamp: BigInt(Date.now()),
        clientActionId: null,
      }))
    );

    expect(completed).toBe(false);
    // Board / walls / turn / mapping / status

    // Board / walls / turn / mapping / status
    expect(game.state.players.map((p) => [p.position.row, p.position.col])).toEqual(
      live.players.map((p) => [p.position.row, p.position.col])
    );
    expect(game.state.walls).toEqual(live.walls);
    expect(game.state.players.map((p) => p.wallsRemaining)).toEqual(
      live.players.map((p) => p.wallsRemaining)
    );
    expect(game.state.currentPlayerIndex).toEqual(live.currentPlayerIndex);
    expect(game.state.status).toEqual('IN_PROGRESS');
    expect(game.playerUserIds).toEqual({ p1: 'u-alice', p2: 'u-bob' });
    expect(game.userPlayerIds).toEqual({ 'u-alice': 'p1', 'u-bob': 'p2' });
    expect(game.state.players.map((p) => p.color)).toEqual(
      live.players.map((p) => p.color)
    );
    // Clocks recover to last known remaining (downtime paused)
    expect(game.clocksMs).toEqual({ p1: 170000, p2: 170000 });
    // Rating seeds for finalization
    expect(game.ratings['u-alice']).toEqual({ rating: 1500, rd: 350, vol: 0.06 });
    expect(game.timeControlMinutes).toBe(3);
    expect(game.incrementSeconds).toBe(2);
    expect(game.wallsEach).toBe(15);
  });

  it('finishes pre-crash-ended games instead of abandoning them', async () => {
    const svc = new AuthoritativeGameService(undefined as any);
    const { game, completed } = await svc.reconstructGame(
      { id: 'g', mode: '2p', timeControlMinutes: 3, incrementSeconds: 0, wallsEach: 10, isRanked: false },
      [
        { userId: 'a', playerIndex: 0, ratingBefore: 1500, rdBefore: 350, volBefore: 0.06, displayName: 'A' },
        { userId: 'b', playerIndex: 1, ratingBefore: 1500, rdBefore: 350, volBefore: 0.06, displayName: 'B' },
      ],
      [
        { sequence: 1, playerIndex: 0, actionType: 'MOVE', payload: { type: 'MOVE', to: { row: 7, col: 4 } }, clockRemainingMs: 170000, serverTimestamp: BigInt(1), clientActionId: null },
        { sequence: 2, playerIndex: 1, actionType: 'RESIGN', payload: { type: 'RESIGN' }, clockRemainingMs: 170000, serverTimestamp: BigInt(2), clientActionId: null },
      ]
    );
    expect(completed).toBe(true);
    expect(game.state.status).toBe('COMPLETED');
    expect(game.state.winnerId).toBe('p1');
  });

  it('refuses sequence gaps instead of inventing state', async () => {
    const svc = new AuthoritativeGameService(undefined as any);
    await expect(
      svc.reconstructGame(
        { id: 'g', mode: '2p', timeControlMinutes: 3, incrementSeconds: 0, wallsEach: 10, isRanked: false },
        [
          { userId: 'a', playerIndex: 0, ratingBefore: 1500, rdBefore: 350, volBefore: 0.06, displayName: 'A' },
          { userId: 'b', playerIndex: 1, ratingBefore: 1500, rdBefore: 350, volBefore: 0.06, displayName: 'B' },
        ],
        [
          { sequence: 1, playerIndex: 0, actionType: 'MOVE', payload: { type: 'MOVE', to: { row: 7, col: 4 } }, clockRemainingMs: 170000, serverTimestamp: BigInt(1), clientActionId: null },
          { sequence: 3, playerIndex: 0, actionType: 'MOVE', payload: { type: 'MOVE', to: { row: 6, col: 4 } }, clockRemainingMs: 170000, serverTimestamp: BigInt(2), clientActionId: null },
        ]
      )
    ).rejects.toThrow(/sequence gap/);
  });

  it('refuses player-count mismatch instead of inventing seats', async () => {
    const svc = new AuthoritativeGameService(undefined as any);
    await expect(
      svc.reconstructGame(
        { id: 'g', mode: '2p', timeControlMinutes: 3, incrementSeconds: 0, wallsEach: 10, isRanked: false },
        [
          { userId: 'a', playerIndex: 0, ratingBefore: 1500, rdBefore: 350, volBefore: 0.06, displayName: 'A' },
        ],
        []
      )
    ).rejects.toThrow(/player count mismatch/);
  });
});
