/**
 * Test stub for `react-native`.
 *
 * The real package ships Flow-typed source that a plain Node test runner
 * cannot parse. Only `Platform.OS` is needed by the modules under test
 * (the identity store, the session layer, the socket manager), so this stub
 * exposes exactly that and nothing else.
 */
export const Platform = {
  OS: 'android' as const,
  select: <T,>(specifics: { android?: T; ios?: T; default?: T }): T | undefined =>
    specifics.android ?? specifics.default,
};

export const AppState = {
  currentState: 'active',
  addEventListener: () => ({ remove: () => {} }),
};

/**
 * Minimal StyleSheet for component modules imported by pure-function tests
 * (label/copy helpers). Only `create` runs at import time; components
 * themselves are never rendered in Node.
 */
export const StyleSheet = {
  create: <T extends Record<string, unknown>>(styles: T): T => styles,
  absoluteFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  hairlineWidth: 1,
  flatten: <T,>(style: T): T => style,
};

export default { Platform, AppState, StyleSheet };
