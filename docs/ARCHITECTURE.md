# DuoOrb System Architecture & Technical Topology

> **Status:** Ground-Truth Specification  
> **Target:** Production Monorepo (`apps/*`, `packages/*`, `modules/*`)

---

## 1. System Topology Overview

DuoOrb is a modern, cross-platform tactical board game platform built with high-performance native engines, authoritative server validation, real-time WebSockets, and client-side AI analysis.

```mermaid
graph TD
    subgraph Client ["Client Layer (apps/mobile)"]
        UI["React Native / Expo 57 UI<br/>(State Navigation, Board, HUDs)"]
        Audio["Sound System<br/>(duoorb-sfx)"]
        AdEngine["Smart Ad Pacing Engine<br/>(AdMob & AdSense H5)"]
        LocalStore["AsyncStorage & Cache<br/>(History, Settings, 3-Star Mastery)"]
        ClientAI["AI Worker / Review Loader"]
    end

    subgraph NativeEngine ["High-Performance AI & Analysis"]
        WASM["WebAssembly Module<br/>(duoorb_analyzer.wasm)"]
        JNI["Android JNI Native Module<br/>(modules/duoorb-ai-native & .so)"]
        RustCore["Rust Analyzer Core<br/>(packages/analyzer-rust)"]
        TSCore["TypeScript Core<br/>(packages/game-core)"]
    end

    subgraph ServerLayer ["Authoritative Server (apps/server)"]
        Gateway["Socket.IO Real-time Gateway<br/>(ws / gateway)"]
        Matchmaker["Glicko-2 Matchmaking Queue"]
        AuthService["Auth & Session Management<br/>(Supabase & JWT)"]
        BillingService["RevenueCat Webhook & Entitlements"]
        DB[(PostgreSQL Database via Prisma)]
    end

    UI --> ClientAI
    UI --> Audio
    UI --> AdEngine
    UI --> LocalStore
    UI <-->|Socket.IO Events (@duoorb/protocol)| Gateway
    UI <-->|REST API| ServerLayer

    ClientAI -->|Web & Fallback| WASM
    ClientAI -->|Android Native Build| JNI
    JNI --> RustCore
    WASM --> RustCore
    ClientAI -->|Rule Simulation| TSCore

    Gateway --> Matchmaker
    Gateway --> AuthService
    BillingService --> DB
    ServerLayer --> DB
```

---

## 2. Workspace Packages & Responsibilities

| Directory | Package / Role | Technologies | Responsibility |
| :--- | :--- | :--- | :--- |
| `apps/mobile` | Mobile Client | Expo ~57, React Native 0.86, React 19, TypeScript | Mobile & Web frontend application. Implements tactile light/dark UI, board graphics, state-driven navigation, game reviews, and monetization gates. |
| `apps/server` | Authoritative Server | NestJS 10, Socket.IO, Prisma 6, PostgreSQL | Authoritative game loops, Glicko-2 matchmaking, private rooms, presence, reconnect grace registry, bot win sync, and RevenueCat subscription validation. |
| `packages/game-core` | Core Game Engine | TypeScript | Complete game ruleset (Classic 1v1, Center Rush, Race 2/3/4), move validation, pathfinding, 39 bot personalities, and notations. |
| `packages/analyzer-rust` | Performance Analyzer | Rust, NAPI-RS, WASM, JNI | Monte Carlo Tree Search (MCTS) with PUCT/RAVE, alpha-beta minimax endgame solver, Zobrist transposition table, and post-match review classifier. |
| `packages/protocol` | Shared Contracts | TypeScript | Shared WebSocket events, packet schemas, DTOs, and error codes between `apps/mobile` and `apps/server`. |
| `modules/duoorb-ai-native` | JNI Native Bridge | Android C++/CMake, Kotlin | React Native Expo config module exposing the compiled `libduoorb_analyzer.so` Rust binary directly to Android devices. |
| `modules/duoorb-sfx` | Low-Latency Audio | Kotlin (Android SoundPool), Swift (iOS AVAudioPlayer) | Preloaded multi-voice native sound effects with zero latency. |

---

## 3. Game Flow & Engine Execution

### A. Offline AI Matches
1. **Selection:** The player selects one of **39 distinct bot personalities** across 4 tiers (Beginner, Intermediate, Master, Grandmaster).
2. **Thinking Execution:**
   - On **Android native builds**, calls execute synchronously or asynchronously through `duoorb-ai-native` into the native Rust MCTS solver.
   - On **Web/iOS fallback**, search runs inside a background Web Worker or slice-budgeted engine via `duoorb_analyzer.wasm` / `packages/game-core`.
   - **No UI Freezing:** Game clocks operate on real-time millisecond deltas, independent of search ticks.
3. **Move Variety:** Bots incorporate Dirichlet noise, Softmax temperature, and opening books to ensure non-repeating gameplay.
4. **Outcome & Mastery:** Defeating bots awards **1 to 3 stars** based on undos used and play efficiency, stored locally and synced with `apps/server/src/aiwins`.

### B. Authoritative Online Matches
1. **Matchmaking:** Players enter the ranked queue via Socket.IO. The server pairs players within expanding Glicko-2 rating bands.
2. **Move Validation:** Each move is dispatched to `apps/server/src/game/authoritative-game.service.ts`. Invalid moves or out-of-order sequence numbers are rejected.
3. **Disconnection & Grace:** If a player disconnects, the server marks the player as temporarily disconnected (`wifi-off`), granting a reconnect grace period before resigning by timeout.

### C. Post-Game Review & Move Classification
1. Move history is evaluated by `packages/analyzer-rust` (or client WASM).
2. For each ply, the evaluation bar ($P_{win} \in [-1.0, 1.0]$) is computed.
3. Moves are classified into standard chess-like tactical tiers:
   - **Book Move**: Standard opening book.
   - **Best Move**: Engine's top recommendation.
   - **Excellent**: Win probability delta $\Delta W \le 0.04$.
   - **Good**: Win probability delta $\Delta W \le 0.09$.
   - **Inaccuracy**: Win probability delta $\Delta W \le 0.18$.
   - **Mistake**: Win probability delta $\Delta W \le 0.30$.
   - **Blunder**: Severe swing where $\Delta W > 0.30$ and the evaluation flips sign ($eval_{before} \times eval_{after} < 0$).

---

## 4. Monetization & Economy Topology

- **RevenueCat (`apps/server/src/billing` & `apps/mobile/src/monetization/premium.ts`):** Validates monthly/yearly subscriptions and lifetime passes on Google Play. Grants unlimited undos, full AI review, and the universal Premium Crown badge (`<PremiumBadge />`).
- **AdMob (`apps/mobile/src/monetization/`):**
  - **Smart Ad Pacing Engine (`adPacingEngine.ts`):** Retention-safe interstitial ad trigger on positive transitions (e.g. Win $\rightarrow$ New Match), strictly suppressed on rematches or rage-quits.
  - **Rewarded Video Ad:** Watching a video grants **+3 Undos** during offline AI matches.
- **AdSense H5 (`apps/mobile/public/` & `adsNative.web.ts`):** H5 games ad integration for Web/PWA visitors.
