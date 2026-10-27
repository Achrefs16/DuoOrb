import { describe, expect, it } from 'vitest';
import {
  isSideAvailable,
  isSideChoice,
  resolveSideChoice,
  sideIndexForChoice,
  sidesForCount,
} from './sideChoice';

describe('side choice', () => {
  it('offers only the seats that exist in the match', () => {
    expect(sidesForCount(2)).toEqual(['blue', 'red']);
    expect(sidesForCount(3)).toEqual(['blue', 'red', 'green']);
    expect(sidesForCount(4)).toEqual(['blue', 'red', 'green', 'amber']);
  });

  it('validates persisted side values and skips seats outside the match', () => {
    expect(isSideChoice('green')).toBe(true);
    expect(isSideChoice('amber')).toBe(true);
    expect(isSideChoice('yellow')).toBe(false);
    expect(isSideAvailable('green', 3)).toBe(true);
    expect(isSideAvailable('green', 2)).toBe(false);
    expect(isSideAvailable('random', 2)).toBe(true);
  });

  it('resolves random only across seats that exist', () => {
    expect(resolveSideChoice('random', '2p', () => 0)).toBe('blue');
    expect(resolveSideChoice('random', '2p', () => 0.99)).toBe('red');
    expect(resolveSideChoice('random', 'center3', () => 0)).toBe('blue');
    expect(resolveSideChoice('random', 'center3', () => 0.99)).toBe('green');
    expect(resolveSideChoice('random', '4p', () => 0.99)).toBe('amber');
  });

  it('maps every colour to the correct seat and mode', () => {
    expect(sideIndexForChoice('blue', 2)).toBe(0);
    expect(sideIndexForChoice('red', 2)).toBe(1);
    expect(sideIndexForChoice('green', 3)).toBe(2);
    expect(sideIndexForChoice('amber', 4)).toBe(3);
    expect(sideIndexForChoice('amber', 3)).toBe(0);
    expect(sideIndexForChoice('random', 4, () => 0.7)).toBe(2);
  });

  it('keeps concrete choices only inside the mode seat count', () => {
    expect(resolveSideChoice('green', 'center2')).toBe('blue');
    expect(resolveSideChoice('amber', 'race3')).toBe('blue');
    expect(resolveSideChoice('red', 'race2')).toBe('red');
    expect(resolveSideChoice('green', 'center3')).toBe('green');
    expect(resolveSideChoice('amber', '4p')).toBe('amber');
  });
});
