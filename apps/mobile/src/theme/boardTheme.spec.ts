import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  __resetBoardThemeForTests,
  BOARD_SKINS,
  CLASSIC_LIGHT_SKIN,
  CLASSIC_MIDNIGHT_SKIN,
  LIGHT_BOARD,
  MIDNIGHT_BOARD,
  TACTILE_DARK_SKIN,
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
 * Board skin system: Midnight is free for everyone; unknown stored values
 * parse to classic/light (E23); every skin carries the full palette surface
 * so no board can ever go blank.
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
    expect(parseBoardSkinId('walnut')).toBe('classic');
    expect(parseBoardSkinId('tactile')).toBe('tactile');
    expect(parseBoardSkinId('tactileDark')).toBe('tactileDark');
    expect(parseBoardSkinId('stone')).toBe('stone');
    expect(parseBoardSkinId('chess')).toBe('stone');
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

  it('all board skins are free and resolve directly', () => {
    // Tactile is unlocked for everyone (premiumOnly: false)
    expect(resolveBoardSkin('tactile', false, 'light')).toBe(BOARD_SKINS.tactile);
    expect(resolveBoardSkin('tactile', false, 'midnight')).toBe(BOARD_SKINS.tactile);
    // Dark Tactile is an explicit variant, not tied to app appearance.
    expect(resolveBoardSkin('tactileDark', false, 'light')).toBe(TACTILE_DARK_SKIN);
    expect(resolveBoardSkin('tactileDark', false, 'midnight')).toBe(TACTILE_DARK_SKIN);
    // Stone is unlocked for everyone (premiumOnly: false)
    expect(resolveBoardSkin('stone', false, 'light')).toBe(BOARD_SKINS.stone);
    expect(resolveBoardSkin('stone', false, 'midnight')).toBe(BOARD_SKINS.stone);
  });

  it('every skin carries the full palette surface', () => {
    const paletteKeys = Object.keys(LIGHT_BOARD).sort();
    for (const skin of [BOARD_SKINS.tactile, TACTILE_DARK_SKIN, BOARD_SKINS.stone, CLASSIC_MIDNIGHT_SKIN]) {
      for (const key of paletteKeys) {
        const value = (skin as unknown as Record<string, unknown>)[key];
        expect(typeof value).toBe('string');
        expect((value as string).length).toBeGreaterThan(0);
      }
    }
    expect(Object.keys(BOARD_SKINS).sort()).toEqual([
      'classic',
      'stone',
      'tactile',
      'tactileDark',
    ]);
  });

  it('dark tactile keeps the tactile finish on a warm charcoal surface', () => {
    expect(TACTILE_DARK_SKIN.boardBackground).toBe('#1F1D1B');
    expect(TACTILE_DARK_SKIN.cell).toBe('#312E2B');
    expect(TACTILE_DARK_SKIN.premiumOnly).toBe(false);
    expect(TACTILE_DARK_SKIN.orbStyle).toBe('gloss');
    expect(TACTILE_DARK_SKIN.wallRadius).toBe('capsule');
    expect(TACTILE_DARK_SKIN.cellRadius).toBe(9);
    expect(TACTILE_DARK_SKIN.hudCard).toBe('#312E2B');
    expect(TACTILE_DARK_SKIN.hudInk).toBe('#FFFFFF');
    expect(TACTILE_DARK_SKIN.boardBackground).not.toBe(BOARD_SKINS.tactile.boardBackground);
  });

  it('stone skin has light/dark checker cells, tight gaps, and no glass effect', () => {
    const stone = BOARD_SKINS.stone;
    expect(stone.cell).toBe('#F7F6F2');
    expect(stone.cellAlt).toBe('#EDEBE5');
    expect(stone.boardBackground).toBe('#E8E6DF');
    expect(stone.cellRadius).toBe(2);
    expect(stone.cellGap).toBe(3);
    expect(stone.orbHighlightOpacity).toBe(0);
    expect(stone.orbShadow).toBe(false);
    expect(stone.wallSlot).toBe('transparent');
    expect(stone.wallSlotSize).toBe(0);
    expect(stone.premiumOnly).toBe(false);
  });
});
