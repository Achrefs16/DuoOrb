import { describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
  },
}));

vi.mock('socket.io-client', () => ({
  io: () => ({
    on() {},
    off() {},
    emit() {},
    connect() {},
    disconnect() {},
    removeAllListeners() {},
    io: { on() {} },
  }),
}));

import { groupReactionsBySeat } from './useQuickReactions';

/**
 * Per-card reaction attribution: relayed reactions render over the sender's
 * card; anything unresolvable keeps the legacy top-strip dock.
 */
describe('groupReactionsBySeat', () => {
  const seats = { uB: 'p2', uC: 'p3' };

  it('routes each sender to their own seat', () => {
    const { bySeat, fallback } = groupReactionsBySeat(
      [
        { id: 1, kind: 'fire', fromUserId: 'uB' },
        { id: 2, kind: 'laugh', fromUserId: 'uC' },
      ],
      seats
    );
    expect(Object.keys(bySeat).sort()).toEqual(['p2', 'p3']);
    expect(bySeat['p2'].map((r) => r.id)).toEqual([1]);
    expect(bySeat['p3'].map((r) => r.id)).toEqual([2]);
    expect(fallback).toHaveLength(0);
  });

  it('falls back for unknown senders, left seats, and senderless banter', () => {
    const { bySeat, fallback } = groupReactionsBySeat(
      [
        { id: 1, kind: 'fire', fromUserId: 'uGone' },
        { id: 2, kind: 'clap' },
      ],
      seats
    );
    expect(bySeat).toEqual({});
    expect(fallback.map((r) => r.id)).toEqual([1, 2]);
  });

  it('stacks several reactions on one seat', () => {
    const { bySeat, fallback } = groupReactionsBySeat(
      [
        { id: 1, kind: 'fire', fromUserId: 'uB' },
        { id: 2, kind: 'fire', fromUserId: 'uB' },
      ],
      seats
    );
    expect(bySeat['p2']).toHaveLength(2);
    expect(fallback).toHaveLength(0);
  });
});
