import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  __resetBoardThemeForTests,
  BOARD_SKINS,
  CLASSIC_LIGHT_SKIN,
  CLASSIC_MIDNIGHT_SKIN,
  LIGHT_BOARD,
  MIDNIGHT_BOARD,
  WALNUT_SKIN,
  parseBoardSkinId,
  parseBoardThemeName,
  resolveBoardPalette,
  resolveBoardSkin,
  setBoardSkinId,
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
 * Board skin system: Midnight is free for everyone; walnut needs an active
 * premium membership (dev builds preview unlocked) and falls back to classic
 * otherwise. Unknown stored values parse to classic/light (E23); every skin
 * carries the full palette surface so no board can ever go blank.
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

  it('renders midnight free — no premium gate, no dev flag', () => {
    expect(resolveBoardPalette('midnight')).toBe(MIDNIGHT_BOARD);
    expect(resolveBoardPalette('light')).toBe(LIGHT_BOARD);
  });

  it('parses unknown skin ids to classic (E23)', () => {
    expect(parseBoardSkinId('walnut')).toBe('walnut');
    expect(parseBoardSkinId('classic')).toBe('classic');
    expect(parseBoardSkinId('glacier')).toBe('classic');
    expect(parseBoardSkinId('arena')).toBe('classic');
    expect(parseBoardSkinId('neon')).toBe('classic');
    expect(parseBoardSkinId(undefined)).toBe('classic');
    expect(parseBoardSkinId(null)).toBe('classic');
    expect(setBoardSkinId('neon')).toBe('classic');
  });

  it('classic follows the appearance in both modes', () => {
    expect(resolveBoardSkin('classic', false, 'light')).toBe(CLASSIC_LIGHT_SKIN);
    expect(resolveBoardSkin('classic', false, 'midnight')).toBe(CLASSIC_MIDNIGHT_SKIN);
    // Premium members see the same free classic surface.
    expect(resolveBoardSkin('classic', true, 'light')).toBe(CLASSIC_LIGHT_SKIN);
    expect(resolveBoardSkin('classic', true, 'midnight')).toBe(CLASSIC_MIDNIGHT_SKIN);
  });

  it('gates the premium skin to active membership with classic fallback', () => {
    expect(resolveBoardSkin('walnut', true, 'light')).toBe(WALNUT_SKIN);
    expect(resolveBoardSkin('walnut', true, 'midnight')).toBe(WALNUT_SKIN);
    // Free / lapsed: fall back to classic in the current appearance.
    // (Dev builds bypass the gate via __DEV__; tests run without it.)
    if (typeof __DEV__ === 'undefined' || !__DEV__) {
      expect(resolveBoardSkin('walnut', false, 'light')).toBe(CLASSIC_LIGHT_SKIN);
      expect(resolveBoardSkin('walnut', false, 'midnight')).toBe(CLASSIC_MIDNIGHT_SKIN);
    }
  });

  it('every skin carries the full palette surface', () => {
    const paletteKeys = Object.keys(LIGHT_BOARD).sort();
    for (const skin of [WALNUT_SKIN, CLASSIC_MIDNIGHT_SKIN]) {
      for (const key of paletteKeys) {
        const value = (skin as unknown as Record<string, unknown>)[key];
        expect(typeof value).toBe('string');
        expect((value as string).length).toBeGreaterThan(0);
      }
    }
    expect(Object.keys(BOARD_SKINS).sort()).toEqual(['classic', 'walnut']);
  });

  it('walnut takes over the whole page with a physical-game finish', () => {
    expect(['gloss', 'flatDisc']).toContain(WALNUT_SKIN.orbStyle);
    expect(['glow', 'flat', 'neutral']).toContain(WALNUT_SKIN.wallStyle);
    expect(WALNUT_SKIN.premiumOnly).toBe(true);
    expect(typeof WALNUT_SKIN.pageBackground).toBe('string');
    expect(WALNUT_SKIN.pageTexture).toBe('walnutTable');
    expect(CLASSIC_LIGHT_SKIN.pageBackground).toBeUndefined();
    expect(CLASSIC_LIGHT_SKIN.pageTexture).toBeUndefined();
    // Walnut plays like the physical game: flat discs + neutral fences.
    expect(WALNUT_SKIN.orbStyle).toBe('flatDisc');
    expect(WALNUT_SKIN.wallStyle).toBe('neutral');
    expect(typeof WALNUT_SKIN.neutralWall).toBe('string');
  });

  it('walnut carries a complete HUD takeover set (or none at all)', () => {
    expect(typeof WALNUT_SKIN.hudCard).toBe('string');
    expect(typeof WALNUT_SKIN.hudBorder).toBe('string');
    expect(typeof WALNUT_SKIN.hudInk).toBe('string');
    expect(typeof WALNUT_SKIN.hudSubInk).toBe('string');
    expect(typeof WALNUT_SKIN.hudChip).toBe('string');
    expect(CLASSIC_LIGHT_SKIN.hudCard).toBeUndefined();
  });
});
