import { describe, expect, it, vi } from 'vitest';

vi.mock('@expo/vector-icons', () => ({
  Feather: () => null,
  MaterialCommunityIcons: () => null,
  MaterialIcons: () => null,
}));

import { seatStatusLabel } from '../components/GameHud';

/**
 * F8 card copy: consequence-naming variants for the seat racing the
 * deadline, honest offline copy, and low-time urgency is visual-only here
 * (covered by the chip, not the label).
 */
describe('seatStatusLabel (F8)', () => {
  it('names the consequence on the racing seat, the condition elsewhere', () => {
    expect(seatStatusLabel({ kind: 'disconnected', secondsLeft: 37, mine: true })).toBe(
      'You forfeit in 37s'
    );
    expect(seatStatusLabel({ kind: 'disconnected', secondsLeft: 37 })).toBe('Disconnected · 37s');
    expect(seatStatusLabel({ kind: 'afk', secondsLeft: 12, mine: true })).toBe(
      'Move or forfeit · 12s'
    );
    expect(seatStatusLabel({ kind: 'afk', secondsLeft: 12 })).toBe('No move · 12s');
  });

  it('distinguishes a dead link from a dropped socket, and pending work', () => {
    expect(seatStatusLabel({ kind: 'reconnecting', pendingCount: 0, offline: true })).toBe(
      "You're offline · retrying"
    );
    expect(seatStatusLabel({ kind: 'reconnecting', pendingCount: 2 })).toBe(
      'Reconnecting… · 2 to send'
    );
    expect(seatStatusLabel({ kind: 'reconnecting', pendingCount: 0 })).toBe('Reconnecting…');
  });
});
