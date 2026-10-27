import { useSyncExternalStore } from 'react';

export type OrbPaletteId = 'classic';

export const ORB_PALETTE_IDS: readonly OrbPaletteId[] = ['classic'];

export interface OrbPalette {
  id: OrbPaletteId;
  name: string;
  desc: string;
  colors: readonly [string, string, string, string];
}

export const ORB_PALETTES: Record<OrbPaletteId, OrbPalette> = {
  classic: {
    id: 'classic',
    name: 'Classic Duo',
    desc: 'Tactical Blue & Coral Red',
    colors: ['#3B82F6', '#E5484D', '#0E9F6E', '#D97706'],
  },
};

export function parseOrbPaletteId(_raw?: unknown): OrbPaletteId {
  return 'classic';
}

let activeOrbPaletteId: OrbPaletteId = 'classic';
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

export function setOrbPaletteId(next: unknown): OrbPaletteId {
  activeOrbPaletteId = parseOrbPaletteId(next);
  emit();
  return activeOrbPaletteId;
}

export function useOrbPaletteId(): OrbPaletteId {
  return useSyncExternalStore(subscribe, () => activeOrbPaletteId, () => activeOrbPaletteId);
}

export function getActiveOrbPalette(): OrbPalette {
  return ORB_PALETTES[activeOrbPaletteId] ?? ORB_PALETTES.classic;
}
