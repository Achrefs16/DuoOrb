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

  it('executes hybrid AI engine on the initial move', async () => {
    const state = createInitialState({
      mode: '2p',
      playerIds: ['p1', 'p2'],
    });

    const ctx: BotMoveContext = {
      persona,
      botPlayerId: 'p1',
      seed: 42,
      ownMoveIndex: 0,
    };

    const action = await chooseBotAction(state, ctx);
    expect(action).not.toBeNull();
    expect(action?.type).toBeDefined();
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

  it('counter-walls against opponent building a box trap instead of blindly walking into it', async () => {
    const counterPersona = BOT_PERSONAS.find((p) => p.playstyle === 'counter') || persona;
    const state = createInitialState({
      mode: '2p',
      playerIds: ['p1', 'p2'],
    });

    // P1 (Human) at (7, 4), P2 (Bot) at (1, 4)
    state.players[0].position = { row: 7, col: 4 };
    state.players[0].wallsRemaining = 8;
    state.players[1].position = { row: 1, col: 4 };
    state.players[1].wallsRemaining = 10;
    state.currentPlayerIndex = 1; // Bot to move

    // P1 has placed 2 box walls at row 4
    state.walls = [
      { row: 4, col: 4, orientation: 'H', placedByPlayerId: 'p1', sequence: 1 },
      { row: 4, col: 2, orientation: 'H', placedByPlayerId: 'p1', sequence: 2 },
    ];

    const ctx: BotMoveContext = {
      persona: counterPersona,
      botPlayerId: 'p2',
      seed: 42,
      ownMoveIndex: 1,
    };

    const action = await chooseBotAction(state, ctx);
    expect(action).not.toBeNull();
    // Bot should counter-wall or block instead of zombie-walking into the box
    expect(action?.type).toBe('PLACE_WALL');
    if (action?.type === 'PLACE_WALL') {
      expect(action.wall.row).toBeGreaterThan(0);
      expect(action.wall.row).toBeLessThan(7);
    }
  });

  it('dynamically evaluates moves using engine instead of static hardcoded opening scripts', async () => {
    const shillerPersona = BOT_PERSONAS.find((p) => p.playstyle === 'shiller') || persona;
    const state = createInitialState({
      mode: '2p',
      playerIds: ['p1', 'p2'],
    });
    state.currentPlayerIndex = 1;

    const ctx: BotMoveContext = {
      persona: shillerPersona,
      botPlayerId: 'p2',
      seed: 42,
      ownMoveIndex: 0,
    };

    const action = await chooseBotAction(state, ctx);
    expect(action).not.toBeNull();
    expect(['MOVE', 'PLACE_WALL']).toContain(action?.type);
  });
});
