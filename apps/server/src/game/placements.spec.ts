import { describe, it, expect, vi, afterEach } from 'vitest';
import { AuthoritativeGameService } from './authoritative-game.service.js';

const R = { rating: 1500, rd: 350, vol: 0.06 };

afterEach(() => {
  vi.useRealTimers();
});

function make3P(svc: AuthoritativeGameService, gid = 'mp-3p') {
  const users = ['uA', 'uB', 'uC'].map((userId, i) => ({
    userId,
    displayName: `P${i + 1}`,
    rating: { ...R },
  }));
  const game = svc.createGame({
    gameId: gid,
    mode: 'race3',
    users,
    timeControlMinutes: 0,
    isRanked: true,
  });
  return { game, users };
}

/** Teleport a seat next to the race goal line. */
function stageGoal(svc: AuthoritativeGameService, gid: string, playerIdx: number) {
  const g = svc.getGame(gid)!;
  const seat = g.state.players[playerIdx];
  seat.position = { row: 1, col: seat.position.col };
  // Ensure the goal cell itself is enterable (no occupant).
  for (const p of g.state.players) {
    if (p.id !== seat.id && p.position.row === 0 && p.position.col === seat.position.col) {
      p.position = { row: 5, col: p.position.col };
    }
  }
  g.state.currentPlayerIndex = playerIdx;
}

function goalMove(svc: AuthoritativeGameService, gid: string, userId: string) {
  const g = svc.getGame(gid)!;
  const seat = g.state.players.find((p) => g.playerUserIds[p.id] === userId)!;
  return svc.processAction(gid, userId, { type: 'MOVE', to: { row: 0, col: seat.position.col } });
}

