import { describe, expect, it } from 'vitest';
import { AuthoritativeGameService } from './authoritative-game.service.js';

const RATING = { rating: 1500, rd: 350, vol: 0.06 };

function seatGame() {
  const service = new AuthoritativeGameService();
  const game = service.createGame({
    gameId: 'rename-test',
    mode: '2p',
    users: [
      { userId: 'u_alice', displayName: 'alice_old', rating: RATING },
      { userId: 'u_bob', displayName: 'bob', rating: RATING },
    ],
    timeControlMinutes: 3,
    incrementSeconds: 0,
    isRanked: true,
  });
  return { service, game };
}

describe('Player renaming', () => {
  it('updates the name in a live game so a rename is not invisible until the rematch', () => {
    const { service, game } = seatGame();
    expect(game.state.players.map((p) => p.displayName)).toEqual(['alice_old', 'bob']);

    const changed = service.setPlayerName('u_alice', 'alice_new');

    expect(changed).toContain('rename-test');
    expect(game.state.players.map((p) => p.displayName)).toEqual(['alice_new', 'bob']);
  });

  it('leaves other players untouched', () => {
    const { service, game } = seatGame();
    service.setPlayerName('u_bob', 'bobby');

    expect(game.state.players.map((p) => p.displayName)).toEqual(['alice_old', 'bobby']);
  });

  it('reports no change for an unknown user or an unchanged name', () => {
    const { service } = seatGame();

    expect(service.setPlayerName('u_nobody', 'ghost')).toEqual([]);
    expect(service.setPlayerName('u_alice', 'alice_old')).toEqual([]);
  });

  it('ignores an empty name rather than blanking a player', () => {
    const { service, game } = seatGame();

    expect(service.setPlayerName('u_alice', '')).toEqual([]);
    expect(game.state.players.map((p) => p.displayName)).toEqual(['alice_old', 'bob']);
  });
});
