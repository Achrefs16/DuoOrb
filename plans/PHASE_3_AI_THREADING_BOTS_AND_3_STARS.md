# Phase 3 Implementation Plan: AI Off-Main-Thread Execution, Clock Freeze Fix, 10 Distinct Bots, Non-Repeating Moves & 3-Star Bot Mastery

> **Phase:** 3 of 6  
> **Packages Affected:** `@duoorb/game-core` (`packages/game-core`), `@duoorb/analyzer-rust` (`packages/analyzer-rust`), `@duoorb/mobile` (`apps/mobile`)  
> **Dependencies:** Phase 1 (uses `undosUsedRef` for 3-Star mastery check) & Phase 2 (shares Rust MCTS improvements)  
> **Goal:**
> 1. Eliminate UI lag and clock freezing when the AI thinks by moving AI search to a Web Worker / Rust native engine + `<4.5ms` frame-budgeted micro-slicing and switching the match clock to real `Date.now()` deltas.
> 2. Fix why all bots thought the same way (`shouldSprint` override bug in `mcts.ts:284`) and why even the same bot repeated identical moves every match (`positionSeed` + deterministic `argmax`).
> 3. Widen the Bot Difficulty Gap (so Easy/Beginner bots genuinely feel easy while Top bots play at Grandmaster strength with PUCT + `selfCost` pruning), expand the roster to **10 distinct bots**, and add a **3-Star Victory Rating System (`⭐⭐⭐`)**.

---

## 1. Root-Cause Summary

1. **Why AI Freezes the UI (`packages/game-core/src/mcts.ts:605-614`):**
   - `mctsBestActionAsync` runs `CHUNK_SIZE = 150` simulations synchronously on the main JS thread before yielding. 150 simulations $\times$ 14 rollout plies = 2,100 rollout plies and ~15,000 BFS calls per synchronous chunk, blocking the JS thread for 150ms–400ms at a time.
2. **Why the Clock Stops During AI Turns (`apps/mobile/src/screens/GameScreen.tsx:769-786`):**
   - `setInterval(..., 1000)` subtracts `- 1` tick on the main JS thread. When JS is blocked or when an AI turn completes in `< 1000ms` between ticks, the AI loses `0s` and the human loses `1s`.
3. **Why All Bots Think the Same & Repeat the Exact Same Moves (`mcts.ts:284-288, 534-556` & `engine.ts:325`):**
   - In `mcts.ts:284`: `const isLeadingRace = myDist <= minFoeDist` sets `shouldSprint = true` whenever the bot is tied or ahead in distance (which is true on **>50% of all turns**, including Turn 1!).
   - When `shouldSprint` is true, `wallProb` is forced to `0.05` (ignoring `profile.wallMoveProb`) and `finalize()` (`lines 534-556`) overrides wall moves to force a straight pawn step down column 4!
   - Furthermore, `engine.ts:325` passes a deterministic `positionSeed(state)` and `mcts.ts:528` picks `argmax(visits)` in fixed `UP/DOWN` order, so every bot plays the **exact same moves in every game**!
4. **Why Easy Bots Are Too Hard (`engine.ts:323-332` & `mcts.ts:163, 322, 410`):**
   - `profile.randomness` is never passed to MCTS, and even 800-ELO Martin deterministically executes mandatory 1-step goal blocks and pre-filtered optimal wall blocks.

---

## 2. Step-by-Step File Modifications

