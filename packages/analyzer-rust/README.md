# @duoorb/analyzer-rust (`duoorb-analyzer`)

High-performance Rust game engine and tactical analysis module for DuoOrb. Compiles to native Node.js addons (NAPI-RS), WebAssembly (WASM), and Android native shared libraries (JNI `.so`).

---

## 1. Core Modules & Capabilities

- **`mcts.rs`**: Monte Carlo Tree Search engine featuring:
  - Predictor-Upper Confidence Bounds applied to Trees (PUCT).
  - Rapid Action Value Estimation (RAVE).
  - Zobrist Transposition Tables for board caching.
  - Playout rollouts with heuristic biasing.
- **`solver.rs`**: Fast endgame minimax solver with alpha-beta pruning and dynamic depth management.
- **`hybrid.rs`**: Hybrid decision orchestrator that blends deep MCTS exploration with exact endgame solving.
- **`pathfinding.rs`**: Highly optimized Breadth-First Search (BFS) pathfinder for shortest path calculations, obstacle detection, and wall path-blocking invariants.
- **`classifier.rs`**: Move classification engine calculating win probability delta ($\Delta W$) and evaluation flips:
  - `BOOK`, `BEST`, `EXCELLENT`, `GOOD`, `INACCURACY`, `MISTAKE`, `BLUNDER`.
- **`review.rs`**: Complete post-match analysis pipeline generating the win probability curve and mistake annotations.
- **`hints.rs`**: Real-time tactical hint generator recommending the optimal move or defensive wall placement.
- **`personality.rs`**: Profile adaptations adjusting search depth, noise, and aggression to mirror distinct playstyles.

---

## 2. Compilation Targets

### A. WebAssembly (`wasm32-unknown-unknown`)
Used by web browsers and development fallbacks:
```bash
cargo build --target wasm32-unknown-unknown --release
# Output placed in apps/mobile/public/duoorb_analyzer.wasm
```

### B. Android Native Shared Libraries (`aarch64-linux-android`, `x86_64-linux-android`)
Used by `modules/duoorb-ai-native` on Android devices:
```bash
cargo ndk -t arm64-v8a -t x86_64 -o ../../modules/duoorb-ai-native/android/src/main/jniLibs build --release
```

### C. Node.js Native Addon (NAPI-RS)
Used for local development, scripts, and server benchmarking:
```bash
npm run build --workspace=@duoorb/analyzer-rust
```

---

## 3. Running Rust Tests

```bash
cargo test
```
