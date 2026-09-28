import { describe, expect, it } from 'vitest';
import { applyTheme, isThemeName, THEMES, THEME } from '../theme';
import { bumpThemeVersion, createThemedStyles, currentThemeVersion } from './themedStyles';

const snapshot = () => ({
  primary: THEME.colors.primary,
  background: THEME.colors.background,
  text: THEME.colors.textPrimary,
  cell: THEME.colors.cell,
});

describe('theme registry', () => {
  it('ships a dark palette alongside light', () => {
    expect(Object.keys(THEMES)).toEqual(['light', 'dark']);
    expect(THEMES.dark.colors.background).not.toBe(THEMES.light.colors.background);
  });

  it('keeps dark text readable on dark surfaces', () => {
    const lum = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
    };
    const ratio = (a: string, b: string) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    // WCAG AA for body text is 4.5:1.
    expect(ratio(THEMES.dark.colors.textPrimary, THEMES.dark.colors.background)).toBeGreaterThan(4.5);
    expect(ratio(THEMES.dark.colors.textMuted, THEMES.dark.colors.background)).toBeGreaterThan(4.5);
    expect(ratio(THEMES.dark.colors.onPrimary, THEMES.dark.colors.primary)).toBeGreaterThan(4.5);
  });

  it('validates theme names', () => {
    expect(isThemeName('dark')).toBe(true);
    expect(isThemeName('light')).toBe(true);
    expect(isThemeName('neon')).toBe(false);
    expect(isThemeName(null)).toBe(false);
  });
});

describe('applyTheme', () => {
  it('swaps tokens in place and round-trips', () => {
    const light = snapshot();
    applyTheme('dark');
    const dark = snapshot();
    expect(dark).not.toEqual(light);
    applyTheme('light');
    expect(snapshot()).toEqual(light);
    applyTheme('dark');
    applyTheme('light');
    expect(snapshot()).toEqual(light);
  });

  it('does not corrupt the registry (the original bug)', () => {
    const registryLight = THEMES.light.colors.primary;
    applyTheme('dark');
    // THEMES.light must be untouched by a switch to dark.
    expect(THEMES.light.colors.primary).toBe(registryLight);
    applyTheme('light');
    expect(THEME.colors.primary).toBe(registryLight);
  });
});

describe('createThemedStyles', () => {
  it('rebuilds on a theme switch instead of freezing at module load', () => {
    const styles = createThemedStyles(() => ({
      box: { backgroundColor: THEME.colors.background, borderColor: THEME.colors.outlineVariant },
    }));

    applyTheme('light');
    bumpThemeVersion();
    const lightBg = styles.box.backgroundColor;
    const lightBorder = styles.box.borderColor;

    applyTheme('dark');
    bumpThemeVersion();
    const darkBg = styles.box.backgroundColor;
    const darkBorder = styles.box.borderColor;

    expect(darkBg).not.toBe(lightBg);
    expect(darkBorder).not.toBe(lightBorder);
    expect(darkBg).toBe(THEMES.dark.colors.background);

    applyTheme('light');
    bumpThemeVersion();
    expect(styles.box.backgroundColor).toBe(lightBg);
    expect(styles.box.borderColor).toBe(lightBorder);
  });

  it('bumps its version so downstream caches can invalidate', () => {
    const before = currentThemeVersion();
    bumpThemeVersion();
    expect(currentThemeVersion()).toBe(before + 1);
  });
});
