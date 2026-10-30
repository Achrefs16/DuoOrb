import { useSyncExternalStore } from 'react';
import { isPremiumActive, usePremium } from '../monetization/premium';

/**
 * Board skin system.
 *
 * All board designs (Classic, Tactile 3D, Warm Stone) are free
 * for all players.
 *
 * Identity rule (strategy readability): skins restyle the FINISH of orbs
 * and walls (rim, highlight, shadow, capsule vs chunk) but never their HUE
 * family — playerColor stays the source of truth on every skin, in every
 * player count (2p/4p), in both app appearances. Geometry (boardMetrics,
 * wallRect, gaps) is shared, so skins only ever paint.
 */

export type BoardSkinId = 'classic' | 'tactile' | 'tactileDark' | 'stone';

export const BOARD_SKIN_IDS: readonly BoardSkinId[] = [
  'classic',
  'tactile',
  'tactileDark',
  'stone',
];

/** Board-surface tokens (kept so existing palette call sites typecheck). */
export interface BoardPalette {
  boardBackground: string;
  boardBorder: string;
  cell: string;
  cellBorder: string;
  wallSlot: string;
  trayCard: string;
  trayHairline: string;
  trayPill: string;
  trayCount: string;
}

/**
 * Full skin: surface tokens plus the design tokens GameBoard/WallTray
 * paint with. Every optional field has a classic fallback at the call
 * site, so a skin only declares what it changes.
 */
export interface BoardSkin extends BoardPalette {
  id: BoardSkinId;
  premiumOnly: boolean;
  /**
   * Whole match-page takeover: page background + full-bleed texture behind
   * the HUD, board and tray. Classic leaves both unset (app theme owns it).
   */
  pageBackground?: string;
  pageTexture?: 'walnutTable';
  /** Wood grain pattern behind the cells. */
  boardGrain?: 'oak';
  /** Frame silhouette. */
  frameRadius: number;
  frameBorderWidth: number;
  /** Inner bevel/stitch line inside the frame. */
  frameInnerBorder?: string;
  /** Translucent light strip across the top frame edge. */
  frameSheen?: boolean;
  /** Goal lips: red top edge, blue bottom edge. */
  goalEdgeTop?: string;
  goalEdgeBottom?: string;
  /** Cell silhouette + checker second tone. */
  cellRadius: number;
  cellAlt?: string;
  /** Inter-cell spacing / channel width override (defaults to ~1.8% of board area). */
  cellGap?: number;
  /** Painted tile bevel: lighter top/left edge, darker bottom/right edge. */
  cellBevelLight?: string;
  cellBevelDark?: string;
  /** Edge coordinates (a–i, 1–9) inside the rim squares. */
  showCoordinates?: boolean;
  coordinateColor?: string;
  /** Wall silhouette: px radius or full capsule. */
  wallRadius: number | 'capsule';
  /** Wall finish: glow (shadow in owner hue), flat matte, or neutral finish. */
  wallStyle: 'glow' | 'flat' | 'neutral';
  /** Neutral fence colors (same for every player). */
  neutralWall?: string;
  neutralWallEdge?: string;
  /** Light strip along the top of placed walls (bevel highlight). */
  wallTopLight?: string;
  /**
   * Orb finish: gloss 3D sphere (classic) or flat disc.
   * Hue family still comes from playerColor on every skin.
   */
  orbStyle: 'gloss' | 'flatDisc';
  /** Groove-ring color on flat discs (defaults to a darkened orb hue). */
  orbGroove?: string;
  /** Orb finish: rim ring + grounding shadow + highlight strength. */
  orbRim?: string;
  orbRimWidth?: number;
  orbShadow?: boolean;
  orbHighlightOpacity?: number;
  /** Wall-slot dot size override. */
  wallSlotSize?: number;
  /** Tray silhouette. */
  trayRadius?: number;
  traySlotRadius?: number;
  /**
   * Match-page HUD takeover: player cards wear the skin (bg + border + ink).
   * All four unset = app theme owns the cards (classic). Set together or
   * not at all — a card background without matching ink breaks contrast.
   */
  hudCard?: string;
  hudBorder?: string;
  hudInk?: string;
  hudSubInk?: string;
  hudChip?: string;
}

/** Pixel-identical to the current THEME.colors board/tray tokens. */
export const LIGHT_BOARD: BoardPalette = {
  boardBackground: '#FFFFFF',
  boardBorder: '#CBD5E1',
  cell: '#F1F5F9',
  cellBorder: '#E2E8F0',
  wallSlot: 'rgba(100, 116, 139, 0.30)',
  trayCard: '#FFFFFF',
  trayHairline: '#E2E8F0',
  trayPill: '#F1F5F9',
  trayCount: '#0F172A',
};

