import { describe, expect, it } from 'vitest';
import { Glicko2Service, GlickoPlayer } from '../src/rating/glicko2.service.js';

describe('Glicko-2 Rating Service', () => {
  const service = new Glicko2Service();

  it('updates 1v1 ratings accurately: winner increases, loser decreases, RD narrows', () => {
    const p1: GlickoPlayer = { rating: 1500, rd: 200, vol: 0.06 };
    const p2: GlickoPlayer = { rating: 1500, rd: 200, vol: 0.06 };

    // P1 wins against P2
    const result = service.update1v1(p1, p2, 1.0);

    expect(result.p1.rating).toBeGreaterThan(1500);
    expect(result.p2.rating).toBeLessThan(1500);
    // Rating deviation should decrease as certainty increases
    expect(result.p1.rd).toBeLessThan(200);
    expect(result.p2.rd).toBeLessThan(200);
  });

  it('computes 4-player free-for-all placement ratings', () => {
    const players: { player: GlickoPlayer; rank: number }[] = [
      { player: { rating: 1500, rd: 200, vol: 0.06 }, rank: 1 }, // 1st place
      { player: { rating: 1500, rd: 200, vol: 0.06 }, rank: 2 }, // 2nd place
      { player: { rating: 1500, rd: 200, vol: 0.06 }, rank: 3 }, // 3rd place
      { player: { rating: 1500, rd: 200, vol: 0.06 }, rank: 4 }, // 4th place
    ];

    const updated = service.update4Player(players);

    expect(updated).toHaveLength(4);
    // 1st place should have highest rating gain
    expect(updated[0].rating).toBeGreaterThan(1500);
    // 4th place should drop significantly
    expect(updated[3].rating).toBeLessThan(1500);
    // 1st > 2nd > 3rd > 4th
    expect(updated[0].rating).toBeGreaterThan(updated[1].rating);
    expect(updated[1].rating).toBeGreaterThan(updated[2].rating);
    expect(updated[2].rating).toBeGreaterThan(updated[3].rating);
  });
});
