import { describe, expect, it, vi } from 'vitest';
import {
  getMatchSetupDraft,
  sanitizeMatchSetupDraft,
  saveMatchSetupDraft,
} from './gameStorage';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
    multiGet: async () => [],
  },
}));

/**
 * Match setup drafts: last-used picks per entry kind. Unknown values
 * (downgrade, corrupt store) are dropped, never applied.
 */
describe('match setup drafts', () => {
  it('drops unknown values', () => {
    expect(sanitizeMatchSetupDraft(null)).toEqual({});
    expect(sanitizeMatchSetupDraft('nope')).toEqual({});
    expect(
      sanitizeMatchSetupDraft({
        mode: 'blitz',
        playerCount: 5,
        difficulty: 'grandmaster',
        side: 'green',
        wallsEach: 7,
        clockId: '',
      })
    ).toEqual({});
  });

  it('keeps valid picks, including an explicit null bot', () => {
    expect(
      sanitizeMatchSetupDraft({
        mode: 'race',
        playerCount: 4,
        difficulty: 'hard',
        botId: 'nox',
        side: 'random',
        wallsEach: 99,
        clockId: 'blitz-3-2',
        extra: true,
      })
    ).toEqual({
      mode: 'race',
      playerCount: 4,
      difficulty: 'hard',
      botId: 'nox',
      side: 'random',
      wallsEach: 99,
      clockId: 'blitz-3-2',
    });
  });

  it('round-trips per entry kind', () => {
    saveMatchSetupDraft('ai', { botId: 'nox', difficulty: 'hard' });
    saveMatchSetupDraft('local', { side: 'red' });
    expect(getMatchSetupDraft('ai')).toEqual({ botId: 'nox', difficulty: 'hard' });
    expect(getMatchSetupDraft('local')).toEqual({ side: 'red' });
    expect(getMatchSetupDraft('online')).toEqual({});
  });
});
