import { useSyncExternalStore } from 'react';
import { isPremiumActive, usePremium } from '../monetization/premium';

/**
 * Exclusive board palette (MONETIZATION.md P5.1).
 *
 * Deliberately board-surface ONLY — cells, board chrome, wall slots and the
 * wall tray. Player orbs, placed walls, HUD cards and menus keep their
 * identity colors on every palette (strategy readability first, and it keeps
 * this change to the two match-surface components instead of a 16-screen
 * ThemeContext migration; full-app dark mode stays a future extension).
 *
 * Gating: `midnight` renders only for premium members. Anything else —
 * free tier, lapsed subscription, unknown stored value (E23) — falls back to
 * `light` with no error and no blank surface.
 */

export type BoardThemeName = 'light' | 'midnight';

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

export function parseBoardThemeName(raw: unknown): BoardThemeName {
  return raw === 'midnight' ? 'midnight' : 'light';
}

/* Render-path store (sync; settings are the persisted copy in gameStorage). */

let themeName: BoardThemeName = 'light';
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

/** Pure gate (unit-tested); the hook below wires the live inputs. */
// TEMP-TEST ONLY — REMOVE BEFORE ANY RELEASE BUILD (with DEV_UNLOCK_BOTS and
// the SettingsScreen DEV_UNLOCK_THEME). Forces midnight to render without a
// sandbox subscription so the palette can be playtested.
const DEV_UNLOCK_MIDNIGHT_RENDER = true;

export function resolveBoardPalette(
  name: BoardThemeName,
  premiumActive: boolean
): BoardPalette {
  if (name === 'midnight' && (DEV_UNLOCK_MIDNIGHT_RENDER || premiumActive))
    return MIDNIGHT_BOARD;
  return LIGHT_BOARD;
}

/** The palette the board surface renders right now (gated + fallback). */
export function useBoardPalette(): BoardPalette {
  const name = useBoardThemeName();
  const premium = usePremium();
  return resolveBoardPalette(name, isPremiumActive(premium));
}

/** Test seam: drops in-memory state without touching disk. */
export function __resetBoardThemeForTests(): void {
  themeName = 'light';
  listeners.clear();
}
