import { useSyncExternalStore } from 'react';
import { isPremiumActive, usePremium } from '../monetization/premium';

/**
 * Board skin system (premium boards).
 *
 * Free: `classic` — the current surface, light in light mode and Midnight
 * in dark mode. Dark Mode board is free for everyone.
 *
 * Premium: `walnut` (wood). All skins stay 2D
 * Views — depth is faked with layered borders, bevel edge colors and drop
 * ellipses, so there is no native/GPU cost and Expo Go renders them
 * identically.
 *
 * Identity rule (strategy readability): skins restyle the FINISH of orbs
 * and walls (rim, highlight, shadow, capsule vs chunk) but never their HUE
 * family — playerColor stays the source of truth on every skin, in every
 * player count (2p/4p), in both app appearances. Geometry (boardMetrics,
 * wallRect, gaps) is shared, so skins only ever paint.
 *
 * Gating: premium skins render only for premium members. Anything else —
 * free tier, lapsed subscription, unknown stored id — falls back to
 * `classic` with no error and no blank surface.
 */

export type BoardSkinId = 'classic' | 'walnut';

export const BOARD_SKIN_IDS: readonly BoardSkinId[] = [
  'classic',
  'walnut',
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
  /** Oak grain woven through the board surface behind the cells (walnut). */
  boardGrain?: 'oak';
  /** Frame silhouette. */
  frameRadius: number;
  frameBorderWidth: number;
  /** Inner bevel/stitch line inside the frame (walnut stitch). */
  frameInnerBorder?: string;
  /** Translucent light strip across the top frame edge. */
  frameSheen?: boolean;
  /** Glacier goal lips: red top edge, blue bottom edge. */
  goalEdgeTop?: string;
  goalEdgeBottom?: string;
  /** Cell silhouette + checker second tone. */
  cellRadius: number;
  cellAlt?: string;
  /** Painted tile bevel: lighter top/left edge, darker bottom/right edge. */
  cellBevelLight?: string;
  cellBevelDark?: string;
  /** Glacier edge coordinates (a–i, 1–9) inside the rim squares. */
  showCoordinates?: boolean;
  coordinateColor?: string;
  /** Wall silhouette: px radius or full capsule. */
  wallRadius: number | 'capsule';
  /** Wall finish: glow (shadow in owner hue), flat matte, or neutral wood. */
  wallStyle: 'glow' | 'flat' | 'neutral';
  /** Neutral fence colors (walnut stained wood, same for every player). */
  neutralWall?: string;
  neutralWallEdge?: string;
  /** Light strip along the top of placed walls (bevel highlight). */
  wallTopLight?: string;
  /**
   * Orb finish: gloss 3D sphere (classic) or flat dama-style disc (walnut —
   * matte, groove ring, no glow). Hue family still comes from playerColor
   * on every skin.
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
 * Walnut — a real wooden table. Dark walnut page, oak playing field with
 * grain, inlaid cells in dark grooves, FLAT turned-wood discs (dama style,
 * no gloss, no glow) and NEUTRAL stained fences like the physical game.
 */
export const WALNUT_SKIN: BoardSkin = {
  id: 'walnut',
  premiumOnly: true,
  pageBackground: '#2E1D12',
  pageTexture: 'walnutTable',
  boardGrain: 'oak',
  boardBackground: '#D0A166',
  boardBorder: '#3A2415',
  cell: '#F2CD8D',
  cellAlt: '#E9BE7C',
  cellBorder: '#4A2E18',
  wallSlot: 'rgba(46, 26, 14, 0.85)',
  wallSlotSize: 5,
  trayCard: '#D0A166',
  trayHairline: '#8A5A30',
  trayPill: '#3A2415',
  trayCount: '#F0D9AE',
  frameRadius: 14,
  frameBorderWidth: 10,
  frameInnerBorder: '#8A5A30',
  cellRadius: 2,
  wallRadius: 0,
  wallStyle: 'neutral',
  neutralWall: '#38200F',
  neutralWallEdge: '#8A5A30',
  orbStyle: 'flatDisc',
  orbGroove: 'rgba(46, 26, 14, 0.55)',
  orbRimWidth: 2,
  trayRadius: 12,
  traySlotRadius: 6,
  hudCard: '#E9C88F',
  hudBorder: '#8A5A30',
  hudInk: '#3A2415',
  hudSubInk: '#6B4423',
  hudChip: '#F5E6C8',
};

export const BOARD_SKINS: Record<BoardSkinId, BoardSkin> = {
  classic: CLASSIC_LIGHT_SKIN,
  walnut: WALNUT_SKIN,
};

export function parseBoardSkinId(raw: unknown): BoardSkinId {
  return raw === 'walnut' ? raw : 'classic';
}

/**
 * Test unlock: dev builds (Expo Go, dev client) render every skin without a
 * subscription so boards can be playtested. Release builds (`__DEV__` false)
 * stay premium-gated — no flag to remember to flip before release.
 */
const DEV_UNLOCK_SKINS =
  typeof __DEV__ !== 'undefined' && __DEV__;

export function skinsUnlocked(premiumActive: boolean): boolean {
  return DEV_UNLOCK_SKINS || premiumActive;
}

export type BoardThemeName = 'light' | 'midnight';

export function parseBoardThemeName(raw: unknown): BoardThemeName {
  return raw === 'midnight' ? 'midnight' : 'light';
}

/* Render-path store (sync; settings are the persisted copy in gameStorage). */

let themeName: BoardThemeName = 'light';
let skinId: BoardSkinId = 'classic';
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
 * free for everyone); premium skins need an active membership, otherwise
 * they fall back to classic with no error and no blank surface.
 */
export function resolveBoardSkin(
  id: BoardSkinId,
  premiumActive: boolean,
  mode: BoardThemeName
): BoardSkin {
  if (id !== 'classic' && !skinsUnlocked(premiumActive)) {
    return mode === 'midnight' ? CLASSIC_MIDNIGHT_SKIN : CLASSIC_LIGHT_SKIN;
  }
  if (id === 'classic') {
    return mode === 'midnight' ? CLASSIC_MIDNIGHT_SKIN : CLASSIC_LIGHT_SKIN;
  }
  return BOARD_SKINS[id];
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
  skinId = 'classic';
  listeners.clear();
}
