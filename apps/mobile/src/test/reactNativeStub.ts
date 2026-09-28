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
 * Identity pass-through, matching the real implementation closely enough for
 * the theme tests: `createThemedStyles` depends on it rebuilding, and a stub
 * that returned a constant would hide exactly the bug under test.
 */
export const StyleSheet = {
  create: <T,>(styles: T): T => styles,
  absoluteFill: {},
  absoluteFillObject: {},
  hairlineWidth: 1,
};

export default { Platform, AppState, StyleSheet };
