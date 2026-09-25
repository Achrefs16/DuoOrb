import { describe, it, expect } from 'vitest';
import { Glicko2Service, GlickoPlayer } from './glicko2.service.js';

/** Deterministic RNG so the sim is a regression test, not a flaky gamble. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng: () => number) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

interface SimPlayer {
  skill: number;
  model: GlickoPlayer;
  games: number;
}

/**
 * Population simulation: fixed hidden skills, mixed 1v1/3P/4P tables,
 * results sampled from skill + noise. Checks the universal rating is
 * stable (no inflation drift) and skill-ordered (strong climbs, weak falls).
 */
describe('universal rating population simulation', () => {
  it('mixed tables converge skill-ordered without drift', () => {
    const svc = new Glicko2Service();
    const rng = mulberry32(20260925);
    const skills = [1200, 1400, 1600, 1800, 2000];
    const players: SimPlayer[] = [];
    for (const s of skills) {
      for (let i = 0; i < 10; i++) {
        players.push({ skill: s, model: { rating: 1500, rd: 350, vol: 0.06 }, games: 0 });
      }
    }

    const ROUNDS = 60;
    for (let round = 0; round < ROUNDS; round++) {
      // Shuffle and deal mixed tables.
      const order = [...players].sort(() => rng() - 0.5);
      let i = 0;
      while (i < order.length) {
        const roll = rng();
        const size = roll < 0.4 ? 2 : roll < 0.7 ? 3 : 4;
        const table = order.slice(i, i + size);
        i += size;
        if (table.length < 2) break;
        // Performance = skill + noise; rank best-first.
        const ranked = table
          .map((p) => ({ p, perf: p.skill + gaussian(rng) * 200 }))
          .sort((a, b) => b.perf - a.perf);
        if (ranked.length === 2) {
          const res = svc.update1v1(ranked[0].p.model, ranked[1].p.model, 1.0);
          ranked[0].p.model = res.p1;
          ranked[1].p.model = res.p2;
        } else {
          const out = svc.updateMultiplayer(
            ranked.map((r, idx) => ({ player: r.p.model, rank: idx + 1 }))
          );
          ranked.forEach((r, idx) => {
            r.p.model = out[idx];
          });
        }
        for (const r of ranked) r.p.games += 1;
      }
    }

    const ratings = players.map((p) => p.model.rating);
    expect(ratings.every((r) => Number.isFinite(r))).toBe(true);
    const mean = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    // Glicko is not perfectly zero-sum, but the population must not drift far.
    expect(mean).toBeGreaterThan(1400);
    expect(mean).toBeLessThan(1600);
    expect(Math.min(...ratings)).toBeGreaterThan(700);
    expect(Math.max(...ratings)).toBeLessThan(2700);

    const groupMean = (skill: number) => {
      const g = players.filter((p) => p.skill === skill).map((p) => p.model.rating);
      return g.reduce((a, b) => a + b, 0) / g.length;
    };
    const means = skills.map(groupMean);
    for (let k = 1; k < means.length; k++) {
      expect(means[k]).toBeGreaterThan(means[k - 1]);
    }
    // Separation is decisive, not marginal.
    expect(means[4] - means[0]).toBeGreaterThan(250);

    // Experience shows: RD collapses from 350 for everyone.
    const avgRd = players.reduce((a, p) => a + p.model.rd, 0) / players.length;
    expect(avgRd).toBeLessThan(200);

    // eslint-disable-next-line no-console
    console.log(
      'sim group means:',
      skills.map((s, k) => `${s}->${Math.round(means[k])}`).join(' '),
      `population mean ${Math.round(mean)}`
    );
  });
});
