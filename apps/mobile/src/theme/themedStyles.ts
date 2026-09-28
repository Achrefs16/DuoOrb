import { StyleSheet } from 'react-native';
import { THEME } from '../theme';

/**
 * Theme-aware `StyleSheet.create`.
 *
 * THE reason this module exists. `StyleSheet.create` runs once, at module load,
 * and resolves `THEME.colors.x` to a plain string there. Swapping the theme
 * object afterwards changes nothing on screen — every already-built stylesheet
 * still holds the light string. That is why 37 screens could not simply read a
 * new theme.
 *
 * `createThemedStyles` returns a Proxy that builds the stylesheet lazily and
 * rebuilds it only when the active theme version changes. Style properties are
 * read during render, and a theme switch re-renders the tree, so consumers
 * pick up the new palette with no change to any screen or component.
 *
 * Cost: one stylesheet build per theme, cached, not one per property read.
 */

/** Bumped by the provider whenever the palette is replaced. */
let themeVersion = 0;
const cache = new WeakMap<object, { version: number; value: unknown }>();

export function bumpThemeVersion(): void {
  themeVersion += 1;
}

type Factory<T> = () => T;

/**
 * `NamedStyles` is what gives the object literal its contextual typing, so
 * `position: 'absolute'` keeps its literal union instead of widening to
 * `string`. Without this constraint every `style={styles.x}` in the app fails
 * to satisfy `StyleProp<ViewStyle>`.
 */
export function createThemedStyles<T extends StyleSheet.NamedStyles<any>>(
  factory: Factory<T>
): T {
  const cached = cache.get(factory);
  if (!cached || cached.version !== themeVersion) {
    cache.set(factory, { version: themeVersion, value: StyleSheet.create(factory()) as unknown });
  }
  // `current` is deliberately a mutable closure cell, not the Proxy's `target`.
  // A Proxy target is fixed at construction: reading `Reflect.get(target, ...)`
  // after a rebuild would keep serving the FIRST theme's values, so only the
  // property that happened to trigger the rebuild would be correct.
  const cell: { value: T } = { value: cache.get(factory)!.value as T };

  const rebuild = (): T => {
    const fresh = StyleSheet.create(factory()) as unknown as T;
    cell.value = fresh;
    cache.set(factory, { version: themeVersion, value: fresh });
    return fresh;
  };

  return new Proxy({} as T, {
    get(_target, prop) {
      if (cache.get(factory)?.version !== themeVersion) rebuild();
      const value = cell.value as unknown as Record<string | symbol, unknown>;
      return value[prop as string];
    },
    has(_target, prop) {
      if (cache.get(factory)?.version !== themeVersion) rebuild();
      return prop in (cell.value as object);
    },
    ownKeys() {
      if (cache.get(factory)?.version !== themeVersion) rebuild();
      return Reflect.ownKeys(cell.value as object);
    },
    getOwnPropertyDescriptor(_target, prop) {
      if (cache.get(factory)?.version !== themeVersion) rebuild();
      return Reflect.getOwnPropertyDescriptor(cell.value as object, prop);
    },
  });
}

/** Exposed for tests: the current theme identity a stylesheet was built for. */
export function currentThemeVersion(): number {
  return themeVersion;
}

/** The active theme object, for code that needs it outside a style factory. */
export { THEME };
