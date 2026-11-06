# DuoOrb: System Capabilities & Ground Truth

This document establishes the single source of truth for all gameplay mechanics, bot personalities, analysis algorithms, modes, and platform capabilities implemented in the DuoOrb codebase. **All marketing copy, SEO content, and UI text must strictly align with this truth.**

---

## 1. Core Game Rules & Mechanics (`packages/game-core`)

DuoOrb is a modern strategic evolution of classic corridor/wall board duel games (such as Quoridor and Blockade):

| Mechanic | Implementation Truth | Technical Reference |
| :--- | :--- | :--- |
| **Grid Dimensions** | 9×9 cell board (81 squares total). Coordinates `(0,0)` to `(8,8)`. | `packages/game-core/src/constants.ts` |
| **Wall Lattice** | 8×8 intersection groove grid = **128 legal wall positions** (64 Horizontal, 64 Vertical). | `packages/game-core/src/walls.ts` |
| **Wall Geometry** | Each wall spans exactly 2 adjacent board cells and permanently blocks passage between them. Walls cannot overlap, intersect across each other, or extend outside the board. | `packages/game-core/src/walls.ts` |
| **Wall Budget** | Default **10 walls** per player in Classic 1v1. Custom room lobbies support **10, 15, or 99 walls**. | `packages/game-core/src/ruleset.ts` |
| **Turn Structure** | On each turn, a player must choose **strictly one** action: **Move their orb** one step OR **place one wall**. Passing is strictly illegal. | `packages/game-core/src/ruleset.ts` |
| **Pawn Jumps** | Face-to-face orthogonally: jump straight over the opponent. If a wall or board edge blocks the landing cell behind the opponent, the player may jump **diagonally** to any unblocked adjacent cell. | `packages/game-core/src/movement.ts` |
| **The Golden Path Invariant** | Placing a wall that completely seals either player from having at least one open walkable path to their goal row is **strictly illegal**. Validated on every tentative placement via BFS. | `packages/game-core/src/pathfinding.ts` |
| **Win Condition** | First player whose orb reaches **any square of their opponent's baseline (starting edge)** wins instantly. | `packages/game-core/src/ruleset.ts` |
| **Algebraic Notation** | Formal chess-like notation: Pawn moves recorded by destination cell (e.g., `e2`, `e8`). Wall placements recorded by coordinate and orientation (e.g., `v-d4`, `h-e5`). | `packages/game-core/src/notation.ts` |

---

## 2. Competitive Game Modes (`packages/game-core/src/types.ts`)

| Mode Code | Display Name | Players | Goal Condition | Wall Budget |
| :--- | :--- | :---: | :--- | :---: |
| `2p` | **Classic 1v1** | 2 | Race to the opposite baseline (Row 8 or Row 0) | 10 per player |
| `4p` | **Center Rush 4P** | 4 | Race to reach the exact center tile `(4,4)` | 5 per player |
| `center2` | **Center Rush 2P** | 2 | Race to capture center tile `(4,4)` | 10 per player |
| `center3` | **Center Rush 3P** | 3 | Race to capture center tile `(4,4)` | 6 per player |
| `race2` | **Baseline Race 2P** | 2 | Standard baseline race | 10 per player |
| `race3` | **Baseline Race 3P** | 3 | Race to opposing baseline with 3 players | 7 per player |
| `race4` | **Baseline Race 4P** | 4 | Race to opposing baseline with 4 players | 5 per player |

---

## 3. The 39 Named AI Bot Personalities (`personalities.ts`)

Unlike generic chess or corridor clones that offer 3 bland bots with random moves, DuoOrb features **39 individually crafted AI bot personalities** distributed across 4 distinct skill tiers. Each personality features unique search depths, wall usage frequency, heuristic aggression weights, and custom contextual dialogue.

