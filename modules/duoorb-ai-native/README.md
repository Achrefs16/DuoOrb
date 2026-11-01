# duoorb-ai-native

React Native / Expo native module bridging `@duoorb/mobile` to the compiled Rust analyzer binary (`libduoorb_analyzer.so`) via JNI on Android devices.

---

## 1. Capabilities

- **`getBestAction(stateJson, simulations, threads)`**: Executes multi-threaded MCTS search (50,000+ simulations) on a background thread without freezing the JS event loop.
- **`getRankedActions(stateJson, simulations, threads, topK)`**: Returns top candidate moves with visit counts and win probability for bot personality tuning.
- **`getBotAction(stateJson, botId, seed)`**: Direct move generation from the native Rust personality engine with temperature scaling and noise injection.
- **`getHint(stateJson)`**: Grandmaster hint Oracle delivering sub-10ms move recommendations, win probability %, and human-readable tactical explanations.
- **`analyzeGame(initialStateJson, historyJson)`**: 100% offline match analysis completing in `< 60ms`, generating win probability curves and move classification tags.

---

## 2. Platform Support & Fallbacks

- **Android (Native Build):** Loads `libduoorb_analyzer.so` via JNI.
- **Web & Expo Go Fallback:** Automatically falls back to WebAssembly (`apps/mobile/public/duoorb_analyzer.wasm`) running in background Web Workers.
