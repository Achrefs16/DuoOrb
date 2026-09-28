import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  applyTheme,
  THEME,
  THEME_SCHEME_KEY,
  Theme,
  ThemeName,
} from '../theme';
import { bumpThemeVersion } from './themedStyles';

/**
 * Runtime theme switching.
 *
 * The obstacle this solves: every screen builds its styles with
 * `StyleSheet.create` at module load, so swapping a colour on a plain object
 * changes nothing on screen — the styles captured the old string. `useThemedStyles`
 * rebuilds a screen's stylesheet whenever the active theme changes, which is why
 * `applyTheme` mutating the shared THEME object is enough to restyle the app.
 */

type Mode = 'light' | 'dark';

interface ThemeContextValue {
  /** 'light' | 'dark'. */
  mode: Mode;
  /** True until the stored preference has been read, to avoid a flash. */
  ready: boolean;
  setMode: (mode: Mode) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const isMode = (v: unknown): v is Mode => v === 'light' || v === 'dark';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<Mode>('light');
  const [ready, setReady] = useState(false);

  // Read the stored preference BEFORE first paint. The splash is already gated
  // on identity hydration, so applying here means the first frame the player
  // sees is already the right theme.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let stored: string | null = null;
      try {
        stored = await AsyncStorage.getItem(THEME_SCHEME_KEY);
      } catch {
        // fall through to the system default
      }
      if (cancelled) return;
      const next: Mode = isMode(stored) ? stored : system === 'dark' ? 'dark' : 'light';
      bumpThemeVersion();
      applyTheme(next as ThemeName);
      setModeState(next);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [system]);

  const setMode = useCallback((next: Mode) => {
    // Order matters: bump first so any stylesheet built during this render
    // pass is rebuilt from the NEW palette, not the old one.
    bumpThemeVersion();
    applyTheme(next as ThemeName);
    setModeState(next);
    void AsyncStorage.setItem(THEME_SCHEME_KEY, next).catch(() => {});
  }, []);

  const toggle = useCallback(() => {
    setMode(mode === 'dark' ? 'light' : 'dark');
  }, [mode, setMode]);

  const value = useMemo(
    () => ({ mode, ready, setMode, toggle }),
    [mode, ready, setMode, toggle]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeMode(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeMode must be used inside ThemeProvider.');
  return ctx;
}

/**
 * Rebuilds a stylesheet when the active theme changes.
 *
 * `factory` is called with the live THEME, so the style object it returns is
 * rebuilt on every theme switch — this is what actually repaints the screen.
 * StyleSheet.create is cheap and idempotent for a given object.
 */
export function useThemedStyles<T>(factory: () => T): T {
  const { mode } = useThemeMode();
  // `mode` is a deliberate invalidation signal, not a read: the factory closes
  // over the mutable THEME object, which carries no identity for React to see.
  // Without it the stylesheet would never rebuild on a switch.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => factory(), [mode, factory]);
}

/** The live theme object. Reading it is always current. */
export function useActiveTheme(): Theme {
  return THEME;
}
