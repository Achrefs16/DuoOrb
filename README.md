# DuoOrb

<div align="center">
  <h3>A Modern, High-Performance Tactical Grid Board Game</h3>
  <p>Cross-platform mobile client (Expo / React Native), authoritative real-time NestJS server, and hybrid Rust MCTS game engine.</p>
</div>

---

## 1. Monorepo Architecture

DuoOrb is structured as an **npm workspaces** monorepo combining TypeScript, React Native, NestJS, and native Rust.

```
DuoOrb/
├── apps/
│   ├── mobile/              # Expo SDK ~57 / React Native 0.86 client (Android, iOS, Web)
│   └── server/              # Authoritative NestJS 10 WebSocket gateway & REST API
├── packages/
│   ├── game-core/           # Rules engine, pathfinding, movement, 39 bots, and notations
│   ├── analyzer-rust/       # High-performance Rust MCTS, minimax solver, WASM, and JNI
│   └── protocol/            # Shared DTOs, wire contracts, and WebSocket event types
├── modules/
│   ├── duoorb-ai-native/    # Expo Android JNI native module loading libduoorb_analyzer.so
│   └── duoorb-sfx/          # Multi-voice native audio bridge (SoundPool & AVAudioPlayer)
├── docs/                    # Centralized system documentation & runbooks
│   ├── ARCHITECTURE.md      # Detailed system topology and execution modes
│   ├── DESIGN_SYSTEM.md     # Tactile UI/UX Design System and theme token reference
│   ├── PLAY_UPLOAD.md       # Google Play Console release runbook
│   └── SETUP_JOURNEY.md     # Third-party credentials and setup notes
└── plans/                   # Historical sprint plans and milestone blueprints
    ├── README.md            # Index of completed sprint phases (Phases 1–6)
    └── archive/             # Archived master specifications
```

---

## 2. Core Highlights

- **Hybrid Rust AI & Analysis Engine:**
  - 50,000+ MCTS simulations/sec running on background OS threads via JNI (`duoorb-ai-native`) and WebAssembly (`duoorb_analyzer.wasm`).
  - Minimax endgame solver with alpha-beta pruning and Zobrist transposition caching.
  - Full game review pipeline: win probability curve, accuracy scores, and tactical move assessments (`BOOK`, `BEST`, `EXCELLENT`, `GOOD`, `INACCURACY`, `MISTAKE`, `BLUNDER`).
- **Tactile Board & 39 Bot Personalities:**
  - 4 skill tiers (Beginner, Intermediate, Master, Grandmaster) with opening books, custom dialogue, and unique playstyles.
  - **3-Star Bot Mastery System (`⭐⭐⭐`)**: Unlock stars by winning without excessive assists.
- **Authoritative Real-Time Multiplayer:**
  - Socket.IO gateway with Glicko-2 rating engine, expanding matchmaking queue, private 6-letter room lobbies, and disconnect grace periods.
- **Production Monetization & Economy:**
  - RevenueCat integration for Google Play subscriptions (unlimited undos, full analysis, premium crowns).
  - Retention-safe Smart Ad Pacing Engine (interstitials on positive transitions, suppressed on rematches).
  - Rewarded Video Ads granting **+3 Undos** during offline AI matches.

---

## 3. Getting Started

### Prerequisites
- **Node.js**: `v22.x` or higher
- **npm**: `v10.x` or higher
- **Rust**: `1.80+` with `wasm32-unknown-unknown` target (for analyzer development)
- **PostgreSQL**: `v16+` (or Docker)

### Installation
```bash
# Clone the repository
git clone https://github.com/asdigital/duoorb.git
cd DuoOrb

# Install all workspace dependencies and compile core packages
npm install
```

### Environment Configuration
```bash
# Server environment
cp apps/server/.env.example apps/server/.env

# Mobile environment
cp apps/mobile/.env.example apps/mobile/.env
```

### Database Migration
```bash
npm run db:push --workspace=@duoorb/server
```

---

## 4. Development Commands

| Command | Action |
| :--- | :--- |
| `npm run mobile` | Starts Expo Metro bundler for the mobile client |
| `npm run server` | Starts NestJS server in watch mode with `tsx` |
| `npm run test` | Runs unit tests across `@duoorb/game-core` |
| `npm run build:packages` | Compiles `@duoorb/game-core` and `@duoorb/protocol` |
| `npm run lint` | Runs ESLint across Expo application |

---

## 5. Documentation Directory

For in-depth guides and runbooks, refer to the [`docs/`](./docs) directory:
- [**System Architecture**](./docs/ARCHITECTURE.md) — Comprehensive data flow, execution modes, and component topology.
- [**Design System**](./docs/DESIGN_SYSTEM.md) — UI tokens, colors, radius, typography, and tactile component layouts.
- [**Play Upload Runbook**](./docs/PLAY_UPLOAD.md) — Steps for releasing Android builds (`.aab` / `.apk`) to Google Play.
- [**Setup Journey**](./docs/SETUP_JOURNEY.md) — Operational credentials, AdMob configuration, and third-party notes.
