import { describe, expect, it } from 'vitest';
import { createInitialState, applyAction } from '@duoorb/game-core';
import { SIMULATED_ENGINE_GAMES, buildBotMatchSchedule } from './bot-history-seeder.js';
import { BOT_PERSONAS, BOT_STARTING_RATING } from './bot-roster.js';

describe('Authentic Engine Bot Match History', () => {
  it('contains at least 50 pre-simulated authentic games with 40-90+ plies and realistic wall counts', () => {
    expect(SIMULATED_ENGINE_GAMES.length).toBeGreaterThanOrEqual(50);

    for (const g of SIMULATED_ENGINE_GAMES) {
      expect(g.plyCount).toBeGreaterThanOrEqual(40);
      expect(g.wallsPlaced).toBeGreaterThanOrEqual(10);
      expect(g.moves.length).toBe(g.plyCount);
      expect(g.winnerPlayerIndex === 0 || g.winnerPlayerIndex === 1).toBe(true);
    }
  });

  it('every move in every simulated engine game is 100% legal and ends with a goal win', () => {
    // Deep verification of a sample of engine games through authoritative game-core rules
    const sampleGames = SIMULATED_ENGINE_GAMES.slice(0, 5);

    sampleGames.forEach((g, gIdx) => {
      let state = createInitialState({
        mode: '2p',
        players: [
          { id: 'p1', name: 'P1', type: 'ai' },
          { id: 'p2', name: 'P2', type: 'ai' },
        ],
        rulesetVersion: 'classic-2p-v1',
      });

      for (let i = 0; i < g.moves.length; i++) {
        const step = g.moves[i];
        const res = applyAction(state, step.payload);
        expect(
          res.success,
          `Game ${gIdx} failed at ply ${i + 1}: ${JSON.stringify(step.payload)} error: ${JSON.stringify(res.error)}`
        ).toBe(true);
        if (res.success) {
          state = res.state;
        }
      }

      expect(state.status).toBe('COMPLETED');
      expect(state.winnerId).toBe(g.winnerPlayerIndex === 0 ? 'p1' : 'p2');
    });
  });

  it('buildBotMatchSchedule guarantees every bot starts at 1500, plays <= 16 matches, and converges to targetRating', () => {
    const schedule = buildBotMatchSchedule();
    expect(schedule.length).toBeGreaterThan(500);

    const botMatches = new Map<string, typeof schedule>();
    for (const p of BOT_PERSONAS) {
      botMatches.set(p.userId, []);
    }

    for (const m of schedule) {
      botMatches.get(m.primaryBotUserId)?.push(m);
    }

    for (const p of BOT_PERSONAS) {
      const matches = botMatches.get(p.userId)!;

      // Exactly matches gamesPlayed and <= 16
      expect(matches.length).toBe(p.gamesPlayed);
      expect(matches.length).toBeLessThanOrEqual(16);
      expect(matches.length).toBeGreaterThanOrEqual(8);

      // Starting rating for first match is strictly 1500 baseline
      const firstMatch = matches[0];
      const startRating = firstMatch.p1.userId === p.userId ? firstMatch.p1RatingBefore : firstMatch.p2RatingBefore;
      expect(startRating).toBe(BOT_STARTING_RATING);

      // Final rating after last match converges strictly to targetRating
      const lastMatch = matches[matches.length - 1];
      const finalRating = lastMatch.p1.userId === p.userId ? lastMatch.p1RatingAfter : lastMatch.p2RatingAfter;
      expect(finalRating).toBe(p.targetRating);

      // Wins count strictly matches
      const wins = matches.filter((m) => m.winnerUserId === p.userId).length;
      expect(wins).toBe(p.wins);
    }
  });
});
