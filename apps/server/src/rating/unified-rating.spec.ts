import { describe, it, expect } from 'vitest';
import {
  Glicko2Service,
  RATING_INFO_WEIGHT_3P,
  RATING_INFO_WEIGHT_4P,
  infoWeightForPlayerCount,
} from './glicko2.service.js';
import { RatingsService } from './ratings.service.js';

const fresh = () => ({ rating: 1500, rd: 350, vol: 0.06 });
const est = () => ({ rating: 1500, rd: 50, vol: 0.06 });

describe('universal Glicko-2', () => {
  it('weight 1 is the classic update (backward compatible)', () => {
    const svc = new Glicko2Service();
    const a = svc.updatePlayer(fresh(), [{ opponent: fresh(), score: 1 }]);
    const b = svc.updatePlayer(fresh(), [{ opponent: fresh(), score: 1 }], 1);
    expect(a).toEqual(b);
    expect(a.rating).toBeGreaterThan(1500);
  });

  it('1v1: equal win gains, loss mirrors; draws hold', () => {
    const svc = new Glicko2Service();
    const { p1, p2 } = svc.update1v1(fresh(), fresh(), 1.0);
    expect(p1.rating).toBeGreaterThan(1500);
    expect(p2.rating).toBeLessThan(1500);
    // Symmetric field: winner gain ≈ loser loss.
    expect(Math.abs(p1.rating - 1500 + (p2.rating - 1500))).toBeLessThanOrEqual(2);

    const d = svc.update1v1(fresh(), fresh(), 0.5);
    expect(d.p1.rating).toBe(1500);
    expect(d.p2.rating).toBe(1500);
  });

  it('1v1: beating stronger gains more; losing to stronger hurts less', () => {
    const svc = new Glicko2Service();
    const weak = { rating: 1300, rd: 100, vol: 0.06 };
    const strong = { rating: 1700, rd: 100, vol: 0.06 };
    const upset = svc.update1v1({ ...weak }, { ...strong }, 1.0);
    const expected = svc.update1v1({ ...strong }, { ...weak }, 1.0);
    expect(upset.p1.rating - 1300).toBeGreaterThan(expected.p1.rating - 1700);
    // Strong losing to weak hurts more than weak losing to strong.
    const strongLoss = svc.update1v1({ ...strong }, { ...weak }, 0.0);
    const weakLoss = svc.update1v1({ ...weak }, { ...strong }, 0.0);
    expect(1700 - strongLoss.p1.rating).toBeGreaterThan(1300 - weakLoss.p1.rating);
  });

  it('1v1: provisional (high RD) moves more than established (low RD)', () => {
    const svc = new Glicko2Service();
    const prov = svc.update1v1(fresh(), { rating: 1500, rd: 100, vol: 0.06 }, 1.0);
    const estab = svc.update1v1(est(), { rating: 1500, rd: 100, vol: 0.06 }, 1.0);
    expect(prov.p1.rating - 1500).toBeGreaterThan(estab.p1.rating - 1500);
  });

  it('3P equal field: 1st gains, 2nd ~flat, 3rd loses — all below 1v1 impact', () => {
    const svc = new Glicko2Service();
    const out = svc.updateMultiplayer([
      { player: fresh(), rank: 1 },
      { player: fresh(), rank: 2 },
      { player: fresh(), rank: 3 },
    ]);
    const solo = svc.update1v1(fresh(), fresh(), 1.0);
    expect(out[0].rating).toBeGreaterThan(1500);
    expect(Math.abs(out[1].rating - 1500)).toBeLessThanOrEqual(3);
    expect(out[2].rating).toBeLessThan(1500);
    expect(out[0].rating - 1500).toBeLessThan(solo.p1.rating - 1500);
    expect(1500 - out[2].rating).toBeLessThan(1500 - solo.p2.rating);
  });

  it('3P: weak winner gains more than strong winner; uses the whole field', () => {
    const svc = new Glicko2Service();
    const field = [
      { rating: 1700, rd: 100, vol: 0.06 },
      { rating: 1550, rd: 100, vol: 0.06 },
      { rating: 1400, rd: 100, vol: 0.06 },
    ];
    // 1400-rated player takes 1st over 1700+1550.
    const weakWin = svc.updateMultiplayer([
      { player: { ...field[2] }, rank: 1 },
      { player: { ...field[0] }, rank: 2 },
      { player: { ...field[1] }, rank: 3 },
    ]);
    // 1700-rated player takes 1st over the same field shape (rotated).
    const strongWin = svc.updateMultiplayer([
      { player: { ...field[0] }, rank: 1 },
      { player: { ...field[1] }, rank: 2 },
      { player: { ...field[2] }, rank: 3 },
    ]);
    expect(weakWin[0].rating - 1400).toBeGreaterThan(strongWin[0].rating - 1700);
    // Winner ahead of a stronger field gains more than ahead of a weak one.
    const weakField = svc.updateMultiplayer([
      { player: { rating: 1500, rd: 100, vol: 0.06 }, rank: 1 },
      { player: { rating: 1300, rd: 100, vol: 0.06 }, rank: 2 },
      { player: { rating: 1250, rd: 100, vol: 0.06 }, rank: 3 },
    ]);
    const strongField = svc.updateMultiplayer([
      { player: { rating: 1500, rd: 100, vol: 0.06 }, rank: 1 },
      { player: { rating: 1700, rd: 100, vol: 0.06 }, rank: 2 },
      { player: { rating: 1750, rd: 100, vol: 0.06 }, rank: 3 },
    ]);
    expect(strongField[0].rating - 1500).toBeGreaterThan(weakField[0].rating - 1500);
  });

  it('4P equal field: 1st gains most, 2nd small+, 3rd small-, 4th loses', () => {
    const svc = new Glicko2Service();
    const out = svc.updateMultiplayer([1, 2, 3, 4].map((rank) => ({ player: fresh(), rank })));
    expect(out[0].rating).toBeGreaterThan(1500);
    expect(out[1].rating).toBeGreaterThanOrEqual(1500);
    expect(out[2].rating).toBeLessThanOrEqual(1500);
    expect(out[3].rating).toBeLessThan(1500);
    // Strictly ordered by placement.
    expect(out[0].rating).toBeGreaterThan(out[1].rating);
    expect(out[1].rating).toBeGreaterThan(out[2].rating);
    expect(out[2].rating).toBeGreaterThan(out[3].rating);
    // 4P winner gains less than 3P winner over equal fields.
    const three = svc.updateMultiplayer([1, 2, 3].map((rank) => ({ player: fresh(), rank })));
    expect(out[0].rating - 1500).toBeLessThan(three[0].rating - 1500);
  });

  it('2P race/center modes are full-weight 1v1 (player count rules)', () => {
    expect(infoWeightForPlayerCount(2)).toBe(1.0);
    expect(infoWeightForPlayerCount(3)).toBe(RATING_INFO_WEIGHT_3P);
    expect(infoWeightForPlayerCount(4)).toBe(RATING_INFO_WEIGHT_4P);
    expect(RATING_INFO_WEIGHT_3P).toBeGreaterThan(RATING_INFO_WEIGHT_4P);
  });

  it('RD shrinks with play; volatility stays bounded', () => {
    const svc = new Glicko2Service();
    let p = fresh();
    for (let i = 0; i < 10; i++) {
      p = svc.updatePlayer(p, [{ opponent: fresh(), score: i % 2 === 0 ? 1 : 0 }]);
    }
    expect(p.rd).toBeLessThan(350);
    expect(p.rd).toBeGreaterThanOrEqual(30);
    expect(p.vol).toBeGreaterThan(0);
    expect(p.vol).toBeLessThan(1);
  });
});

describe('anti-farming flags (observability only)', () => {
  it('flags repeated lopsided opponents and fresh-account swings', () => {
    const svc = new RatingsService(undefined as any);
    const repeated = Array.from({ length: 9 }, (_, i) => ({
      gameId: `g${i}`,
      opponentUserId: 'opp-1',
      delta: -40,
      gamesPlayedBefore: 50,
    }));
    expect(svc.flagSuspiciousTransfers(repeated)).toHaveLength(1);
    const clean = [
      { gameId: 'a', opponentUserId: 'x', delta: 10, gamesPlayedBefore: 50 },
      { gameId: 'b', opponentUserId: 'y', delta: -8, gamesPlayedBefore: 51 },
    ];
    expect(svc.flagSuspiciousTransfers(clean)).toHaveLength(0);
    const freshSwing = Array.from({ length: 4 }, (_, i) => ({
      gameId: `f${i}`,
      opponentUserId: `o${i}`,
      delta: 90,
      gamesPlayedBefore: i,
    }));
    expect(svc.flagSuspiciousTransfers(freshSwing)).toHaveLength(1);
  });
});
