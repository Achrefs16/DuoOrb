/**
 * Stand-in for binary sound assets in unit tests.
 *
 * Metro turns `require('../../assets/sounds/x.wav')` into a numeric asset ID
 * at bundle time. A Node test runner can parse neither the WAV bytes nor the
 * Metro require, so every sound asset resolves here instead. The value is
 * irrelevant — tests assert on the expo-asset mock's recorded IDs, which
 * proves the wiring without touching real audio.
 */
export default 424242;
