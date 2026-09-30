import { describe, it, expect } from 'vitest';
import { AuthoritativeGameService } from './authoritative-game.service.js';

const R = { rating: 1500, rd: 350, vol: 0.06 };

function makeGame(
  svc: AuthoritativeGameService,
  gid: string,
  mode: '2p' | 'race3' | 'race4',
  names: string[]
) {
  const users = names.map((displayName, i) => ({
    userId: `u${i + 1}`,
    displayName,
    rating: { ...R },
  }));
  const game = svc.createGame({
    gameId: gid,
    mode: mode as never,
    users,
    timeControlMinutes: 3,
    isRanked: true,
  });
  // offerRematch only runs on completed games; completing for real would take
  // hundreds of moves, and status is the only gate under test here.
  game.state.status = 'COMPLETED';
  return { game, users };
}

function acceptAll(svc: AuthoritativeGameService, gid: string, userIds: string[]) {
  let last: ReturnType<AuthoritativeGameService['offerRematch']> = { offered: false, error: '?' };
  for (const u of userIds) last = svc.offerRematch(gid, u);
  return last;
}

describe('rematch seats every player, not just p1/p2', () => {
  it('1v1 still swaps the two seats with their real names', () => {
    const svc = new AuthoritativeGameService(undefined as any);
    makeGame(svc, 'rm-2p', '2p', ['Alice', 'Bob']);
    const res = acceptAll(svc, 'rm-2p', ['u1', 'u2']);
    expect(res.offered).toBe(true);
    expect(res).toHaveProperty('newGameParams');
    const params = (res as { newGameParams: { mode: string; users: { userId: string; displayName: string }[] } }).newGameParams;
    expect(params.users.map((u) => u.userId)).toEqual(['u2', 'u1']);
    expect(params.users.map((u) => u.displayName)).toEqual(['Bob', 'Alice']);
    expect(params.mode).toBe('2p');
  });

  it('3P carries all three seats, rotated, with live names', () => {
    const svc = new AuthoritativeGameService(undefined as any);
    makeGame(svc, 'rm-3p', 'race3', ['Ann', 'Ben', 'Cy']);
    const res = acceptAll(svc, 'rm-3p', ['u1', 'u2', 'u3']);
    expect(res.offered).toBe(true);
    const params = (res as { newGameParams: { mode: string; users: { userId: string; displayName: string }[] } }).newGameParams;
    expect(params.users.map((u) => u.userId)).toEqual(['u2', 'u3', 'u1']);
    expect(params.users.map((u) => u.displayName)).toEqual(['Ben', 'Cy', 'Ann']);
    expect(params.mode).toBe('race3');
  });

  it('4P carries all four seats — nobody is left unseated', () => {
    const svc = new AuthoritativeGameService(undefined as any);
    makeGame(svc, 'rm-4p', 'race4', ['A', 'B', 'C', 'D']);
    const res = acceptAll(svc, 'rm-4p', ['u1', 'u2', 'u3', 'u4']);
    expect(res.offered).toBe(true);
    const params = (res as { newGameParams: { users: { userId: string }[] } }).newGameParams;
    expect(params.users.map((u) => u.userId)).toEqual(['u2', 'u3', 'u4', 'u1']);
  });

  it('no new game until every seat has accepted', () => {
    const svc = new AuthoritativeGameService(undefined as any);
    makeGame(svc, 'rm-partial', 'race3', ['A', 'B', 'C']);
    const first = svc.offerRematch('rm-partial', 'u1');
    expect(first).toEqual({ offered: true });
    const second = svc.offerRematch('rm-partial', 'u2');
    expect(second).toEqual({ offered: true });
    expect(second).not.toHaveProperty('newGameParams');
  });

  it('rejects strangers and live games', () => {
    const svc = new AuthoritativeGameService(undefined as any);
    makeGame(svc, 'rm-guard', '2p', ['A', 'B']);
    expect(svc.offerRematch('rm-guard', 'u999')).toEqual({
      offered: false,
      error: 'Not a player in this game.',
    });
    expect(svc.offerRematch('nope', 'u1')).toEqual({
      offered: false,
      error: 'Game not found.',
    });
    const live = svc.createGame({
      gameId: 'rm-live',
      mode: '2p' as never,
      users: [
        { userId: 'x1', displayName: 'X', rating: { ...R } },
        { userId: 'x2', displayName: 'Y', rating: { ...R } },
      ],
      timeControlMinutes: 3,
      isRanked: true,
    });
    expect(live.state.status).toBe('IN_PROGRESS');
    expect(svc.offerRematch('rm-live', 'x1')).toEqual({
      offered: false,
      error: 'Game still in progress.',
    });
  });
});