### Step 3.1 — Fix the Game Clock to Use Real Wall-Clock Deltas (`GameScreen.tsx`)
**File:** [`apps/mobile/src/screens/GameScreen.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/GameScreen.tsx#L760-L844)

1. **Replace the naive `- 1` `setInterval(1000)` (`lines 760-786`):**
   - Track exact remaining milliseconds per player in `remainingMsRef = useRef<Record<string, number>>({})` and `lastClockTickAtRef = useRef<number>(Date.now())`.
   - When `timers` are initialized or incremented after a move, sync `remainingMsRef.current[playerId] = seconds * 1000`.
   - Run a `200ms` interval while `state.status === 'IN_PROGRESS'` and `type !== 'online'` and `hasTimer`:
     ```ts
     const now = Date.now();
     const deltaMs = Math.max(0, now - lastClockTickAtRef.current);
     lastClockTickAtRef.current = now;
     const activeId = stateRef.current.players[stateRef.current.currentPlayerIndex]?.id;
     if (!activeId) return;
     const prevMs = remainingMsRef.current[activeId] ?? (timersRef.current[activeId] ?? 0) * 1000;
     const nextMs = Math.max(0, prevMs - deltaMs);
     remainingMsRef.current[activeId] = nextMs;
     const nextSec = Math.ceil(nextMs / 1000);
     ```
   - Also deduct elapsed `Date.now() - lastClockTickAtRef.current` whenever a player (human or AI) completes their turn before switching `currentPlayerIndex`!
2. **Fix `isBlitzMatch` (`lines 813-816`):**
   - Change `timeControl.minutes <= 3` to `timeControl.minutes < 3` so standard `3+0` games don't clamp Master bots (`Viktor`, `Achref`) down to a `250ms` budget.

---

### Step 3.2 — Off-Main-Thread AI Execution (Web Worker + Rust + `<4.5ms` Frame-Budgeted Slicing)
**Files:**
- [`packages/game-core/src/mcts.ts`](file:///c:/Users/achra/Documents/DuoOrb/packages/game-core/src/mcts.ts#L597-L616)
- `apps/mobile/src/ai/aiWorkerClient.ts` (NEW)
- [`apps/mobile/src/screens/GameScreen.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/GameScreen.tsx#L817)

1. **Frame-Budgeted Micro-Slicing in `packages/game-core/src/mcts.ts` (`lines 597-616`):**
   - Defer `expand(root)` to the first simulation step so `createMctsSession` is $O(1)$ (`< 0.1ms`).
   - Replace `const CHUNK_SIZE = 150;` with a `4.5ms` frame budget:
     ```ts
     const MAX_SLICE_MS = 4.5;
     let i = 0;
     while (i < session.simulations) {
       if (hooks.shouldCancel?.()) break;
       if (opts.timeBudgetMs !== undefined && Date.now() - start >= opts.timeBudgetMs) break;
       const sliceStart = typeof performance !== 'undefined' ? performance.now() : Date.now();
       do {
         session.stepSimulation();
         i++;
       } while (
         i < session.simulations &&
         ((typeof performance !== 'undefined' ? performance.now() : Date.now()) - sliceStart) < MAX_SLICE_MS
       );
       if (i < session.simulations) {
         await new Promise((r) => setTimeout(r, 0));
       }
     }
     ```
   - Because each slice takes at most `4.5ms` out of a `16.6ms` 60-FPS frame, the React Native UI, animations, and clock timer remain 100% responsive even on budget Android phones!
2. **Web Worker Offloading for Web/PWA (`apps/mobile/src/ai/aiWorkerClient.ts`):**
   - When `Platform.OS === 'web'` and `typeof Worker !== 'undefined'`, execute AI move search inside a background Web Worker, falling back seamlessly to `getBestActionAsync` if Worker creation is blocked by CSP.

---

### Step 3.3 — Overhaul `mcts.ts` & `engine.ts` for Playstyle Archetypes, Non-Repeating Variety & True Skill Gap
**Files:**
- [`packages/game-core/src/ai/types.ts`](file:///c:/Users/achra/Documents/DuoOrb/packages/game-core/src/ai/types.ts)
- [`packages/game-core/src/ai/engine.ts`](file:///c:/Users/achra/Documents/DuoOrb/packages/game-core/src/ai/engine.ts)
- [`packages/game-core/src/mcts.ts`](file:///c:/Users/achra/Documents/DuoOrb/packages/game-core/src/mcts.ts)

1. **Extend `AIProfile` (`types.ts`) and `MctsOptions` (`mcts.ts`):**
   ```ts
   export type BotWallStyle =
     | 'balanced'
     | 'horizontal_barricade'
     | 'vertical_corridor'
     | 'defensive_backwall'
     | 'flank_trap'
     | 'minimal';

   export type BotOpeningStyle =
     | 'center_march'
     | 'wing_drift'
     | 'early_fence'
     | 'back_gate'
     | 'mixed';

   // New fields on AIProfile & MctsOptions:
   blunderRate?: number;      // 0.0 (Master) to 0.40 (Martin)
   missDefenseProb?: number;  // 0.0 (Intermediate+) to 0.45 (Martin)
   naiveWallProb?: number;    // 0.0 (Normal+) to 0.45 (Martin)
   softmaxTemp?: number;      // Root move sampling temperature for variety (default 0.18)
   varietyWindow?: number;    // Max Q-drop allowed when sampling varied moves (e.g. 0.025 for Masters, 0.12 for Beginners)
   wallStyle?: BotWallStyle;
   openingStyle?: BotOpeningStyle;
   ```

2. **Fix `shouldSprint` Override (`mcts.ts:284-288, 534-556`):**
   - Change `isLeadingRace`:
     ```ts
     const allFoesHaveNoWalls = state.players.every(
       (p) => p.id === rootMover.id || p.status !== 'ACTIVE' || p.wallsRemaining === 0
     );
     const shouldSprint = (allFoesHaveNoWalls && myDist <= minFoeDist) && !hasCriticalFoe;
     ```
   - Now bots with walls actually use their `wallMoveProb`, `wallStyle`, and `openingStyle` instead of being forced into `wallProb = 0.05` on every turn!

3. **Fix Deterministic Move Repetition (`engine.ts:325` & `mcts.ts:527-578`):**
   - In `getBestActionAsync` (`engine.ts:325`):
     - Only use deterministic `positionSeed` when `randomSeed !== undefined` (unit tests). In live gameplay (`randomSeed === undefined`), always use a fresh entropy seed `(Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0`!
   - In `mcts.ts` (`expand` & `finalize`):
     - **Opening Style Bias (Moves 1–6):**
       - `'wing_drift'`: boosts prior/selection for stepping diagonally/laterally to columns `2, 3, 5, 6` or advancing along a wing file instead of column `4`.
       - `'early_fence'`: on ply 2–6, boosts probability of placing an opening wall by `+0.25`.
       - `'back_gate'`: on ply 2–5, considers placing a defensive horizontal back-wall 1–2 rows behind own pawn to control jump parity.
       - `'mixed'`: randomly picks one of the opening styles per match based on `state.gameId` hash!
     - **Wall Style Geometry Bias (`probableWalls`):**
       - `'horizontal_barricade'`: prioritizes `Orientation === 'H'` walls (`1.5x` weight).
       - `'vertical_corridor'`: prioritizes `Orientation === 'V'` corridor walls (`1.5x` weight) alongside the opponent's column.
       - `'defensive_backwall'`: includes defensive walls that block opponent's future cross-grooves along the bot's own route.
       - `'flank_trap'`: prioritizes walls that seal side edges (`col <= 2` or `col >= 5`) and increase opponent detour by $\ge 2$ steps.
     - **Root Softmax Variety (`finalize` at `mcts.ts:527`):**
       - Sort root children by adversarial win rate $Q$ (with visit stabilization).
       - If `rng() < (opts.blunderRate ?? 0)` (for Beginner/Easy bots), pick a sub-optimal legal move (2nd/3rd pawn move or a naive wall).
       - Otherwise, collect all root candidates whose $Q \ge Q_{\text{best}} - \text{varietyWindow}$ (where `varietyWindow` is `0.025` for Masters, `0.05` for Intermediate, `0.10` for Beginners) and sample among them using `softmaxTemp`!
       - **Result:** Even `Achref`, `Viktor`, and `Marcus` will choose dynamically between equally strong pawn advances, wing routes, and wall traps so no two games ever play out identically!

4. **PUCT Heuristic Priors + `selfCost` Pruning + Trap/Repetition Guard (`mcts.ts`):**
   - In `findPathBlockingWalls`: compute `netGain = (oppAfter - oppBase) - (myAfter - myBase)`. Reject walls with `netGain <= 0` (unless `rng() < naiveWallProb` for Beginner bots, or `oppBase === 1 && oppAfter > 1`).
   - Penalize root pawn moves that trigger `jumpTrapPenalty` or `repetitionPenalty` (`evaluation.ts:185, 230`) so Master bots never repeat moves or step into a 1-wall trap.

---

### Step 3.4 — Expand `BOT_ROSTER` to 10 Distinct Personalities (`personalities.ts`)
**File:** [`packages/game-core/src/ai/personalities.ts`](file:///c:/Users/achra/Documents/DuoOrb/packages/game-core/src/ai/personalities.ts)

Update `BOT_ROSTER` with **10 bots** (all free, `premium: false`), each with unique `wallStyle`, `openingStyle`, `blunderRate`, `missDefenseProb`, `naiveWallProb`, `softmaxTemp`, `varietyWindow`, and rich dialogue:
1. **`martin` (800, Beginner)** — *The Friendly Dad* (`simulations: 40`, `blunderRate: 0.40`, `missDefenseProb: 0.45`, `naiveWallProb: 0.45`, `wallMoveProb: 0.15`, `openingStyle: 'mixed'`)
2. **`pip` (950, Beginner — NEW)** — *The Curious Sprinter* (`simulations: 90`, `blunderRate: 0.28`, `missDefenseProb: 0.30`, `wallMoveProb: 0.08`, `wallStyle: 'minimal'`, `openingStyle: 'wing_drift'`)
3. **`elena` (1100, Beginner)** — *The Eager Student* (`simulations: 200`, `blunderRate: 0.18`, `missDefenseProb: 0.18`, `wallMoveProb: 0.38`, `openingStyle: 'early_fence'`)
4. **`bram` (1300, Intermediate — NEW)** — *The Bricklayer* (`simulations: 500`, `blunderRate: 0.10`, `missDefenseProb: 0.05`, `wallMoveProb: 0.58`, `wallStyle: 'horizontal_barricade'`, `openingStyle: 'early_fence'`)
5. **`nelson` (1450, Intermediate)** — *The Aggressive Challenger* (`simulations: 1000`, `blunderRate: 0.06`, `wallMoveProb: 0.45`, `blockMoveProb: 0.75`, `openingStyle: 'center_march'`)
6. **`vex` (1550, Intermediate — NEW)** — *The Maze Trickster* (`simulations: 1400`, `blunderRate: 0.04`, `wallMoveProb: 0.42`, `wallStyle: 'vertical_corridor'`, `openingStyle: 'wing_drift'`, `softmaxTemp: 0.35`, `varietyWindow: 0.06`)
7. **`sofia` (1650, Intermediate)** — *The Calm Competitor* (`simulations: 2200`, `blunderRate: 0.02`, `wallMoveProb: 0.25`, `wallStyle: 'defensive_backwall'`, `openingStyle: 'back_gate'`)
8. **`marcus` (1900, Master)** — *The Seasoned Master* (`simulations: 6000`, `blunderRate: 0.0`, `wallMoveProb: 0.35`, `wallStyle: 'flank_trap'`, `openingStyle: 'mixed'`, `varietyWindow: 0.03`)
9. **`viktor` (2100, Master)** — *The Master Analyst* (`simulations: 12000`, `blunderRate: 0.0`, `wallMoveProb: 0.32`, `wallStyle: 'balanced'`, `openingStyle: 'mixed'`, `varietyWindow: 0.02`)
10. **`achref` (2400, Master)** — *The System Architect* (`simulations: 20000`, `blunderRate: 0.0`, `wallMoveProb: 0.35`, `wallStyle: 'balanced'`, `openingStyle: 'mixed'`, `varietyWindow: 0.015`, `wallHorizon: 12`)

Also update `AI_PROFILES` in [`packages/game-core/src/ai/constants.ts`](file:///c:/Users/achra/Documents/DuoOrb/packages/game-core/src/ai/constants.ts) so generic `easy`, `normal`, and `hard` reflect the widened gap (`easy`: `simulations: 80, blunderRate: 0.28, missDefenseProb: 0.30, naiveWallProb: 0.35`).

---

### Step 3.5 — Implement the 3-Star Bot Mastery System (`⭐⭐⭐`)
**Files:**
- [`apps/mobile/src/storage/gameStorage.ts`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/storage/gameStorage.ts)
- [`apps/mobile/src/screens/GameScreen.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/GameScreen.tsx)
- [`apps/mobile/src/screens/MatchSetupScreen.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/screens/MatchSetupScreen.tsx)
- [`apps/mobile/src/components/GameOverModal.tsx`](file:///c:/Users/achra/Documents/DuoOrb/apps/mobile/src/components/GameOverModal.tsx)

1. **Storage API in `gameStorage.ts`:**
   ```ts
   export interface BotStarRecord {
     botKey: string;
     stars: 0 | 1 | 2 | 3;
     wins: number;
     bestMarginSteps: number;
     updatedAt: string;
   }
   export async function loadBotStars(): Promise<Record<string, BotStarRecord>>;
   export async function recordBotVictoryStars(botKey: string, stars: 1 | 2 | 3, marginSteps: number): Promise<BotStarRecord>;
   ```
2. **Star Calculation Formula (`computeBotStars` in `GameScreen.tsx` when `type === 'ai'` and `userWon === true`):**
   - Compute `oppDist = getShortestDistance(aiPlayer.position, aiPlayer.goalDirection, state.walls, state.mode)`.
   - Compute `myWalls = humanPlayer.wallsRemaining`.
   - Compute `undosUsed = undosUsedRef.current`.
   - **Star Rules:**
     - **1 Star (`★☆☆`):** Won the match (`userWon === true`).
     - **2 Stars (`★★☆`):** Won with **0 Undos used** (`undosUsed === 0`) AND (`oppDist >= 2` OR `myWalls >= 2`).
     - **3 Stars (`★★★`):** Won with **0 Undos used** (`undosUsed === 0`) AND (`oppDist >= 3` OR (`oppDist >= 2` && `myWalls >= 3`)).
3. **UI in `MatchSetupScreen.tsx` (`lines 285-350`):**
   - Load `botStars` on mount via `loadBotStars()`.
   - Show a total mastery counter pill next to the Bot section header (`★ 14 / 30`).
   - On each bot card in the grid/list, render 3 star icons (`MaterialCommunityIcons name={i <= stars ? 'star' : 'star-outline'} size={13} color={i <= stars ? '#D9A62E' : THEME.colors.outlineVariant}`).
4. **UI in `GameOverModal.tsx`:**
   - Pass `botStarsEarned?: 1 | 2 | 3 | null` and `botStarHint?: string | null` from `GameScreen.tsx` to `GameOverModal`.
   - When `botStarsEarned` is present, render a prominent **3-Star Mastery Banner** (`★★★`) with gold stars under the Victory title and a subtle tip if `< 3` stars (e.g. *"Win by 3+ steps with 0 Undos for 3 Stars!"*).

---

## 3. Verification Checklist for Phase 3
- [ ] Run `npm test -w @duoorb/game-core` — verify all 15 test suites pass, plus add tests verifying:
  - Playing 5 games against the same bot from the initial board produces **at least 3 different move sequences** (non-repeating variety).
  - `Martin (800)` / `Easy` makes human-like mistakes and loses to basic shortest-path play, while `Viktor (2100)` / `Achref (2400)` beats `Normal` >90% of the time.
- [ ] Run `npm test -w mobile` and `tsc --noEmit` — 0 errors.