/** Deep-navy surface, slate chrome, gold-friendly (crown marker pops). */
export const MIDNIGHT_BOARD: BoardPalette = {
  boardBackground: '#0F172A',
  boardBorder: '#334155',
  cell: '#1E293B',
  cellBorder: '#334155',
  wallSlot: 'rgba(148, 163, 184, 0.35)',
  trayCard: '#131B2E',
  trayHairline: '#334155',
  trayPill: '#1E293B',
  trayCount: '#F1F5F9',
};

const CLASSIC_EXTRAS = {
  frameRadius: 8,
  frameBorderWidth: 1,
  cellRadius: 4,
  wallRadius: 4,
  wallStyle: 'glow',
  orbStyle: 'gloss',
  trayRadius: 8,
  traySlotRadius: 4,
} as const;

export const CLASSIC_LIGHT_SKIN: BoardSkin = {
  ...LIGHT_BOARD,
  ...CLASSIC_EXTRAS,
  id: 'classic',
  premiumOnly: false,
};

export const CLASSIC_MIDNIGHT_SKIN: BoardSkin = {
  ...MIDNIGHT_BOARD,
  ...CLASSIC_EXTRAS,
  id: 'classic',
  premiumOnly: false,
};

/**
 * Tactile 3D — Rounded squircle porcelain tiles on warm stone gutters,
 * neutral capsule clay walls, 3D glossy spheres, NO intersection dots.
 */
export const TACTILE_BOARD: BoardPalette = {
  boardBackground: '#E8E5DC',
  boardBorder: '#D8D4C8',
  cell: '#F6F4EE',
  cellBorder: '#E6E2D8',
  wallSlot: 'transparent',
  trayCard: '#FFFFFF',
  trayHairline: '#E2DED6',
  trayPill: '#F6F4EE',
  trayCount: '#1E293B',
};

export const TACTILE_SKIN: BoardSkin = {
  ...TACTILE_BOARD,
  id: 'tactile',
  premiumOnly: false,
  boardBackground: '#E8E5DC',
  boardBorder: '#D8D4C8',
  cell: '#F6F4EE',
  cellBorder: '#E6E2D8',
  cellBevelLight: '#FFFFFF',
  cellBevelDark: '#D8D4C8',
  cellRadius: 9,
  frameRadius: 14,
  frameBorderWidth: 4,
  frameInnerBorder: '#E5E1D7',
  frameSheen: false,
  wallRadius: 'capsule',
  wallStyle: 'flat',
  wallSlot: 'transparent',
  wallSlotSize: 0,
  orbStyle: 'gloss',
  orbShadow: true,
  orbHighlightOpacity: 0.65,
  orbRimWidth: 0,
  trayRadius: 10,
  traySlotRadius: 6,
  hudCard: '#FFFFFF',
  hudBorder: '#E2DED6',
  hudInk: '#1E293B',
  hudSubInk: '#64748B',
  hudChip: '#F6F4EE',
};

/**
 * Tactile 3D Dark — the same porcelain squircle tiles, clay capsule walls and
 * glossy orbs on a warm charcoal table. This is an explicit variant: it stays
 * dark in light app mode, just as light Tactile stays light in dark app mode.
 */
export const TACTILE_DARK_BOARD: BoardPalette = {
  boardBackground: '#1F1D1B',
  boardBorder: '#3A3734',
  cell: '#312E2B',
  cellBorder: '#45423E',
  wallSlot: 'transparent',
  trayCard: '#312E2B',
  trayHairline: '#45423E',
  trayPill: '#3B3834',
  trayCount: '#F1F0EB',
};

export const TACTILE_DARK_SKIN: BoardSkin = {
  ...TACTILE_DARK_BOARD,
  id: 'tactileDark',
  premiumOnly: false,
  cellBevelLight: '#45423E',
  cellBevelDark: '#1B1917',
  cellRadius: 9,
  frameRadius: 14,
  frameBorderWidth: 4,
  frameInnerBorder: '#3A3734',
  frameSheen: false,
  wallRadius: 'capsule',
  wallStyle: 'flat',
  wallSlot: 'transparent',
  wallSlotSize: 0,
  orbStyle: 'gloss',
  orbShadow: true,
  orbHighlightOpacity: 0.55,
  orbRimWidth: 0,
  trayRadius: 10,
  traySlotRadius: 6,
  hudCard: '#312E2B',
  hudBorder: '#45423E',
  hudInk: '#FFFFFF',
  hudSubInk: '#C3C2C0',
  hudChip: '#3B3834',
};

/**
 * Warm Stone — Natural inset stone surface in warm ivory & stone tones.
 * Light cells #F7F6F2, dark cells #EDEBE5, stone groove #E8E6DF.
 * Reduced corner radius (2px), tight gaps (3px), no glass effect, no dots.
 */
