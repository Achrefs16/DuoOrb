import { describe, expect, it } from 'vitest';
import { createInitialState } from '@duoorb/game-core';
import { chooseBotAction, type BotMoveContext } from './bot-move.js';
import { BOT_PERSONAS } from './bot-roster.js';

describe('bot-move', () => {
  const persona = BOT_PERSONAS[0];

  it('returns null if game is not in progress or not bot turn', async () => {
    const state = createInitialState({
      mode: '2p',
      playerIds: ['p1', 'p2'],
    });

    const ctx: BotMoveContext = {
      persona,
      botPlayerId: 'p2', // p1's turn initially!
      seed: 42,
      ownMoveIndex: 0,
    };

    const action = await chooseBotAction(state, ctx);
    expect(action).toBeNull();
  });

  it('takes immediate win when adjacent to goal row', async () => {
    // p1 starts at (8, 4) goal is TOP (row 0)
    const state = createInitialState({
      mode: '2p',
      playerIds: ['p1', 'p2'],
    });
    // Teleport p1 to row 1, col 4, adjacent to goal row 0
    state.players[0].position = { row: 1, col: 4 };

    const ctx: BotMoveContext = {
      persona,
      botPlayerId: 'p1',
      seed: 42,
      ownMoveIndex: 5,
    };

    const action = await chooseBotAction(state, ctx);
    expect(action).not.toBeNull();
    expect(action?.type).toBe('MOVE');
    if (action?.type === 'MOVE') {
      expect(action.to.row).toBe(0);
    }
  });

  it('uses opening plan on the initial move', async () => {
    const state = createInitialState({
      mode: '2p',
      playerIds: ['p1', 'p2'],
    });

    const ctx: BotMoveContext = {
      persona,
      botPlayerId: 'p1',
      seed: 42,
      ownMoveIndex: 0,
      openingPlan: ['A', 'A', 'A', 'A', 'A'],
    };

    const action = await chooseBotAction(state, ctx);
    expect(action).not.toBeNull();
    expect(action?.type).toBe('MOVE');
    if (action?.type === 'MOVE') {
      expect(action.to).toEqual({ row: 7, col: 4 });
    }
  });

  it('cancels calculation if shouldCancel returns true', async () => {
    const state = createInitialState({
      mode: '2p',
      playerIds: ['p1', 'p2'],
    });

    const ctx: BotMoveContext = {
      persona,
      botPlayerId: 'p1',
      seed: 42,
      ownMoveIndex: 10, // past opening plan
      shouldCancel: () => true,
    };

    const action = await chooseBotAction(state, ctx);
    expect(action).toBeNull();
  });

  it('executes ONNX engine for personas with useOnnx: true', async () => {
    const onnxPersona = BOT_PERSONAS.find((p) => p.useOnnx);
    expect(onnxPersona).toBeDefined();
    if (!onnxPersona) return;

    const state = createInitialState({
      mode: '2p',
      playerIds: ['p1', 'p2'],
    });

    const ctx: BotMoveContext = {
      persona: onnxPersona,
      botPlayerId: 'p1',
      seed: 42,
      ownMoveIndex: 10, // past opening plan
    };

    const action = await chooseBotAction(state, ctx);
    expect(action).not.toBeNull();
  });

  it('promotes low-tier bots to Milo ONNX engine when forceMilo is true (hot streak)', async () => {
    const lowTierPersona = BOT_PERSONAS.find((p) => !p.useOnnx);
    expect(lowTierPersona).toBeDefined();
    if (!lowTierPersona) return;

    const state = createInitialState({
      mode: '2p',
      playerIds: ['p1', 'p2'],
    });

    const ctx: BotMoveContext = {
      persona: lowTierPersona,
      botPlayerId: 'p1',
      seed: 42,
      ownMoveIndex: 10,
      forceMilo: true,
    };

    const action = await chooseBotAction(state, ctx);
    expect(action).not.toBeNull();
  });
});
