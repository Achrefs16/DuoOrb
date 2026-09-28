/**
 * DuoOrb Centralized Design System & Stitch Theme.
 *
 * All screens and components import colors, spacing, radius, and shadows from here.
 * The entire app palette is customizable from ONE place via `PRIMARY_COLOR`.
 * Font family: Manrope.
 */

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
export const PRIMARY_COLOR = '#2563EB'; // Tactical Vibrant Blue (Stitch primary)

// Supporting Player Hues
const PLAYER_CORAL = '#E5484D';
const PLAYER_GREEN = '#0E9F6E';
const PLAYER_AMBER = '#D9930D';

/**
 * The Slate ramp the app actually uses, as tokens.
 *
 * These existed only as hex literals inside 28 files (#FFFFFF x99, #F1F5F9
 * x49, #64748B x48 …) while the semantic tokens below already described the
 * same colours. Naming them here is what lets a future palette remap the whole
 * ramp by editing this one file. Values are unchanged — a token that resolved
 * to a different colour would be a design change, not a refactor.
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
  300: '#004AC6', // chart strokes only — deliberately deeper than `primary`
  900: '#172554',
} as const;

/** Shared raised-surface / control fills used by toasts, cards and buttons. */
const SURFACE = {
  /** Neutral fill for secondary controls, pills and pressed states. */
  muted: SLATE[100],
  /** Hairline divider and card outline. */
  hairline: SLATE[200],
  /** Toast/near-white tint behind primary iconography. */
  primaryTint: BLUE[50],
  /**
   * Two distinct borders were both being called "primary border":
   * BLUE[200] (#BFDBFE) on avatars/icons, BLUE[100] (#DBEAFE) on toast cards.
   * Kept separate — collapsing them was a one-step colour change.
   */
  primaryTintBorder: BLUE[200],
  primaryTintBorderSoft: BLUE[100],
} as const;

/**
 * Font Family Tokens - Manrope
 */
export const FONTS = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semiBold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extraBold: 'Manrope_800ExtraBold',
};

/**
 * Factory function to build the full theme object dynamically from a primary color.
 */
/**
 * Per-theme colour overrides.
 *
 * A theme supplies only what differs; anything omitted falls through to
 * `buildTheme`'s light values. That is deliberate: the light palette is the
 * reference design, and a new theme states its differences rather than
 * restating ~120 tokens.
 */
export interface ThemeOverrides {
  colors?: Record<string, string>;
  shadows?: Record<string, Record<string, unknown>>;
}

