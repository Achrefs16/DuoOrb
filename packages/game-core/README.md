# @duoorb/game-core

The authoritative ruleset, game state machines, move validation, pathfinding algorithms, and bot personalities for DuoOrb.

---

## 1. Core Mechanics & Game Modes

DuoOrb is a strategic grid-based board game where players move their orb across the board to reach the opponent's goal row while placing walls to obstruct the opponent.

- **`2p` (Classic 1v1):** Head-to-head 9×9 tactical match. Each player starts on opposite baselines with 10 walls. The first player to reach the opposing baseline wins.
- **`4p` / `center2` / `center3` (Center Rush):** Players navigate towards the central target zone.
- **`race2` / `race3` / `race4` (Race Modes):** High-tempo sprint to target perimeter nodes.

---

## 2. Package Architecture

```
packages/game-core/src/
├── ai/                      # AI search, evaluation, candidate ranking, and personality roster
│   ├── engine.ts            # MCTS and iterative deepening driver
│   ├── evaluation.ts        # Board state heuristic and progress evaluation
│   ├── personalities.ts     # 39 unique bot personalities with dialogue and styles
│   ├── tactics.ts           # Tactical pattern detector (WIN, BLOCK, ESCAPE)
│   └── zobrist.ts           # 64-bit Zobrist hashing for transposition caching
├── ai-structure.ts          # Wall field analysis, route profiling, and topology
├── ai-threat.ts             # Multi-ply wall sequence threat recognition
├── constants.ts             # Board dimensions, starting positions, wall limits
├── geometry.ts              # Coordinate transforms and distance utilities
├── movement.ts              # Legal move generation (steps, jumps, diagonals)
├── notation.ts              # Algebraic match notation encoder/decoder
├── pathfinding.ts           # BFS shortest paths and wall connectivity invariants
├── replay.ts                # Action history parser and game state reconstructor
├── ruleset.ts               # Move validation and game loop state transitions
├── types.ts                 # Core TypeScript interfaces (GameState, Action, Board)
└── walls.ts                 # Wall placement validation, overlap & crossing checks
```

---

## 3. The 39-Bot Personality Roster

Personalities differ in opening style, aggression, wall expenditure timing, and blunder rate across 4 skill tiers:
1. **Beginner (800–1100 Elo):** Martin, Pip, Elias, Barnaby, Finn, Clara, Leo, Milo.
2. **Intermediate (1200–1500 Elo):** Bram, Nelson, Vex, Tariq, Ren, Mateo, Zara, Boba.
3. **Master (1600–1900 Elo):** Jamal, Marcus, Archimedes, Fiona, Dmitri, Layla, Dante, Meiling, Amara, Gideon.
4. **Grandmaster (2000–2400 Elo):** Viktor, Achref, Sora, Samira, Torstein, Kofi, Diego, Hassan, Jin, Sterling, Kenzo, Valeria, Nexus-9.

---

## 4. Invariants & Rules

1. **Path Invariant:** A wall placement is **strictly illegal** if it completely traps any player or completely cuts off all valid paths to their goal.
2. **Jump Rules:** When two orbs are adjacent:
   - A straight jump over the opponent is legal if the space behind is open.
   - If blocked by a wall behind the opponent, diagonal jump steps become legal.

---

## 5. Development & Testing

```bash
# Build TypeScript distribution
npm run build --workspace=@duoorb/game-core

# Run test suite
npm run test --workspace=@duoorb/game-core
```