describe('multiplayer finish flow (service)', () => {
  it('3P: A finishes -> continues; B finishes -> C auto 3rd, completes with all ratings', () => {
    const svc = new AuthoritativeGameService(undefined as any);
    make3P(svc);
    const g = () => svc.getGame('mp-3p')!;

    stageGoal(svc, 'mp-3p', 0);
    const a = goalMove(svc, 'mp-3p', 'uA');
    expect(a.success).toBe(true);
    if (!a.success) return;
    expect(a.ended).toBeUndefined();
    expect(a.finished).toEqual({ playerId: 'p1', userId: 'uA', place: 1 });
    // No rating computed yet — pendingCompletion stays empty mid-game.
    expect(g().pendingCompletion).toBeUndefined();
    expect(g().state.status).toBe('IN_PROGRESS');

    // Finished player cannot act anymore.
    const retry = svc.processAction('mp-3p', 'uA', {
      type: 'PLACE_WALL',
      wall: { row: 0, col: 0, orientation: 'H' },
    });
    expect(retry.success).toBe(false);
    if (retry.success) return;
    expect(retry.error.code).toBe('ALREADY_FINISHED');

    stageGoal(svc, 'mp-3p', 1);
    const b = goalMove(svc, 'mp-3p', 'uB');
    expect(b.success).toBe(true);
    if (!b.success) return;
    expect(b.ended).toBeDefined();
    expect(b.ended!.winnerId).toBe('p1');
    // The decisive finisher is ALSO reported (broadcast before ended).
    expect(b.finished).toEqual({ playerId: 'p2', userId: 'uB', place: 2 });
    expect(b.ended!.placements).toEqual([
      { playerId: 'p1', userId: 'uA', place: 1 },
      { playerId: 'p2', userId: 'uB', place: 2 },
      { playerId: 'p3', userId: 'uC', place: 3 },
    ]);
    // One atomic rating update covering every seat.
    const pc = g().pendingCompletion!;
    expect(Object.keys(pc.ratingChanges).sort()).toEqual(['uA', 'uB', 'uC']);
    expect(pc.ratingChanges['uA'].delta).toBeGreaterThan(0);
    expect(pc.ratingChanges['uC'].delta).toBeLessThan(0);
  });

  it('4P: three goals complete; last seat auto-placed', () => {
    const svc = new AuthoritativeGameService(undefined as any);
    const users = ['uA', 'uB', 'uC', 'uD'].map((userId, i) => ({
      userId,
      displayName: `P${i + 1}`,
      rating: { ...R },
    }));
    svc.createGame({ gameId: 'mp-4p', mode: 'race4', users, timeControlMinutes: 0, isRanked: true });

    const userFor = (idx: number) => users[idx].userId;
    for (const idx of [0, 1, 2]) {
      const g = svc.getGame('mp-4p')!;
      const seat = g.state.players[idx];
      seat.position = { row: 1, col: seat.position.col };
      g.state.currentPlayerIndex = idx;
      const r = svc.processAction('mp-4p', userFor(idx), {
        type: 'MOVE',
        to: { row: 0, col: seat.position.col },
      });
      expect(r.success).toBe(true);
      if (!r.success) return;
      if (idx < 2) {
        expect(r.ended).toBeUndefined();
        expect(r.finished?.place).toBe(idx + 1);
      } else {
        expect(r.ended).toBeDefined();
        expect(r.ended!.placements).toEqual([
          { playerId: 'p1', userId: 'uA', place: 1 },
          { playerId: 'p2', userId: 'uB', place: 2 },
          { playerId: 'p3', userId: 'uC', place: 3 },
          { playerId: 'p4', userId: 'uD', place: 4 },
        ]);
      }
    }
  });

  it('finished disconnect arms no timer; active disconnect does', () => {
    const svc = new AuthoritativeGameService(undefined as any);
    make3P(svc, 'mp-disc');
    const noop = () => {};
    // Active player -> grace.
    expect(svc.handleDisconnect('mp-disc', 'uA', noop as any)).not.toBeNull();
    // Finish A, then disconnect -> no timer, no forfeit.
    stageGoal(svc, 'mp-disc', 0);
    const g = svc.getGame('mp-disc')!;
    const seat = g.state.players[0];
    const r = svc.processAction('mp-disc', 'uA', { type: 'MOVE', to: { row: 0, col: seat.position.col } });
    expect(r.success).toBe(true);
    // Clear the earlier active grace so it cannot fire later.
    if (g.disconnectedUsers['uA']) {
      clearTimeout(g.disconnectedUsers['uA'].timeoutId);
      delete g.disconnectedUsers['uA'];
    }
    expect(svc.handleDisconnect('mp-disc', 'uA', noop as any)).toBeNull();
    expect(g.state.players[0].place).toBe(1);
    expect(g.state.status).toBe('IN_PROGRESS');
  });

  it('finished player leaves freely; active player leave forfeits', () => {
    const svc = new AuthoritativeGameService(undefined as any);
    make3P(svc, 'mp-leave');
    stageGoal(svc, 'mp-leave', 0);
    const g = svc.getGame('mp-leave')!;
    const seat = g.state.players[0];
    const fin = svc.processAction('mp-leave', 'uA', { type: 'MOVE', to: { row: 0, col: seat.position.col } });
    expect(fin.success).toBe(true);

    const leave = svc.leaveGame('mp-leave', 'uA');
    expect(leave.left).toBe(true);
    if (!leave.left) return;
    expect(leave.forfeited).toBe(false);
    expect(g.state.players[0].place).toBe(1);
    expect(g.state.status).toBe('IN_PROGRESS');

    const leaveActive = svc.leaveGame('mp-leave', 'uB');
    expect(leaveActive.left).toBe(true);
    if (!leaveActive.left) return;
    expect(leaveActive.forfeited).toBe(true);
    // B takes the worst remaining place; with 2 of 3 finished, C is
    // auto-assigned 2nd and the game completes. A keeps 1st.
    expect(g.state.players[1].place).toBe(3);
    expect(g.state.status).toBe('COMPLETED');
    expect(g.state.winnerId).toBe('p1');
    expect(g.state.players[2].place).toBe(2);
  });

  it('premove-shaped online action is server-validated, not trusted', () => {
    const svc = new AuthoritativeGameService(undefined as any);
    make3P(svc, 'mp-premove');
    const g = svc.getGame('mp-premove')!;
    // Queueing client action for B while A is on turn: server rejects it.
    const rejected = svc.processAction('mp-premove', 'uB', {
      type: 'MOVE',
      to: { row: 8, col: 4 },
    });
    expect(rejected.success).toBe(false);
    if (rejected.success) return;
    expect(rejected.error.code).toBe('NOT_YOUR_TURN');
    expect(g.state.history).toHaveLength(0);
    // When A's real action is accepted, B's action becomes legal only if valid.
    const a = svc.processAction('mp-premove', 'uA', {
      type: 'MOVE',
      to: { row: 7, col: 1 },
    });
    expect(a.success).toBe(true);
    const b = svc.processAction('mp-premove', 'uB', {
      type: 'MOVE',
      to: { row: 7, col: 4 },
    });
    expect(b.success).toBe(true);
    if (!b.success) return;
    expect(g.state.history.map((m) => m.playerId)).toEqual(['p1', 'p2']);
  });

  it('1v1 regression: goal ends immediately with ratings', () => {
    const svc = new AuthoritativeGameService(undefined as any);
    svc.createGame({
      gameId: 'mp-1v1',
      mode: '2p',
      users: [
        { userId: 'uA', displayName: 'A', rating: { ...R } },
        { userId: 'uB', displayName: 'B', rating: { ...R } },
      ],
      timeControlMinutes: 0,
      isRanked: true,
    });
    const g = svc.getGame('mp-1v1')!;
    g.state.players[0].position = { row: 1, col: 4 };
    g.state.players[1].position = { row: 0, col: 0 };
    const r = svc.processAction('mp-1v1', 'uA', { type: 'MOVE', to: { row: 0, col: 4 } });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.ended).toBeDefined();
    expect(r.ended!.winnerId).toBe('p1');
    expect(r.ended!.placements).toBeUndefined();
    expect(Object.keys(r.ended!.ratingChanges ?? {}).sort()).toEqual(['uA', 'uB']);
  });

  it('active disconnect forfeits through the engine, match continues', () => {
    vi.useFakeTimers();
    const svc = new AuthoritativeGameService(undefined as any);
    make3P(svc, 'mp-timer');
    const calls: { ended: unknown; finished: unknown }[] = [];
    const res = svc.handleDisconnect('mp-timer', 'uB', ((ended: unknown, finished: unknown) => {
      calls.push({ ended, finished });
    }) as never);
    expect(res).not.toBeNull();
    // Ranked grace is 60s: expiry forfeits B (worst remaining place),
    // the match continues for A and C — no game:ended.
    vi.advanceTimersByTime(60_000);
    const g = svc.getGame('mp-timer')!;
    expect(g.state.players[1].status).toBe('FINISHED');
    expect(g.state.players[1].place).toBe(3);
    expect(g.state.status).toBe('IN_PROGRESS');
    expect(calls).toHaveLength(1);
    expect(calls[0].ended).toBeNull();
    expect((calls[0].finished as { place: number }).place).toBe(3);
  });
});