export function buildTheme(
  primary: string = PRIMARY_COLOR,
  overrides: ThemeOverrides = {}
) {
  const primaryLight = hexToRgba(primary, 0.12);
  const primaryMedium = hexToRgba(primary, 0.22);
  const primaryDark = '#1D4ED8';

  const base = {
    fonts: FONTS,
    typography: {
      fontFamily: FONTS.medium,
      fontFamilyBold: FONTS.bold,
      fontFamilySemiBold: FONTS.semiBold,
      fontFamilyExtraBold: FONTS.extraBold,
    },
    colors: {
      // 1. Primary Brand Tokens (Changeable in one place)
      primary,
      primaryLight,
      primaryMedium,
      primaryDark,
      primaryContainer: primary,
      onPrimary: '#FFFFFF',
      onPrimaryContainer: '#EEEFFF',
      accent: primary,
      accentCyan: primary,

      // 1b. Raw ramp. Referenced by name so a second theme can remap the
      //     whole scale; the semantic tokens below are the ones to use.
      slate: SLATE,
      blue: BLUE,

      // 2. Stitch Surface & Container Hierarchy
      background: '#FAF8FF',
      backgroundCard: '#FFFFFF',
      backgroundElevated: '#FFFFFF',
      surface: '#FAF8FF',
      surfaceBright: '#FAF8FF',
      surfaceDim: '#D2D9F4',
      surfaceContainerLowest: '#FFFFFF',
      surfaceContainerLow: '#F2F3FF',
      surfaceContainer: '#EAEDFF',
      surfaceContainerHigh: '#E2E7FF',
      surfaceContainerHighest: '#DAE2FD',
      inverseSurface: '#131B2E',
      inverseOnSurface: '#EEF0FF',

      // 3. Typography & Text Hierarchy
      textPrimary: '#131B2E',
      textSecondary: '#434655',
      textMuted: '#737686',
      onSurface: '#131B2E',
      onSurfaceVariant: '#434655',
      outline: '#737686',
      outlineVariant: '#C3C6D7',

      // 4. Secondary (Opponent / Player 2 Accent)
      secondary: PLAYER_CORAL,
      secondaryContainer: '#FEE2E2',
      secondaryBorder: '#FECACA',
      onSecondary: '#FFFFFF',

      // 5. Tertiary / Success (Quick Match, Wins, Online)
      tertiary: '#16A34A',
      tertiaryContainer: '#007F36',
      tertiaryLight: '#E8F8EE',
      tertiaryBorder: '#BBF7D0',
      onTertiary: '#FFFFFF',
      success: '#15803D',

      // 6. Warnings, Errors & Alerts
      warning: '#B45309',
      warningLight: '#FEF3C7',
      error: '#BA1A1A',
      errorContainer: '#FFDAD6',
      danger: '#DC2626',
      dangerLight: '#FEE2E2',
      dangerBorder: '#FECACA',

      // 7. Players
      player1: primary,
      player2: PLAYER_CORAL,
      player3: PLAYER_GREEN,
      player4: PLAYER_AMBER,
      playerColors: [primary, PLAYER_CORAL, PLAYER_GREEN, PLAYER_AMBER] as string[],

      // 8. Board Game Engine Surfaces (Preserved Board)
      boardBackground: '#FFFFFF',
      boardBorder: '#CBD5E1',
      cell: '#F1F5F9',
      cellBorder: '#E2E8F0',
      cellHover: '#E2E8F0',
      cellLegalMove: hexToRgba(primary, 0.10),
      cellLegalDot: primary,
      cellLastMove: hexToRgba(primary, 0.08),

      // 9. Walls
      wallSlot: 'rgba(100, 116, 139, 0.30)',
      wallSlotHover: hexToRgba(primary, 0.18),
      wallPlaced: '#8A8474',
      wallPreviewLegal: primary,
      wallPreviewIllegal: '#DC2626',
      wallOpacity: 0.88,
      wallPreviewOpacity: 0.45,
      wallPreviewInactiveOpacity: 0.22,

      // 10. Match Outcomes
      win: '#15803D',
      winBg: '#F0FDF4',
      winBorder: '#BBF7D0',
      loss: '#DC2626',
      lossBg: '#FEF2F2',
      lossBorder: '#FECACA',
      draw: '#64748B',
      drawBg: '#F8FAFC',
      drawBorder: '#E2E8F0',

      // 11. Live Status Indicators
      statusOnline: '#16A34A',
      statusPlaying: primary,
      statusOffline: '#94A3B8',

      // 12. Move Validity
      legalMove: primary,
      illegalMove: '#DC2626',

      // 13. Shadows
      shadow: 'rgba(15, 23, 42, 0.08)',

      // 14. Shared component fills
      //     These were duplicated as hex inside toasts, cards, buttons and
      //     pills. Every value is identical to the literal it replaces.
      surfaceMuted: SURFACE.muted,
      surfaceHairline: SURFACE.hairline,
      surfacePrimaryTint: SURFACE.primaryTint,
      surfacePrimaryTintBorder: SURFACE.primaryTintBorder,
      surfacePrimaryTintBorderSoft: SURFACE.primaryTintBorderSoft,
      /** Text/icon colour on a dark or saturated fill. */
      onSurfaceInverse: SLATE[0],
      /** Deep ink for a notice pill or inverse button label. */
      inverseLabel: SLATE[900],
      /** Secondary body text on light surfaces (was #64748B). */
      textSecondaryStrong: SLATE[500],
      /** Neutral icon + label colour (was #475569). */
      textOnMuted: SLATE[600],
      /** Chart stroke blue, deeper than `primary` so lines read on white. */
      chartStroke: BLUE[300],
      chartInk: BLUE[900],

      // 15. Engine assessment markers (analysisUi.ts + review screen)
      assessmentBest: '#0D9488',
      assessmentExcellent: '#059669',
      assessmentGood: '#16A34A',
      assessmentInaccuracy: '#D97706',
      assessmentBlunder: '#EA580C',
      /** Alert-toned marks on the board. */
      playerPink: '#F43F5E',
      playerGreenBright: '#22C55E',
      playerMint: '#34D399',
      player4Amber: '#D9A62E',
      /** Third-party brand colour (Google sign-in). Never themed. */
      googleBlue: '#4285F4',
      dangerBright: '#EF4444',
      warningBorder: '#FDE68A',
      neutralStone: '#D6D3D1',
      /** Hairline between list rows. */
      dividerSoft: '#EEF1F6',
      successLight: '#ECFDF5',
      /** Green avatar tint. Distinct from `winBg` (#F0FDF4) by one step. */
      successTint: '#DCFCE7',
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
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
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
      ballMoveMs: 200,
      wallSnapMs: 160,
      fadeMs: 140,
    },
  };

  return {
    ...base,
    colors: { ...base.colors, ...(overrides.colors ?? {}) },
    shadows: { ...base.shadows, ...(overrides.shadows ?? {}) },
  };
}