export const STONE_BOARD: BoardPalette = {
  boardBackground: '#E8E6DF',
  boardBorder: '#D4D0C5',
  cell: '#F7F6F2',
  cellBorder: '#DFDDD5',
  wallSlot: 'transparent',
  trayCard: '#FFFFFF',
  trayHairline: '#E2DED6',
  trayPill: '#F7F6F2',
  trayCount: '#1E293B',
};

export const STONE_SKIN: BoardSkin = {
  ...STONE_BOARD,
  id: 'stone',
  premiumOnly: false,
  boardBackground: '#E8E6DF',
  boardBorder: '#D4D0C5',
  cell: '#F7F6F2',
  cellAlt: '#EDEBE5',
  cellBorder: '#DFDDD5',
  cellRadius: 2,
  cellGap: 3,
  frameRadius: 8,
  frameBorderWidth: 3,
  frameInnerBorder: '#DDD9CF',
  frameSheen: false,
  wallRadius: 2,
  wallStyle: 'neutral',
  neutralWall: '#8A8474',
  neutralWallEdge: '#5C5648',
  wallSlot: 'transparent',
  wallSlotSize: 0,
  orbStyle: 'gloss',
  orbShadow: false,
  orbHighlightOpacity: 0,
  orbRimWidth: 0,
  trayRadius: 8,
  traySlotRadius: 4,
  hudCard: '#FFFFFF',
  hudBorder: '#E2DED6',
  hudInk: '#1E293B',
  hudSubInk: '#64748B',
  hudChip: '#F7F6F2',
};

export const BOARD_SKINS: Record<BoardSkinId, BoardSkin> = {
  classic: CLASSIC_LIGHT_SKIN,
  tactile: TACTILE_SKIN,
  tactileDark: TACTILE_DARK_SKIN,
  stone: STONE_SKIN,
};

export function parseBoardSkinId(raw: unknown): BoardSkinId {
  if (raw === 'tactile') return 'tactile';
  if (raw === 'tactileDark') return 'tactileDark';
  if (raw === 'stone' || raw === 'chess') return 'stone';
  return 'classic';
}

/**
 * Premium skins render for active subscribers only — no dev bypass.
 */
export function skinsUnlocked(premiumActive: boolean): boolean {
  return premiumActive;
}

export type BoardThemeName = 'light' | 'midnight';

export function parseBoardThemeName(raw: unknown): BoardThemeName {
  return raw === 'midnight' ? 'midnight' : 'light';
}

/* Render-path store (sync; settings are the persisted copy in gameStorage). */

let themeName: BoardThemeName = 'light';
let skinId: BoardSkinId = 'tactile';
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Called from App whenever settings load or change. Never throws. */
export function setBoardThemeName(next: unknown): BoardThemeName {
  themeName = parseBoardThemeName(next);
  emit();
  return themeName;
}

export function useBoardThemeName(): BoardThemeName {
  return useSyncExternalStore(subscribe, () => themeName, () => themeName);
}

/** Called from App whenever settings load or change. Never throws. */
export function setBoardSkinId(next: unknown): BoardSkinId {
  skinId = parseBoardSkinId(next);
  emit();
  return skinId;
}

export function useBoardSkinId(): BoardSkinId {
  return useSyncExternalStore(subscribe, () => skinId, () => skinId);
}

/**
 * Pure gate (unit-tested). Classic follows the app appearance (Midnight is
 * free for everyone); all board designs are free for all players.
 */
export function resolveBoardSkin(
  id: BoardSkinId,
  premiumActive: boolean,
  mode: BoardThemeName
): BoardSkin {
  if (id === 'classic') {
    return mode === 'midnight' ? CLASSIC_MIDNIGHT_SKIN : CLASSIC_LIGHT_SKIN;
  }
  const skin = BOARD_SKINS[id] ?? CLASSIC_LIGHT_SKIN;
  if (skin.premiumOnly && !skinsUnlocked(premiumActive)) {
    return mode === 'midnight' ? CLASSIC_MIDNIGHT_SKIN : CLASSIC_LIGHT_SKIN;
  }
  return skin;
}

/**
 * Pure surface resolver (unit-tested). Midnight is free — no premium gate,
 * no dev flag. Unknown names fall back to light (E23).
 */
export function resolveBoardPalette(name: BoardThemeName): BoardPalette {
  return name === 'midnight' ? MIDNIGHT_BOARD : LIGHT_BOARD;
}

/** The skin the board surface renders right now (gated + fallback). */
export function useBoardSkin(): BoardSkin {
  const id = useBoardSkinId();
  const name = useBoardThemeName();
  const premium = usePremium();
  return resolveBoardSkin(id, isPremiumActive(premium), name);
}

/** Back-compat alias: the skin carries every palette field. */
export function useBoardPalette(): BoardSkin {
  return useBoardSkin();
}

/** Test seam: drops in-memory state without touching disk. */
export function __resetBoardThemeForTests(): void {
  themeName = 'light';
  skinId = 'tactile';
  listeners.clear();
}
