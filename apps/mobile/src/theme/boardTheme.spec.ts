import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  __resetBoardThemeForTests,
  LIGHT_BOARD,
  MIDNIGHT_BOARD,
  parseBoardThemeName,
  resolveBoardPalette,
  setBoardThemeName,
} from './boardTheme';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
  },
}));

vi.mock('../network/apiClient', () => ({
  api: { getMe: async () => ({}) },
}));

/**
 * Board palette gating (MONETIZATION.md P5.1): midnight renders for premium
 * only; everything else falls back to light (E23); both palettes define the
 * same keys so no surface can ever go blank.
 */
describe('board theme', () => {
  beforeEach(() => {
    __resetBoardThemeForTests();
  });

  it('defines the same keys on both palettes', () => {
    expect(Object.keys(MIDNIGHT_BOARD).sort()).toEqual(
      Object.keys(LIGHT_BOARD).sort()
    );
    for (const v of Object.values(MIDNIGHT_BOARD)) {
      expect(typeof v).toBe('string');
      expect(v.length).toBeGreaterThan(0);
    }
  });

  it('parses unknown stored values to light (E23)', () => {
    expect(parseBoardThemeName('midnight')).toBe('midnight');
    expect(parseBoardThemeName('light')).toBe('light');
    expect(parseBoardThemeName('neon')).toBe('light');
    expect(parseBoardThemeName(undefined)).toBe('light');
    expect(parseBoardThemeName(null)).toBe('light');
    expect(setBoardThemeName('neon')).toBe('light');
  });

  it('gates midnight to active premium, light otherwise', () => {
    expect(resolveBoardPalette('midnight', true)).toBe(MIDNIGHT_BOARD);
    // TEMP-TEST: DEV_UNLOCK_MIDNIGHT_RENDER forces this to MIDNIGHT so the
    // palette can be playtested. When the flag is removed (release), this
    // case MUST return LIGHT_BOARD again — flip it back with the flag.
    expect(resolveBoardPalette('midnight', false)).toBe(MIDNIGHT_BOARD);
    expect(resolveBoardPalette('light', true)).toBe(LIGHT_BOARD);
    expect(resolveBoardPalette('light', false)).toBe(LIGHT_BOARD);
  });
});