### Tier 1: Beginner (Rating 800 – 1150)
*Designed for newcomers learning movement, jumping rules, and basic wall placement.*
1. **Martin (800)** — "The Friendly Dad" · Generous, low wall frequency, lets players learn jump mechanics.
2. **Pip (850)** — "The Curious Apprentice" · Hesitant, experiments with short detours.
3. **Elias (1100)** — "The Eager Student" · Focuses on straightforward forward races.
4. **Bram (950)** — "The Patient Giant" · Slow, steady, rarely drops aggressive traps.
5. **Nelson (1050)** — "The Bold Blunderer" · Drops unexpected early walls that occasionally backfire.
6. **Vex (1150)** — "The Trap Builder" · Starts exploring corner wall placements.
7. **Barnaby (900)** — "The Gentle Scholar" · Avoids direct confrontations.
8. **Finn (1000)** — "The River Runner" · Loves carving open long straight corridors.
9. **Clara (1120)** — "The Methodical Thinker" · Balances pawn steps with defensive blocks.

### Tier 2: Intermediate (Rating 1200 – 1650)
*Balanced tactical opponents who calculate 2–4 moves ahead, employ wall parity, and force wide detours.*
10. **Jamal (1650)** — "The Street Tactician" · Aggressive wall placement, punishing overextended pawns.
11. **Leo (1250)** — "The Ambitious Striker" · Fast pawn advances, drops walls when challenged.
12. **Tariq (1350)** — "The Desert Navigator" · Highly adept at long diagonal paths.
13. **Ren (1400)** — "The Precision Architect" · Symmetric wall layouts and corridor control.
14. **Mateo (1450)** — "The Counter-Puncher" · Saves walls for the middle game to reverse momentum.
15. **Zara (1500)** — "The Storm Strategist" · Fast-paced, creates rapid multi-turn bottlenecks.
16. **Archimedes (1550)** — "The Geometer" · Leverages board geometry and side-file traps.
17. **Fiona (1600)** — "The Highland Warden" · Tenacious defender who maintains tight wall reserves.
18. **Dmitri (1300)** — "The Iron Guard" · Heavy front-wall lines that slow games to methodical grinds.
19. **Layla (1380)** — "The Swift Shadow" · Quick jumps and dynamic flank escapes.

### Tier 3: Master (Rating 1700 – 2100)
*Ruthless strategists running 15,000+ MCTS playouts per turn with zero blunders and sharp endgame calculation.*
20. **Marcus (1900)** — "The Centurion" · Strict tempo player; masters the 3-Space Rule.
21. **Viktor (2100)** — "The Grand Tactician" · Relentless wall parity calculator; forces 20+ step detours.
22. **Dante (1750)** — "The Labyrinth Master" · Excels in serpentine multi-layer maze construction.
23. **Meiling (1800)** — "The Silk Weaver" · Subtle wall nudges that slowly strangle opponent mobility.
24. **Amara (1850)** — "The Sun Oracle" · Anticipates opponent jump traps 3 turns in advance.
25. **Gideon (1950)** — "The Fortress Commander" · Flawless defensive wall preservation.
26. **Sora (2000)** — "The Wind Dancer" · Exploits edge corridors and diagonal jump escapes.
27. **Samira (2050)** — "The Horizon Chaser" · Master of tempo sacrifices to win baseline sprints.
28. **Torstein (1720)** — "The Viking Voyager" · Brutal forward marches that break through center blocks.
29. **Kofi (1880)** — "The Golden Lion" · Balances tempo and wall count with mathematical precision.

