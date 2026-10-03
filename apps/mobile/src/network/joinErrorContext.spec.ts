import { describe, it, expect } from 'vitest';
import { classifyGameError } from './useOnlineGame.js';

/**
 * A `game:error` is a JOIN rejection exactly when the join is still
 * unanswered — even with a stale board on screen (rematch switch, rejoin
 * after eviction, drifted identity). Anything later rejected one action.
 */
describe('classifyGameError', () => {
  it('join outstanding + stale board => join (terminal)', () => {
    expect(classifyGameError({ joinOutstanding: true, hasBoard: true })).toBe('join');
  });

  it('join outstanding, no board yet => join (terminal)', () => {
    expect(classifyGameError({ joinOutstanding: true, hasBoard: false })).toBe('join');
  });

  it('settled channel + live board => action (transient)', () => {
    expect(classifyGameError({ joinOutstanding: false, hasBoard: true })).toBe('action');
  });

  it('settled channel, no board => join (terminal)', () => {
    expect(classifyGameError({ joinOutstanding: false, hasBoard: false })).toBe('join');
  });
});
