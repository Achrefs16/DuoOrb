/**
 * DuoOrb Centralized Design System & Stitch Theme.
 *
 * All screens and components import colors, spacing, radius, and shadows from here.
 * The entire app palette is customizable from ONE place via `PRIMARY_COLOR`.
 * Font family: Satoshi.
 */

import { useMemo, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { getActiveOrbPalette } from './theme/orbTheme';

const hexToRgba = (hex: string, alpha: number): string => {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
        .split('')
        .map((c) => c + c)
        .join('')
      : clean;
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * ============================================================================
 * MASTER PALETTE CONFIGURATION - CHANGE PRIMARY COLOR IN ONE PLACE
 * ============================================================================
 * Changing `PRIMARY_COLOR` automatically updates all primary buttons, active
 * navigation tabs, selected chips, container tints, focus outlines, and orb #1.
 */
export const PRIMARY_COLOR = '#69B342'; // Chess.com tactile green

// Supporting Player Hues
const PLAYER_CORAL = '#E5484D';
const PLAYER_GREEN = '#0E9F6E';
const PLAYER_AMBER = '#D9930D';
const PLAYER_BLUE = '#3B82F6';

/**
 * The Slate ramp the app actually uses, as tokens.
 */
const SLATE = {
  0: '#FFFFFF',
  25: '#FAF8FF',
  50: '#F8FAFC',
  100: '#F1F5F9',
  200: '#E2E8F0',
  300: '#CBD5E1',
  400: '#94A3B8',
  500: '#64748B',
  600: '#475569',
  700: '#334155',
  800: '#1E293B',
  900: '#0F172A',
  950: '#131B2E',
} as const;

/** Blue tints used for "you", avatars, pills and chart strokes. */
const BLUE = {
  50: '#EFF6FF',
  100: '#DBEAFE',
  200: '#BFDBFE',
  300: '#004AC6',
  900: '#172554',
} as const;

/** Shared raised-surface / control fills used by toasts, cards and buttons. */
const SURFACE = {
  /** Neutral fill for secondary controls, pills and pressed states. */
  muted: '#EAE8E1',
  /** Hairline divider and card outline. */
  hairline: '#DFDDD5',
  /** Toast/near-white tint behind primary iconography. */
  primaryTint: '#F4F9EE',
  primaryTintBorder: '#C2E4A3',
  /**
   * Card-level primary border.
   */
  primaryTintBorderSoft: '#D8F0C2',
} as const;

/**
 * Font Family Tokens - Manrope (Latin default) and Tajarib (Arabic).
 */
export type FontTokens = {
  regular: string;
  medium: string;
  semiBold: string;
  bold: string;
  extraBold: string;
};

export const MANROPE_FONTS: FontTokens = Platform.select({
  web: {
    regular: 'Manrope, Manrope_400Regular, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    medium: 'Manrope, Manrope_500Medium, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    semiBold: 'Manrope, Manrope_600SemiBold, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    bold: 'Manrope, Manrope_700Bold, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    extraBold: 'Manrope, Manrope_800ExtraBold, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  default: {
    regular: 'Manrope_400Regular',
    medium: 'Manrope_500Medium',
    semiBold: 'Manrope_600SemiBold',
    bold: 'Manrope_700Bold',
    extraBold: 'Manrope_800ExtraBold',
  },
})!;

export const TAJARIB_FONTS: FontTokens = Platform.select({
  web: {
    regular: 'Tajarib, Tajarib-Regular, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    medium: 'Tajarib, Tajarib-Medium, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    semiBold: 'Tajarib, Tajarib-Bold, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    bold: 'Tajarib, Tajarib-Bold, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    extraBold: 'Tajarib, Tajarib-Black, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  default: {
    regular: 'Tajarib-Regular',
    medium: 'Tajarib-Medium',
    semiBold: 'Tajarib-Bold',
    bold: 'Tajarib-Bold',
    extraBold: 'Tajarib-Black',
  },
})!;

let currentFontLanguage = 'en';

export function getFontLanguage(): string {
  return currentFontLanguage;
}

export function getFonts(lang: string = currentFontLanguage): FontTokens {
  return lang === 'ar' ? TAJARIB_FONTS : MANROPE_FONTS;
}

/**
 * Dynamic access to active fonts. Resolves to Tajarib when language is Arabic ('ar'),
 * or Manrope for all other languages.
 */
export const FONTS: FontTokens = {
  get regular() {
    return getFonts().regular;
  },
  get medium() {
    return getFonts().medium;
  },
  get semiBold() {
    return getFonts().semiBold;
  },
  get bold() {
    return getFonts().bold;
  },
  get extraBold() {
    return getFonts().extraBold;
  },
};

/**
 * Factory function to build the full theme object dynamically from a primary color.
 *
 * `mode` only remaps surface/text/state tokens. Every `light` value is
 * byte-identical to the pre-dark-mode theme, so the light theme renders
 * exactly as before.
 */
export type ThemeMode = 'light' | 'dark';

export function buildTheme(
  primary: string = PRIMARY_COLOR,
  mode: ThemeMode = 'light',
  lang: string = currentFontLanguage
) {
  const dark = mode === 'dark';
  const fonts = getFonts(lang);
  const primaryLight = hexToRgba(primary, 0.12);
  const primaryMedium = hexToRgba(primary, 0.22);
  // Chess.com tactile green lip / bevel
  const primaryDark = dark ? '#5D8C30' : '#4E8C2F';
  const primaryBevel = dark ? '#5D8C30' : '#4E8C2F';
  const secondaryBevel = dark ? '#22201E' : '#D0CEC4';
  const surfaceMuted = dark ? '#3B3834' : '#EAE8E1';
  const surfaceHairline = dark ? '#45423E' : '#DFDDD5';
  const surfacePrimaryTint = dark ? hexToRgba(primary, 0.18) : '#F4F9EE';
  const surfacePrimaryTintBorder = dark ? hexToRgba(primary, 0.45) : '#C2E4A3';
  const surfacePrimaryTintBorderSoft = dark
    ? hexToRgba(primary, 0.28)
    : '#D8F0C2';

  return {
    mode,
    language: lang,
    fonts,
    typography: {
      fontFamily: fonts.medium,
      fontFamilyBold: fonts.bold,
      fontFamilySemiBold: fonts.semiBold,
      fontFamilyExtraBold: fonts.extraBold,
    },
    colors: {
      // 1. Primary Brand Tokens (Chess.com tactile green)
      primary,
      primaryLight,
      primaryMedium,
      primaryDark,
      primaryBevel,
      secondaryBevel,
      primaryContainer: primary,
      onPrimary: '#FFFFFF',
      onPrimaryContainer: '#FFFFFF',
      accent: primary,
      accentCyan: primary,

      // 1b. Raw ramp.
      slate: SLATE,
      blue: BLUE,

      // 2. Stitch Surface & Container Hierarchy (Warm Alabaster / Crisp White)
      background: dark ? '#262421' : '#F5F4F0',
      backgroundCard: dark ? '#312E2B' : '#FFFFFF',
      backgroundElevated: dark ? '#3A3734' : '#FFFFFF',
      surface: dark ? '#312E2B' : '#EDEAE4',
      surfaceBright: dark ? '#3B3834' : '#F0EEE7',
      surfaceDim: dark ? '#262421' : '#DFDDD5',
      surfaceContainerLowest: dark ? '#312E2B' : '#FFFFFF',
      surfaceContainerLow: dark ? '#262421' : '#F5F4F0',
      surfaceContainer: dark ? '#3B3834' : '#EDEBE5',
      surfaceContainerHigh: dark ? '#45423E' : '#E5E3DC',
      surfaceContainerHighest: dark ? '#4F4C47' : '#DFDDD5',
      inverseSurface: dark ? '#FFFFFF' : '#262421',
      inverseOnSurface: dark ? '#262421' : '#FFFFFF',

      // 3. Typography & Text Hierarchy
      textPrimary: dark ? '#FFFFFF' : '#262421',
      textSecondary: dark ? '#C3C2C0' : '#52504C',
      textMuted: dark ? '#989795' : '#7D7A75',
      onSurface: dark ? '#FFFFFF' : '#262421',
      onSurfaceVariant: dark ? '#C3C2C0' : '#52504C',
      outline: dark ? '#45423E' : '#DFDDD5',
      outlineVariant: dark ? '#3B3834' : '#EAE8E1',

      // 4. Secondary (Opponent / Player 2 Accent)
      secondary: PLAYER_CORAL,
      secondaryContainer: dark ? '#4A1D20' : '#FEE2E2',
      secondaryBorder: dark ? '#7A2E33' : '#FECACA',
      onSecondary: '#FFFFFF',

      // 5. Tertiary / Success (Tactile Green)
      tertiary: dark ? '#81B64C' : '#69B342',
      tertiaryContainer: dark ? '#243C16' : '#E8F5DF',
      tertiaryLight: dark ? '#1B2E10' : '#F2F9ED',
      tertiaryBorder: dark ? '#3D6823' : '#BEE29E',
      onTertiary: '#FFFFFF',
      success: dark ? '#81B64C' : '#69B342',

      // 6. Warnings, Errors & Alerts
      warning: dark ? '#FBBF24' : '#B45309',
      warningLight: dark ? '#2E2008' : '#FEF3C7',
      error: dark ? '#F87171' : '#BA1A1A',
      errorContainer: dark ? '#3B0F14' : '#FFDAD6',
      danger: dark ? '#F87171' : '#DC2626',
      dangerLight: dark ? '#3B1518' : '#FEE2E2',
      dangerBorder: dark ? '#7F1D1D' : '#FECACA',

      // 7. Players (P1 Tactical Blue stays distinct from Green UI chrome)
      player1: dark ? '#60A5FA' : '#3B82F6',
      player2: PLAYER_CORAL,
      player3: PLAYER_GREEN,
      player4: PLAYER_AMBER,
      playerColors: [dark ? '#60A5FA' : '#3B82F6', PLAYER_CORAL, PLAYER_GREEN, PLAYER_AMBER] as string[],

      // 8. Board Game Engine Surfaces
      boardBackground: dark ? '#262421' : '#FFFFFF',
      boardBorder: dark ? '#45423E' : '#DFDDD5',
      cell: dark ? '#312E2B' : '#F1F0EB',
      cellBorder: dark ? '#3B3834' : '#E5E3DC',
      cellHover: dark ? '#3B3834' : '#E5E3DC',
      cellLegalMove: hexToRgba(primary, 0.12),
      cellLegalDot: primary,
      cellLastMove: hexToRgba(primary, 0.10),

      // 9. Walls
      wallSlot: 'rgba(100, 116, 139, 0.30)',
      wallSlotHover: hexToRgba(primary, 0.18),
      wallPlaced: '#8A8474',
      wallPreviewLegal: primary,
      wallPreviewIllegal: '#DC2626',
      wallOpacity: 1.0,
      wallPreviewOpacity: 0.45,
      wallPreviewInactiveOpacity: 0.22,

      // 10. Match Outcomes
      win: dark ? '#81B64C' : '#69B342',
      winBg: dark ? '#1B2E10' : '#F2F9ED',
      winBorder: dark ? '#3D6823' : '#BEE29E',
      loss: dark ? '#F87171' : '#DC2626',
      lossBg: dark ? '#3B1518' : '#FEF2F2',
      lossBorder: dark ? '#7F1D1D' : '#FECACA',
      draw: dark ? '#989795' : '#64748B',
      drawBg: dark ? '#312E2B' : '#F8FAFC',
      drawBorder: dark ? '#45423E' : '#E2E8F0',

      // 11. Live Status Indicators
      statusOnline: dark ? '#81B64C' : '#69B342',
      statusPlaying: primary,
      statusOffline: '#94A3B8',

      // 12. Move Validity
      legalMove: primary,
      illegalMove: dark ? '#F87171' : '#DC2626',

      // 13. Shadows
      shadow: 'rgba(15, 23, 42, 0.08)',

      // 14. Shared component fills
      surfaceMuted,
      surfaceHairline,
      surfacePrimaryTint,
      surfacePrimaryTintBorder,
      surfacePrimaryTintBorderSoft,
      /** Text/icon colour on a dark or saturated fill. */
      onSurfaceInverse: SLATE[0],
      /** Ink for notice pills, dots, titles and inverse button labels. */
      inverseLabel: dark ? '#FFFFFF' : '#262421',
      /** Secondary body text on light surfaces. */
      textSecondaryStrong: dark ? '#C3C2C0' : '#52504C',
      /** Neutral icon + label colour. */
      textOnMuted: dark ? '#989795' : '#7D7A75',
      /** Chart stroke. */
      chartStroke: dark ? '#81B64C' : '#69B342',
      chartInk: dark ? '#E9EBF3' : '#262421',

      // 15. Engine assessment markers (analysisUi.ts + review screen)
      assessmentBest: '#0D9488',
      assessmentExcellent: '#059669',
      assessmentGood: '#69B342',
      assessmentInaccuracy: '#D97706',
      assessmentBlunder: '#EA580C',
      /** Alert-toned marks on the board. */
      playerPink: '#F43F5E',
      playerGreenBright: '#69B342',
      playerMint: '#34D399',
      player4Amber: '#D9A62E',
      /** Third-party brand colour (Google sign-in). Never themed. */
      googleBlue: '#4285F4',
      dangerBright: dark ? '#F87171' : '#EF4444',
      warningBorder: dark ? '#7A5A10' : '#FDE68A',
      neutralStone: dark ? '#3A3A42' : '#D6D3D1',
      /** Hairline between list rows. */
      dividerSoft: dark ? '#3B3834' : '#EDEBE5',
      successLight: dark ? '#1B2E10' : '#F2F9ED',
      /** Green avatar tint. */
      successTint: dark ? '#243C16' : '#E8F5DF',
      shadowBlack: '#000',
    },
    radius: {
      xs: 2,
      sm: 4,
      md: 6,
      lg: 8,
      xl: 12,
      // Toast/card corners were 12 and 16 as literals in three files.
      toast: 16,
      full: 9999,
    },
    /**
     * Control metrics shared by every button, toast action and pill.
     *
     * The two toasts and SettingsScreen each declared their own `acceptBtn`
     * / `declineBtn` with the same fills and the same 10px corner — identical
     * design, repeated code. These are the values they were already using.
     */
    controls: {
      /** Corner radius of a filled action button. */
      radius: 10,
      /** Corner radius of a compact toast action. */
      radiusCompact: 8,
      /** Vertical padding of a standard action button. */
      paddingVertical: 11,
      /** Vertical padding of a compact toast action. */
      paddingVerticalCompact: 8,
      /** Height of a full-width primary action. */
      height: 50,
      /** Label size of a primary action button. */
      fontSize: 14,
      /** Label size of a compact toast action. */
      fontSizeCompact: 12,
    },
    spacing: {
      xs: 4,
      sm: 8,
      md: 12,
      lg: 16,
      xl: 24,
      xxl: 32,
    },
    shadows: {
      card: {
        shadowColor: 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
      },
      modal: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.14,
        shadowRadius: 18,
        elevation: 10,
      },
      orb: {
        shadowColor: 'rgba(15, 23, 42, 0.35)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 4,
      },
      wall: {
        shadowColor: 'rgba(15, 23, 42, 0.30)',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.18,
        shadowRadius: 2,
        elevation: 2,
      },
      glowCyan: {
        shadowColor: hexToRgba(primary, 0.35),
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 4,
      },
      glowRose: {
        shadowColor: 'rgba(229, 72, 77, 0.35)',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 4,
      },
    },
    animation: {
      ballMoveMs: 120,
      wallSnapMs: 160,
      fadeMs: 140,
    },
  };
}

/**
 * Named themes. Adding a theme means adding one entry here — no screen
 * changes, because every screen reads `THEME`, which is the active entry.
 *
 * Screens and components read theme values through useStyles/useTheme,
 * so the active entry must be set (via setThemeName) before first paint —
 * App holds themed UI behind the settings gate for exactly this reason,
 * and toggling the mode applies instantly with no reload.
 */
export const THEMES = {
  light: buildTheme(PRIMARY_COLOR, 'light'),
  dark: buildTheme('#81B64C', 'dark'),
} as const;

export type ThemeName = keyof typeof THEMES;

export type Theme = ReturnType<typeof buildTheme>;

/** The active theme. Every import of THEME in the app resolves here. */
export let THEME: Theme = THEMES.light;

export function parseThemeName(raw: unknown): ThemeName {
  return raw === 'dark' ? 'dark' : 'light';
}

let themeVersion = 0;
const themeListeners = new Set<() => void>();

function emitTheme(): void {
  themeListeners.forEach((fn) => fn());
}

function subscribeTheme(fn: () => void): () => void {
  themeListeners.add(fn);
  return () => {
    themeListeners.delete(fn);
  };
}

function applyWebThemeBackground(color: string): void {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    try {
      document.documentElement.style.backgroundColor = color;
      if (document.body) {
        document.body.style.backgroundColor = color;
      }
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) {
        meta.setAttribute('content', color);
      }
    } catch {}
  }
}

