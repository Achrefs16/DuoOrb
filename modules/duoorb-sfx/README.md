# DuoOrbSfx — preloaded multi-voice game SFX

One JS bridge, two native mixers:

- **Android** (`android/.../DuoOrbSfxModule.kt`): a single `SoundPool`
  (`maxStreams = 6`, `USAGE_GAME` / `CONTENT_TYPE_SONIFICATION`). Every clip is
  `load()`ed once; `play()` starts a new stream per event. The 10s load gate
  resolves `false` instead of hanging init forever.
- **iOS** (`ios/DuoOrbSfxModule.swift`): 4 preloaded `AVAudioPlayer` voices per
  sound (`prepareToPlay` at init), idle-voice round-robin at play, eldest reuse
  when all busy. Session is `.ambient` + `.mixWithOthers`.

JS contract (`src/index.ts`): `loadSounds(uris)` → `Promise<boolean>`;
`playSound(name)` fire-and-forget; `setNativeMuted(bool)` gates future plays
(in-flight tails decay); `releaseSounds()`; `isNativeReady()`. No queues, no
gaps, no seeks — allocation and eviction are the native mixer's job.

Discovered by Expo autolinking via `expo-module.config.json`; no app.json
plugin, no permissions, no Info.plist keys (playback only, session at runtime).
Requires a dev/production EAS build — Expo Go has no custom native code.
