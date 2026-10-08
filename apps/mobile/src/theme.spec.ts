import { describe, expect, it, beforeEach } from 'vitest';
import {
  __resetThemeForTests,
  buildTheme,
  parseThemeName,
  setThemeName,
  THEME,
  THEMES,
} from './theme';

/**
 * App color mode: the light entry is locked (byte-identical to the
 * pre-dark-mode theme), dark remaps surfaces/texts/states, and unknown
 * stored values fall back to light.
 */
describe('app theme mode', () => {
  beforeEach(() => {
    __resetThemeForTests();
  });

  it('light entry preserves the shipping palette', () => {
    expect(THEMES.light.colors.background).toBe('#F2F3FF');
    expect(THEMES.light.colors.primary).toBe('#6C6FFD');
    expect(THEMES.light.colors.backgroundCard).toBe('#FFFFFF');
    expect(THEMES.light.colors.danger).toBe('#DC2626');
    expect(THEMES.light.colors.textPrimary).toBe('#131B2E');
    expect(THEMES.light.mode).toBe('light');
  });

  it('dark keeps brand tokens but remaps surfaces and text', () => {
    expect(THEMES.dark.colors.primary).toBe(THEMES.light.colors.primary);
    expect(THEMES.dark.colors.background).toBe('#000000');
    expect(THEMES.dark.colors.background).not.toBe(THEMES.light.colors.background);
    expect(THEMES.dark.colors.backgroundCard).not.toBe(THEMES.light.colors.backgroundCard);
    expect(THEMES.dark.colors.textPrimary).not.toBe(THEMES.light.colors.textPrimary);
    expect(THEMES.dark.colors.danger).not.toBe(THEMES.light.colors.danger);
    expect(THEMES.dark.mode).toBe('dark');
  });

  it('both entries expose the same color keys', () => {
    expect(Object.keys(THEMES.dark.colors).sort()).toEqual(Object.keys(THEMES.light.colors).sort());
  });

  it('custom primary flows into both modes', () => {
    expect(buildTheme('#FF0000', 'dark').colors.primary).toBe('#FF0000');
    expect(buildTheme('#FF0000', 'light').colors.primary).toBe('#FF0000');
  });

  it('parses and activates the stored mode, falling back to light', () => {
    expect(parseThemeName('dark')).toBe('dark');
    expect(parseThemeName('light')).toBe('light');
    expect(parseThemeName('midnight')).toBe('light');
    expect(parseThemeName(undefined)).toBe('light');
    expect(setThemeName('dark')).toBe('dark');
    expect(THEME.mode).toBe('dark');
    expect(setThemeName('neon')).toBe('light');
    expect(THEME.mode).toBe('light');
  });
});