// Initial sync for web document background matching active theme
applyWebThemeBackground(THEME.colors.background);

/**
 * Called from App when settings load and whenever the mode toggles.
 * Live styles (useStyles) and subscribers (useTheme) pick the new entry
 * up instantly — no reload.
 */
export function setThemeName(next: unknown): ThemeName {
  const name = parseThemeName(next);
  if (THEMES[name] !== THEME) {
    THEME = THEMES[name];
    themeVersion += 1;
    emitTheme();
  }
  applyWebThemeBackground(THEME.colors.background);
  return name;
}

/**
 * Reactive access to the active theme. Components that read theme values
 * (directly or through useStyles) subscribe here so a mode toggle
 * re-renders them instantly — no app reload.
 */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribeTheme, () => THEME, () => THEMES.light);
}

/**
 * Live styles. The factory reads THEME at call time, so it always builds
 * from the active theme; the result is memoized and rebuilt only when the
 * theme switches. Replaces module-level `StyleSheet.create` for every
 * style object that references THEME.
 */
export function useStyles<T>(factory: () => T): T {
  const theme = useTheme();
  // The factory is intentionally not a dep: it must re-run exactly when
  // the theme identity flips, never on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(factory, [theme]);
}

/** Test seam: drops the module back to light without touching disk. */
export function __resetThemeForTests(): void {
  THEME = THEMES.light;
}

/** Player ball color by index (0-based). Uses active orb palette with fallback. */
export function playerColor(index: number, fallback?: string): string {
  const activeColors = getActiveOrbPalette().colors;
  if (fallback && /^#[0-9a-fA-F]{3,8}$/.test(fallback)) return fallback;
  return activeColors[index % activeColors.length] ?? THEME.colors.primary;
}

/**
 * Wall color for a player: same hue family as the ball, slightly
 * softer so walls stay readable and don't overpower the board.
 */
export function wallColorForPlayer(ballColor: string, alpha = THEME.colors.wallOpacity): string {
  if (alpha >= 1) return ballColor;
  return hexToRgba(ballColor, alpha);
}

/** Translucent preview color for a player's wall. */
export function wallPreviewColor(
  ballColor: string,
  alpha = THEME.colors.wallPreviewOpacity
): string {
  return hexToRgba(ballColor, alpha);
}

export { hexToRgba };
