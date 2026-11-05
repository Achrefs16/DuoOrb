import { describe, expect, it } from 'vitest';
import { createInitialState, applyAction } from '@duoorb/game-core';
import { GAME_SCRIPTS } from './bot-history-seeder.js';

describe('Bot History Game Scripts', () => {
  it('every script in GAME_SCRIPTS is 100% legal and ends with a winner', () => {
    GAME_SCRIPTS.forEach((script, scriptIdx) => {
      let state = createInitialState({ mode: '2p' });
      for (let i = 0; i < script.length; i++) {
        const step = script[i];
        const res = applyAction(state, step.action as any);
        expect(res.success, `Script ${scriptIdx + 1} failed at step ${i + 1}: ${JSON.stringify(step)} error: ${JSON.stringify(res.error)}`).toBe(true);
        if (res.success) {
          state = res.state;
        }
      }
      expect(state.status).toBe('COMPLETED');
      expect(state.winnerId).toBeDefined();
    });
  });
});