/**
 * Dark palette.
 *
 * Only the tokens that MUST differ are listed. Everything omitted is either
 * already theme-neutral (player hues, status colours, board geometry) or was
 * verified to read acceptably on a dark surface.
 *
 * Contrast notes: text is #E6EAF2 on #0F1523 (≈13:1). Muted text is #9AA6BC
 * on #0F1523 (≈7:1). Every `*-Light` container is a dark translucent tint
 * rather than a pale wash, so a "green pill" stays legible when inverted.
 */
const DARK_COLORS: Record<string, string> = {
  // Brand: a lighter blue is needed to hold contrast on dark surfaces.
  primary: '#60A5FA',
  primaryDark: '#3B82F6',
  primaryLight: 'rgba(96, 165, 250, 0.16)',
  primaryMedium: 'rgba(96, 165, 250, 0.26)',
  accent: '#60A5FA',
  accentCyan: '#60A5FA',
  onPrimary: '#0B1220',
  onPrimaryContainer: '#0B1220',

  // Surfaces, dark end first.
  background: '#0B1220',
  surface: '#0B1220',
  surfaceBright: '#18213A',
  surfaceDim: '#0F1523',
  backgroundCard: '#141C2E',
  backgroundElevated: '#1B2438',
  surfaceContainerLowest: '#111827',
  surfaceContainerLow: '#141C2E',
  surfaceContainer: '#18213A',
  surfaceContainerHigh: '#1E283F',
  surfaceContainerHighest: '#263148',
  inverseSurface: '#E6EAF2',
  inverseOnSurface: '#0B1220',

  // Text.
  textPrimary: '#E6EAF2',
  textSecondary: '#AEB9CC',
  textMuted: '#8592A8',
  onSurface: '#E6EAF2',
  onSurfaceVariant: '#AEB9CC',
  outline: '#8592A8',
  outlineVariant: '#2E3A52',
  textSecondaryStrong: '#9AA6BC',
  textOnMuted: '#AEB9CC',
  inverseLabel: '#E6EAF2',

  // Shared fills.
  surfaceMuted: '#1E283F',
  surfaceHairline: '#2E3A52',
  dividerSoft: '#263148',
  surfacePrimaryTint: 'rgba(96, 165, 250, 0.14)',
  surfacePrimaryTintBorder: 'rgba(96, 165, 250, 0.42)',
  surfacePrimaryTintBorderSoft: 'rgba(96, 165, 250, 0.28)',

  // Board: cells read as raised panels, not white squares.
  boardBackground: '#0F1523',
  boardBorder: '#2E3A52',
  cell: '#18213A',
  cellBorder: '#263148',
  cellHover: '#1E283F',
  cellLegalMove: 'rgba(96, 165, 250, 0.20)',
  cellLastMove: 'rgba(96, 165, 250, 0.14)',

  // Status pills and semantic containers.
  secondary: '#F87171',
  secondaryContainer: 'rgba(248, 113, 113, 0.18)',
  secondaryBorder: 'rgba(248, 113, 113, 0.38)',
  onSecondary: '#0B1220',
  tertiary: '#4ADE80',
  tertiaryContainer: '#15803D',
  success: '#4ADE80',
  warning: '#FBBF24',
  warningLight: 'rgba(251, 191, 36, 0.16)',
  warningBorder: 'rgba(251, 191, 36, 0.38)',
  error: '#F87171',
  danger: '#F87171',
  errorContainer: 'rgba(248, 113, 113, 0.18)',
  dangerLight: 'rgba(248, 113, 113, 0.16)',
  dangerBorder: 'rgba(248, 113, 113, 0.36)',
  dangerBright: '#F87171',

  // Outcomes.
  win: '#4ADE80',
  winBg: 'rgba(74, 222, 128, 0.12)',
  winBorder: 'rgba(74, 222, 128, 0.32)',
  loss: '#F87171',
  lossBg: 'rgba(248, 113, 113, 0.12)',
  lossBorder: 'rgba(248, 113, 113, 0.32)',
  draw: '#9AA6BC',
  drawBg: '#18213A',
  drawBorder: '#2E3A52',

  // Live status.
  statusOnline: '#4ADE80',
  statusPlaying: '#60A5FA',
  statusOffline: '#64748B',

  // Walls keep their hue but gain contrast against the dark board.
  wallPlaced: '#9A9382',
  wallSlot: 'rgba(148, 163, 184, 0.26)',

  // Engine assessment marks, lifted for dark.
  assessmentBest: '#2DD4BF',
  assessmentExcellent: '#4ADE80',
  assessmentGood: '#A3E635',
  assessmentInaccuracy: '#FBBF24',
  assessmentBlunder: '#FB923C',
  playerMint: '#6EE7B7',
  playerGreenBright: '#4ADE80',
  playerPink: '#FB7185',
  neutralStone: '#94A3B8',
  successTint: 'rgba(74, 222, 128, 0.16)',
  successLight: 'rgba(74, 222, 128, 0.12)',
  chartStroke: '#60A5FA',
  chartInk: '#BFDBFE',

  // Shadows become useless on dark; elevation is carried by borders.
  shadow: 'rgba(0, 0, 0, 0.45)',
};

