/**
 * Metro asset imports. `import clip from './x.wav'` resolves to the numeric
 * asset ID at bundle time — the same value the old require() form produced.
 * Declared here so TypeScript accepts static sound imports; in unit tests the
 * vitest asset-stub plugin routes these to a numeric stand-in instead.
 */
declare module '*.wav' {
  const src: number;
  export default src;
}

declare module '*.mp3' {
  const src: number;
  export default src;
}