### Tier 4: Grandmaster (Rating 2150 – 2450)
*Top-tier computational engines capable of deep alpha-beta endgame solving and tournament-level play.*
30. **Achref (2400)** — "The Grandmaster Engine" · DuoOrb creator avatar; plays near-optimal MCTS lines.
31. **Diego (2200)** — "The Matador" · Baits aggressive opponent walls, then sidesteps into open lanes.
32. **Hassan (2250)** — "The Master Builder" · Constructs impenetrable labyrinths with minimum wall expenditure.
33. **Jin (2300)** — "The Zen Master" · Calm, cold precision; never miscalculates shortest path BFS.
34. **Sterling (2350)** — "The Royal Sovereign" · Imposes absolute control over the center files.
35. **Kenzo (2420)** — "The Silent Blade" · Ruthless punisher of minor path deviations.
36. **Valeria (2440)** — "The Empress" · Calculates deep transposition tables and forced zugzwang lines.
37. **Nexus9 (2450)** — "The Pure Neural Solver" · Maximum MCTS rollout budget with zero randomness.
38. **Boba (2180)** — "The Mysterious Wanderer" · Unorthodox, disruptive openings that confuse classical players.
39. **Milo (2220)** — "The Prodigy" · Lightning-fast calculation and aggressive tempo sacrifices.

---

## 4. Hybrid Rust MCTS & Analysis Engine (`packages/analyzer-rust`)

DuoOrb includes an industrial-grade game engine written in Rust:
- **50,000+ Simulations/Second**: Runs via JNI native libraries (`libduoorb_analyzer.so`) on Android and WebAssembly (`duoorb_analyzer.wasm`) on Web browsers.
- **PUCT & RAVE**: Predictor-Upper Confidence Bounds applied to Trees combined with Rapid Action Value Estimation for rapid convergence on deep moves.
- **Endgame Minimax Solver**: Automatic alpha-beta solver activates when path distances collapse, guaranteeing mathematically optimal endgame resolution.
- **Zobrist Transposition Hashing**: Board configurations hashed into 64-bit keys to reuse search results across transposed move orders.
- **Engine Review Pipeline**:
  - Calculates win-equity change per turn ($\Delta W$).
  - Move classifications: `BOOK`, `BEST`, `EXCELLENT`, `GOOD`, `INACCURACY`, `MISTAKE`, `BLUNDER`.
  - Computes match accuracy percentages (0–100%) and highlights critical turning points.

---

## 5. Authoritative Real-Time Multiplayer (`apps/server`)

- **NestJS 10 Gateway**: Socket.IO transport with heartbeat checks, automatic reconnect sessions, and rate-limiting guards.
- **Glicko-2 Rating System**: Accurate rating calculations with rating deviation ($RD$) and volatility ($\sigma$). Default baseline is 1500.
- **Private Room Lobbies**: Shareable 6-letter room codes (`https://duoorb.com/?room=CODE`) with customizable wall counts (10, 15, 99) and time controls.
- **7 Fischer Clocks**: `1+0` Bullet, `1+1` Bullet, `3+0` Blitz, `3+2` Blitz, `5+0` Rapid, `5+3` Rapid, and `10+0` Classical.
- **Disconnect Grace Period**: Authoritative 30-second disconnect timer prevents instant forfeits during transient mobile network drops.

---

## 6. Platforms, Availability & Monetization

1. **Android (Native)**:
   - **Status**: **LIVE on Google Play Store** (Package: `com.asdigital.duoorb`).
   - Current Production Releases: v1.0.5, v1.0.6, v1.0.7 (VersionCode 20).
   - In-app purchases managed through RevenueCat (Crown badges, unlimited undos, full move review).
   - Smart Ad Pacing Engine (AdMob interstitial pacing, rewarded ads for +3 undos during bot matches).
2. **Web / Desktop Browser**:
   - **Status**: **LIVE at `https://duoorb.com/`**.
   - Zero signup required; instant guest play with full WebAssembly AI bot engine.
   - PWA compliant with Service Worker shell caching.
3. **iOS (iPhone & iPad)**:
   - **Current Status**: **Instant Play via Mobile Safari / Web Browser (PWA)**.
   - Supports 1-click "Add to Home Screen" for full-screen offline-capable app experience.
   - Native Apple App Store app is on the development roadmap (not yet released).