/**
 * Named themes. Adding a theme means adding one entry here — no screen
 * changes, because every screen reads `THEME`, which is the active entry.
 */
export const THEMES = {
  light: buildTheme(PRIMARY_COLOR),
  dark: buildTheme(PRIMARY_COLOR, {
    colors: DARK_COLORS,
    shadows: {
      card: { shadowColor: '#000000', shadowOpacity: 0.3, elevation: 0 },
      modal: { shadowColor: '#000000', shadowOpacity: 0.5, elevation: 0 },
    },
  }),
} as const;

export type ThemeName = keyof typeof THEMES;

export const THEME_SCHEME_KEY = '@duoorb:theme:v1';

/**
 * The active theme.
 *
 * A standalone mutable copy — deliberately NOT `THEMES.light` itself. Sharing
 * that object meant the first `applyTheme('dark')` overwrote the light entry
 * in place, so switching back could not restore it and `THEMES.light` was
 * permanently corrupted.
 *
 * A mutable object (rather than a `const` binding) is what lets one assignment
 * restyle every `THEME.*` reader in the app, instead of threading context
 * through 28 files. Screens rebuild their styles via `useThemedStyles`.
 */
function cloneTheme(source: Theme): Theme {
  const out = {} as Record<string, unknown>;
  for (const [group, value] of Object.entries(source as Record<string, unknown>)) {
    out[group] = value && typeof value === 'object' && !Array.isArray(value)
      ? { ...(value as Record<string, unknown>) }
      : value;
  }
  return out as unknown as Theme;
}

export const THEME: Theme = cloneTheme(THEMES.light as Theme);
export type Theme = (typeof THEMES)['light'];

/** Swaps every token in place. All existing `THEME.*` readers see the change. */
export function applyTheme(name: ThemeName): void {
  const next = cloneTheme(THEMES[name] as Theme);
  const cur = THEME as unknown as Record<string, Record<string, unknown>>;
  const dst = next as unknown as Record<string, Record<string, unknown>>;
  for (const group of Object.keys(dst)) {
    const target = cur[group];
    if (!target) continue;
    for (const key of Object.keys(target)) delete target[key];
    Object.assign(target, dst[group]);
  }
}

export function isThemeName(value: unknown): value is ThemeName {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(THEMES, value);
}

/** Player ball color by index (0-based). Falls back to palette cycling. */
export function playerColor(index: number, fallback?: string): string {
  const palette = THEME.colors.playerColors;
  if (fallback && /^#[0-9a-fA-F]{3,8}$/.test(fallback)) return fallback;
  return palette[index % palette.length] ?? THEME.colors.primary;
}

/**
 * Wall color for a player: same hue family as the ball, slightly
 * softer so walls stay readable and don't overpower the board.
 */
export function wallColorForPlayer(ballColor: string, alpha = THEME.colors.wallOpacity): string {
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
