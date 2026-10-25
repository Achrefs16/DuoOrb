import { describe, expect, it } from 'vitest';
import { canUndoAiTurn, findUndoTargetStep } from './undo';

const eligible = {
  isAiGame: true,
  completed: false,
  isAiThinking: false,
  currentPlayerIndex: 0,
  humanSeatIndex: 0,
  historyLength: 4,
  humanSeatActive: true,
};

describe('AI undo eligibility', () => {
  it('allows undo only on a live human turn', () => {
    expect(canUndoAiTurn(eligible)).toBe(true);
    expect(canUndoAiTurn({ ...eligible, isAiGame: false })).toBe(false);
    expect(canUndoAiTurn({ ...eligible, completed: true })).toBe(false);
    expect(canUndoAiTurn({ ...eligible, isAiThinking: true })).toBe(false);
    expect(canUndoAiTurn({ ...eligible, currentPlayerIndex: 2 })).toBe(false);
    expect(canUndoAiTurn({ ...eligible, historyLength: 1 })).toBe(false);
    expect(canUndoAiTurn({ ...eligible, humanSeatActive: false })).toBe(false);
  });
});

describe('undo rewind target', () => {
  it('rewinds before the human move in a 2-player exchange', () => {
    const history = [{ playerId: 'you' }, { playerId: 'bot' }];
    expect(findUndoTargetStep(history, 'you')).toBe(0);
  });

  it('skips every bot reply in 3P/4P tables', () => {
    const history = [
      { playerId: 'you' },
      { playerId: 'bot-a' },
      { playerId: 'bot-b' },
      { playerId: 'bot-c' },
    ];
    expect(findUndoTargetStep(history, 'you')).toBe(0);
  });

  it('finds the latest human move when several rounds exist', () => {
    const history = [
      { playerId: 'you' },
      { playerId: 'bot' },
      { playerId: 'you' },
      { playerId: 'bot' },
      { playerId: 'bot-2' },
    ];
    expect(findUndoTargetStep(history, 'you')).toBe(2);
  });

  it('returns -1 when the human has not acted yet', () => {
    expect(findUndoTargetStep([{ playerId: 'bot' }], 'you')).toBe(-1);
    expect(findUndoTargetStep([], 'you')).toBe(-1);
  });
});
