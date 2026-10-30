# DuoOrb AI Engine Audit & Improvement Report

> **Status:** Draft for owner review — 2026-10-28  
> **Scope:** current Classic 1v1 AI, bot roster, hints, and full-game analysis.  
> **No production code changed.** This report is diagnostic and advisory.  
> **Evidence labels:** **Verified** = read in code; **Measured** = benchmark/match data; **Inferred** = likely cause, needs a controlled test.

---

## 0. One-page answer

The current AI is **not sim-starved**. It is **architecture-starved**.

Adding simulations does not change the move because the engine is not using those simulations to discover new information:

1. **The 8-thread search runs 8 identical deterministic trees.** Each worker gets `simulations / 8`, and every worker explores the same tree in the same order. The result is effectively one tree at 1/8 the requested sims, computed 8 times. `50,000` hard-bot sims is really about **6,250** effective sims; `100,000` hint sims is about **12,500**. This is the biggest single bug.
2. **18 of the 39 bots bypass their personality.** Every bot with `difficulty: 'hard'` is routed to the same native 50k search. Its weights, blunder rate, wall style, opening style, and sim budget are ignored. The 39-bot roster is really about 21 distinct JS profiles plus one native “hard” profile.
3. **The evaluation is shallow.** The native 2P leaf value is essentially `sigmoid((opponent_distance - my_distance + tempo + 1.35 * wall_count) / 3.2)`. It has no wall quality, corridor width, threat, tempo structure, or strategic wall equity. More sims only average the same weak opinion more precisely.
4. **Candidate generation is hard-pruned.** Native search drops any wall that does not immediately delay an opponent. JS search considers at most 2/5/8 root walls and only 2 “inner plan” walls at deeper nodes. If the best move is not in the candidate set, no amount of search can find it.
5. **Analysis is a separate, expensive engine path.** It runs 6,000 sims on every ply, including forced moves, with deterministic seeds and up to 1,500 extra “depth equalization” sims. A 70-ply review is not a quick pass plus key moments; it is a full search of every move.

**Bottom line:** fix effective parallelism, budget routing, personality routing, candidate recall, evaluation, and analysis design before adding more simulations or replacing the engine. More sims are the wrong lever until the search is actually using them.

---

## 1. What the AI actually is

There are **two engines**, not one:

| Path | Engine | Search | Evaluation | Personality |
|---|---|---|---|---|
| Easy / normal bots | JavaScript (`game-core`) | MCTS with rollouts, 35–1,400 sims | Rich handcrafted weights | Yes: weights, blunder, miss-defense, style |
| Hard bots (18 of 39) | Native Rust (`analyzer-rust`) | PUCT + heuristic leaf, 50,000 sims, 8 threads | Shortest path + wall count + tempo | **No** — profile is discarded |
| Hints | Native Rust, or JS on web | Native 100,000 sims / 8 threads; JS 15,000 | Same native heuristic | **No** — `oracleHintProfile` is ignored on native |
| Full-game analysis | Native Rust (`run_mcts_analysis`) | 6,000 sims per ply, 3,000–10,000 clamp | Same native heuristic | N/A |
| Variants (3P/4P/Race/Center) | Same paths | Same native/JS split | Native N-player softmax; JS variant tuning | Partly, but hard bots still lose profile |

### 1.1 Bot roster reality

**Verified:** `packages/game-core/src/ai/personalities.ts` defines **39 bots**:

- 9 beginner
- 13 intermediate
- 10 master
- 7 grandmaster

Difficulty split:

- 8 `easy`
- 13 `normal`
- **18 `hard`**

All 18 `hard` bots route to the native 50k path in `apps/mobile/src/ai/aiWorkerClient.ts:158-169`. The native call receives only `state`, `simulations`, and `threads`; it receives **no profile**. Therefore:

- Jamal, Marcus, Viktor, Achref, Gideon, Sora, Samira, Torstein, Kofi, Captain Diego, Hassan, Master Jin, Sterling, Sensei Kenzo, Dr. Valeria Vance, NEXUS-9, Boba, and Milo do **not** play with their configured weights.
- Their `simulations`, `blunderRate`, `missDefenseProb`, `wallStyle`, `openingStyle`, and `varietyWindow` are ignored on native.
- Master and grandmaster bots are the same engine with the same 50k budget. Their names, dialogue, and avatars differ; their moves do not.
- On web, the same hard bots use the JS engine with their profiles and 3,000-ish sims. The same bot is **stronger or weaker depending on platform**, and plays differently.

This is both an AI problem and a product-truth problem: the roster promises 39 personalities, but 18 of them share one brain.

### 1.2 Budget chaos

The same bot can run a different number of simulations depending on the code path:

| Layer | Easy | Normal | Hard |
|---|---:|---:|---:|
| `AI_PROFILES` (`constants.ts`) | 60 | 260 | 400 |
| `getBestAction` sync default (`engine.ts:185`) | 60 | 500 | 2,000 |
| `getBestActionAsync` default (`engine.ts:335`) | 60 | 600 | 2,500 |
| Personality overrides | 35–150 | 200–1,400 | 2,200–3,500 |
| Native mobile path | — | — | **50,000** |
| Native hint path | — | — | **100,000** |
| Analysis | — | — | **6,000 per ply** |

There is no single source of truth for “how much search does this bot get?” The answer depends on platform, sync vs async, native availability, and whether the call is a bot, a hint, or analysis. This makes tuning and benchmarking almost impossible.

The time budgets are equally fragmented:

- `AI_PROFILES`: 50 / 150 / 350 ms
- `productionBudget`: 60 / 130 / 240 ms
- Native path: **no deadline at all**
- Hint profile: 2,500 ms, but native ignores it
- Analysis client timeout: 12,000 ms
- Web worker timeout: 12,000 ms

**Verified:** `productionBudget` in `engine.ts:47-59` does not use `profile.timeBudgetMs`; the native call does not use either.

---

## 2. Measured evidence

### 2.1 256k vs 440k simulations

A Classic 1v1 match against SigmaQuoridor produced:

| Run | DuoOrb sims | DuoOrb avg | DuoOrb max | Moves over 1.5s | Result |
|---|---:|---:|---:|---:|---|
| 256k | 256,000 | 471 ms | 1,049 ms | 0 | Sigma won in 44 plies |
| 440k | 440,000 | 736 ms | 1,721 ms | 6 | Sigma won the same 44-ply line |

**DuoOrb made the identical moves at 256k and 440k.** The only change was higher latency and six over-budget moves.

Effective per-worker sims:

- 256,000 / 8 = **32,000**
- 440,000 / 8 = **55,000**

But because all 8 workers are identical, the effective search is one tree at 32k or 55k, not 256k or 440k. The 32k tree was already stable on this line; 55k refined the same ranking and did not change the top move.

### 2.2 What this does and does not prove

- **Verified:** the two runs produced identical DuoOrb moves.
- **Verified:** 440k broke the 1.5s cap on six moves.
- **Inferred:** the move was stable because of effective-sim saturation, deterministic search, fixed candidates, and shallow evaluation — not because 440k is “too few” sims.
- **Not proven:** that 256k is optimal, or that the engine cannot improve with more sims after the architecture is fixed. One match is anecdotal; a 50-game test is required.

---

## 3. Root causes

### 3.1 P0 — “8 threads” is 8 duplicate trees, not parallel search

**Evidence:** `packages/analyzer-rust/src/mcts.rs:982-1114`.

```rust
let thread_count = threads.max(1).min(16);
let sims_per_thread = (simulations / thread_count).max(200);

let run_worker = |_t_idx: usize, _s: u64| -> Vec<(GameAction, u32, f64)> {
    // ...
    for _ in 0..sims_per_thread {
        // deterministic PUCT, no PRNG, no seed
    }
};

let results: Vec<Vec<(GameAction, u32, f64)>> = if thread_count > 1 {
    (0..thread_count)
        .into_par_iter()
        .map(|t_idx| {
            let s = seed.wrapping_add((t_idx as u64).wrapping_mul(0x9E3779B97F4A7C15));
            run_worker(t_idx, s)
        })
        .collect()
}
```

The worker signature accepts `_t_idx` and `_s`, but **neither is used**. The tree has no random tie-break, no Dirichlet noise, and no worker-specific priors. All 8 workers start from the same state, same candidate list, same priors, and run the same deterministic PUCT loop for `sims_per_thread` iterations.

Consequences:

- **Effective sims = requested / threads.** 50k → 6.25k; 100k → 12.5k; 256k → 32k; 440k → 55k.
- **CPU cost = requested.** You pay 8x for one tree’s worth of information.
- **Memory = 8 trees.** At 440k, that is 8 x 55k nodes, plus candidate vectors, which is dangerous on a phone.
- **The hint oracle is not an oracle.** 100k native is effectively 12.5k. It is not 8x stronger than a 12.5k search.
- **More sims can look like “no change”** because the search is already saturating the same deterministic tree.

This is the #1 reason the current AI is not improving with sim count. Fix this before any evaluation tuning.

**What real root parallelization would look like:**

- Option A: one shared tree with atomic/thread-local statistics and virtual loss. All threads expand the same tree.
- Option B: independent trees with genuinely different seeds/priors, then aggregate visits/Q. This requires actual randomness in selection/expansion and worker-specific exploration.
- Option C: single-threaded tree + parallel leaf evaluation. Simpler, but less scalable.

Acceptance test: 8 threads must produce a **different and stronger** result than 1 thread at the same total sims, or the same result at ~1/8 the CPU. If 1-thread and 8-thread results are identical, the parallelism is fake.

### 3.2 P0 — Hard bots discard their personalities

**Evidence:** `apps/mobile/src/ai/aiWorkerClient.ts:158-169`.

```ts
const isHint = Boolean(options.isHint);
const isHard = profile.difficulty === 'hard';

if (isHint || isHard) {
  const nativeSims = isHint ? 100000 : 50000;
  const threads = 8;
  const nativeAction = await getBestActionNative(state, nativeSims, threads);
  if (nativeAction) return nativeAction;
}
```

The native function has no profile argument. It cannot see:

- `profile.weights`
- `profile.blunderRate`
- `profile.missDefenseProb`
- `profile.wallStyle`
- `profile.openingStyle`
- `profile.varietyWindow`
- `profile.simulations`
- `profile.uctConst`
- `profile.wallMoveProb`

So all 18 hard bots are the same player. The master/grandmaster ladder is cosmetic. The “personality” is only dialogue.

**Fix options:**

1. Pass a compact profile/budget struct into Rust and use it for sims, temperature, blunder, and style.
2. Keep native search but return top-k root actions with Q/visits, then let the JS personality layer choose among them (temperature, style, blunder). This preserves strength and personality.
3. Until native supports profiles, route hard bots through the profile-aware JS engine. They will be weaker, but they will be distinct.

Option 2 is the least invasive and preserves the native strength gain.

### 3.3 P0/P1 — Evaluation ceiling: more sims optimize a weak proxy

**Evidence:** `packages/analyzer-rust/src/mcts.rs:340-457`.

The native 2P leaf evaluation is:

```text
turn_bonus = +0.5 if player 0 to move, else -0.5
wall_bonus = (walls0 - walls1) * 1.35
lead = (d1 - d0) + turn_bonus + wall_bonus
p0_win = sigmoid(lead / 3.2)
```

That is the whole 2P evaluation. It has:

- No wall quality (a wall that creates a corridor trap vs a decorative wall).
- No corridor width / exit count / fork count.
- No threat detection beyond the tactical guard.
- No distinction between a wall that delays 1 step and one that forces a 6-step detour.
- No endgame exactness.
- No learned value or policy.

The JS evaluation is richer (`packages/game-core/src/ai/evaluation.ts:105-179`), but it is still handcrafted and uses profile-specific weights. The native engine and the JS engine therefore have **different opinions of the same position**. Tuning one does not improve the other.

More sims cannot add missing features. It can only average the same heuristic over more nodes. This is why a 44-ply loss can happen even with a large search: the engine can be **confidently wrong** about the position.

**Additional inconsistency:** `packages/game-core/src/ai/search.ts:65-73` uses a fixed hardcoded “hard” profile for terminal scoring, regardless of the actual bot profile. Terminal decisions are therefore scored with a different evaluation than the rest of the search.

**Fix direction:**

- Short term: add wall quality, corridor width, threat, and tempo features to the native eval; calibrate against game outcomes.
- Medium term: learned value/policy (Sigma-style ONNX or a DuoOrb-trained model).
- Always: one evaluation contract shared by bots, hints, and analysis.

### 3.4 P0 — Candidate pruning can exclude the best move

**Native (`mcts.rs:60-337`):**

The doc comment says “retain 100% of corridor-narrowing setup walls,” but the code has a stricter rule:

```rust
// Rule B: Candidate walls must actually delay an active opponent!
if max_opp_delta <= 0 {
    continue;
}
```

So a wall that creates a future trap but does not immediately delay an opponent is **dropped**, even if it is strategically strong. Other filters:

- Wall must touch an opponent corridor, be near an existing wall (within 1), or be near a pawn (within 2).
- `net_gain < 0` is dropped.
- Opening walls with `walls <= 2`, mover distance >= 6, and `max_opp_delta <= 2` are dropped.
- Backward pawn moves are dropped unless boxed in or adjacent to an opponent.

**JS (`packages/game-core/src/ai/candidates.ts`):**

- `maxCandidateWalls` is 2 / 5 / 8 for easy / normal / hard.
- `probeCap = maxCandidateWalls * 6`; at most 12 / 30 / 48 walls are probed.
- After probing, only 2 / 5 / 8 walls are kept.
- At deeper search nodes, `buildSearchCandidates` adds only **moves + up to 2 inner-plan walls**. At depth 1 it adds no walls at all.
- In non-volatile positions, `innerPlanWalls` returns nothing, so the search assumes the opponent will only move pawns and will not place walls.

This is a massive search blind spot. The root may see 8 walls, but the opponent’s wall replies are mostly absent. The search can therefore walk into a wall trap it never considered.

**Fix direction:**

- Measure candidate recall: for 100 positions, compare the candidate set against all legal walls and a deep exhaustive search. Target >= 99% recall of the best move.
- At root, include all legal walls for low/medium sims; prune only with a learned prior, not a hard rule.
- At deeper nodes, include a representative set of opponent walls, not only 2 inner-plan walls.
- Add setup-wall candidates that narrow corridors even when immediate delay is 0.

### 3.5 P1 — Search policy, backup, and final selection

The native engine is PUCT with heuristic leaf values, not full MCTS with rollouts. That is a valid design, but the current implementation has limits:

- **No tree reuse** between moves.
- **No transposition table** in native MCTS.
- **No opening book.**
- **No exact endgame solver.** The JS engine has a no-wall race shortcut; native does not have a general solver.
- **Final move is chosen by visit count**, not by Q, LCB, or a risk-adjusted score. A move can win the visit race while having a lower Q.
- **Deterministic tie-breaking** and no Dirichlet noise; the same position produces the same move.
- **Tactical guards are hardcoded patches** (`evaluate_pawn_step_danger`, threshold 4; refutation scan; forward-progress guarantee). They help, but they are not a substitute for search.

The result is a search that is strong at “find a reasonable move” but weak at “prove the best move” and weak at variety.

### 3.6 P0/P1 — Analysis is not designed for full games

**Evidence:** `packages/analyzer-rust/src/review.rs:112-127`.

- Every ply gets `DEFAULT_SIMS_PER_PLY = 6,000` (`mcts.rs:482-484`), clamped 3,000–10,000.
- The comment says “35,000 simulations per ply,” but the constant is 6,000. Stale comment; misleading.
- `forced` is computed, but the search still runs for forced moves. It only affects classification.
- If the played move is not the engine best, “depth equalization” adds up to **1,500** extra sims (`mcts.rs:645-653`). So the real budget is 6,000–7,500 per ply, not fixed.
- `run_mcts_analysis` takes a seed but ignores it (`_seed`), so analysis is deterministic.
- Plies are parallelized with Rayon. On a 2-vCPU server, 70 plies compete for 2 cores; on a phone, it is worse.
- The client times out at 12s, but the server keeps computing. Retries start new reviews.

For a 70-ply game, this is the wrong shape. A review should be:

1. **Fast pass:** 20–50 sims/ply, skip forced moves, classify obvious positions cheaply.
2. **Deep pass:** 300–800 sims only on 5–10 key moments (blunders, lead swings, tactical walls).
3. **Cache:** by game ID and position hash.
4. **Async queue:** return a job ID, not a 12s HTTP hold.

**Measured context:** 40 plies = 3.35s/1 thread, 1.78s/2 threads on the dev machine; 60 plies = 5.10s/1 thread, 2.72s/2 threads. On t4g.small with 0.4 vCPU sustained, 70 plies is far beyond a 12s interactive budget. The current design is both slow and capacity-expensive.

### 3.7 P1 — Platform and mode divergence

The same bot behaves differently depending on where it runs:

| Context | Hard bot behavior |
|---|---|
| Android/iOS native | Rust 50k, 8 threads, no profile, deterministic |
| Web | JS MCTS, ~3,000 sims, profile weights, live seed |
| Native unavailable/error | JS fallback, profile weights |
| Hint on native | Rust 100k, profile ignored |
| Hint on web | JS 15k, profile used |
| Analysis | Rust 6k/ply, separate search |

This means:

- A bug fix in JS does not improve native hard bots.
- A native tuning change does not improve web or easy/normal bots.
- Hint quality changes by platform.
- Analysis quality is not the same as bot quality.

A single engine core with explicit profiles and model tiers would remove this fragmentation. Until then, every benchmark must state platform, path, profile, sims, and threads.

### 3.8 P0 — Time budget and device performance

- Native search has **no deadline**. `get_best_action_sync` takes sims/threads/seed, but no time cap.
- 440k took 1,721 ms max and six moves over 1.5s on the dev machine. A phone will be slower.
- 8 threads on a phone can cause thermal throttling, battery drain, and contention with the UI/network.
- The web worker has a 12s timeout; native has no equivalent. A stuck native search can hang the turn.
- `threads = 8` is hardcoded regardless of device core count.
- The hint fallback is a naive shortest-path move if native throws; hint quality collapses exactly when the user needs it.

**Fix direction:**

- Deadline-based search: stop at `min(timeBudget, hardCap)`, return best-so-far.
- Adaptive threads: `min(4, hardwareConcurrency - 1)` or device-tier profile.
- Per-device p50/p95/max benchmarks; no move above 1.5s on mid-range Android.
- Separate hint budget from bot budget; hints can use more time only if the UI shows progress and can cancel.

### 3.9 P1 — Measurement gaps

Current evidence is not enough to tune safely:

- One 44-ply match is anecdotal.
- No Elo calibration per bot or per tier.
- No candidate-recall test.
- No 1-thread vs 8-thread equivalence/strength test.
- No per-device latency/thermal data.
- No move-distribution test to prove 39 bots are distinct.
- No regression suite for analysis quality.

Without these, “more sims,” “new weights,” and “Sigma” are all guesses.

---

## 4. Why adding simulations does not change anything

The chain is mechanical:

1. **Requested sims are divided by 8.** 50k → 6.25k effective; 100k → 12.5k; 256k → 32k; 440k → 55k.
2. **All 8 workers are identical.** No seed, no noise, no worker-specific priors. Aggregating them adds no information.
3. **The search is deterministic.** Native uses `position_seed`; `run_mcts_analysis` ignores its seed; hard bots have `randomness: 0`. The same position gives the same move.
4. **The candidate set is fixed.** If the best move is pruned, more sims cannot find it.
5. **The evaluation is a smooth heuristic.** Extra sims refine the same ranking; they do not add wall quality, threats, or endgame knowledge.
6. **Final selection is by visits.** Once a move dominates the visit count, more sims reinforce it.
7. **Time budget is not enforced.** At 440k, the engine spends more time but does not change the decision; it only misses the latency target.

### What more sims can fix

- Reduce variance in close positions.
- Refine Q estimates inside the existing candidate set.
- Find deeper tactical lines that are already represented by the candidates.
- Improve move choice when the top two moves are genuinely close.

### What more sims cannot fix

- A best move that was pruned.
- A missing evaluation feature.
- 8 duplicate workers.
- A bot personality that is ignored.
- A missing endgame solver.
- A platform-divergent engine.
- A 12s analysis timeout on a 70-ply game.
- A phone that cannot afford the compute.

**Rule:** do not add sims until 1-thread vs 8-thread behavior, candidate recall, and time budget are fixed and measured.

---

## 5. Hardcoded inventory

This is not an exhaustive list; it is the set that most affects strength and behavior.

### 5.1 Native evaluation

| Item | Value | File | Risk |
|---|---:|---|---|
| 2P wall equity | 1.35 steps | `mcts.rs:401` | Overvalues/undervalues walls uniformly |
| 2P sigmoid scale | 3.2 | `mcts.rs:403` | Calibrated by hand; no outcome fit |
| Turn bonus | ±0.5 | `mcts.rs:400` | Tempo is not always half a step |
| N-player tempo | 0.5 | `mcts.rs:433` | Same for 3P/4P |
| N-player softmax | -0.4 | `mcts.rs:447` | No placement/race calibration |
| Dead 2P eval | `WIN_SCORE=10000`, path 10, walls 1.5 | `evaluation.rs:5-7` | Unused; two eval systems confuse tuning |

### 5.2 Native candidates

| Item | Value | File | Risk |
|---|---:|---|---|
| Wall must delay opponent | `max_opp_delta > 0` | `mcts.rs:283-286` | Drops setup/tempo walls |
| Wall relevance | corridor / wall within 1 / pawn within 2 | `mcts.rs:215-237` | Drops distant strategic walls |
| Opening wall prune | walls <= 2, dist >= 6, delay <= 2 | `mcts.rs:294-300` | Misses early traps |
| Net gain prune | `< 0` | `mcts.rs:288-292` | Ignores equal-value tempo walls |
| Wall prior | `0.35 + 0.10*net_gain + bonuses` | `mcts.rs:302-305` | Hand-tuned; no learning |
| Pawn prior | `0.65 + 0.15*gain`, clamp | `mcts.rs:120-128` | Biases forward moves |
| Progressive widening | `2 + 1.2*sqrt(visits)` | `mcts.rs:533` | May starve late candidates |

### 5.3 Native search

| Item | Value | File | Risk |
|---|---:|---|---|
| Default analysis sims | 6,000 | `mcts.rs:484` | Every ply is expensive |
| Clamp | 3,000–10,000 | `mcts.rs:482-483` | No fast pass |
| UCT constant | 0.45 | `mcts.rs:485` | Single value for all modes |
| Hint threshold | >= 90,000 | `mcts.rs:1138` | Strict top-visit; no variety |
| Tier thresholds | 20,000 / 3,500 | `mcts.rs:1145-1153` | Based on raw requested sims, not effective |
| Delta Q | 0.025 / 0.065 / 0.14 | `mcts.rs:1145-1153` | Hardcoded style |
| Visit ratios | 0.35 / 0.20 / 0.10 | `mcts.rs:1145-1153` | Hardcoded style |
| Tactical guard | delay >= 4 | `mcts.rs:869` | Misses non-adjacent traps |
| Depth equalization | up to 1,500 | `mcts.rs:645-653` | Unpredictable analysis cost |

### 5.4 JS evaluation and profiles

| Item | Value | File | Risk |
|---|---:|---|---|
| Win score | 10,000 | `constants.ts:78` | Hard terminal scale |
| Placement step | 1,000 | `constants.ts:79` | Hard terminal scale |
| Structure cap | 0.75 step | `constants.ts:83` | Hand-tuned |
| Fork cap | 32 | `evaluation.ts:21` | Saturates path count |
| Race4 tuning | tightness x0.5, placement x1.5 | `evaluation.ts:96-103` | No data |
| Profile weights | 6–16 path, etc. | `constants.ts:5-71` | Per-bot, but hard bots ignore them |
| Terminal profile | fixed hard profile | `search.ts:65-73` | Wrong profile at terminal nodes |

### 5.5 JS candidates

| Item | Value | File | Risk |
|---|---:|---|---|
| Root wall cap | 2 / 5 / 8 | `constants.ts:11,34,55` | Tiny fraction of legal walls |
| Probe cap | 6x wall cap | `candidates.ts:373` | 12 / 30 / 48 probes |
| Max denial kept | top 2 | `candidates.ts:457` | Hard cap |
| Plan slots | max wall cap | `candidates.ts:461` | Can crowd out other walls |
| Inner plan walls | 2 | `constants.ts:110` | Opponent wall replies mostly absent |
| Slot cap | 96 | `constants.ts:92` | Silent truncation |
| Approach range | 4 | `candidates.ts:37` | Hand-tuned |
| Self critical tightness | 3 | `constants.ts:100` | Hand-tuned |

### 5.6 JS MCTS

| Item | Value | File | Risk |
|---|---:|---|---|
| UCT | profile 0.35–0.9 | `mcts.ts:283` | Per-bot, but not native |
| Rollout depth | 6 | `mcts.ts:284` | Short horizon |
| Wall probability | 0.05–0.45 | `mcts.ts:352` | Hand-tuned |
| Block probability | 0.15–0.85 | `mcts.ts:353` | Hand-tuned |
| Wall horizon | 3/6/16 | `mcts.ts:354` | Hand-tuned |
| Miss defense | 0.35 | `mcts.ts:356-359` | Easy only |
| Sprint thresholds | lead/close/behind | `mcts.ts:343-352` | Hand-tuned |
| Hard delta Q | 0.025 | `mcts.ts:656-663` | Same as native hint tier |
| Blunder | 0.30 | `mcts.ts:686` | Easy only |
| Collapse bar | 0.20 | `mcts.ts:728` | Hand-tuned |

### 5.7 Routing and budgets

| Item | Value | File | Risk |
|---|---:|---|---|
| Hard native sims | 50,000 | `aiWorkerClient.ts:166` | No profile, no deadline |
| Hint native sims | 100,000 | `aiWorkerClient.ts:166` | Effective 12.5k |
| Native threads | 8 | `aiWorkerClient.ts:167` | Fixed on all devices |
| Web timeout | 12,000 ms | `aiWorkerClient.ts:43` | Only web |
| Native timeout | none | `modules/duoorb-ai-native` | Can hang a turn |
| Profile budgets | 50/150/350 ms | `constants.ts` | Ignored by native |
| Production budgets | 60/130/240 ms | `engine.ts:47-59` | Separate source of truth |

### 5.8 Analysis and classification

| Item | Value | File | Risk |
|---|---:|---|---|
| Sims per ply | 6,000 | `mcts.rs:484` | Every ply, including forced |
| Analysis timeout | 12,000 ms | `apiClient.ts` | Server continues after timeout |
| Accuracy power | 1.40 | `review.rs:224` | Hand-tuned |
| Tier loss | 28/46/72/125/215 | `review.rs:209-219` | Hand-tuned |
| Critical moment | delta >= 0.20 | `review.rs:231` | Hand-tuned |
| Classifier bars | 0.035/0.08/0.16/0.25 | `classifier.rs` | Calibrated to old Q |
| Analysis version | `analysis-3.3` | `analysis.service.ts:17` | Cache invalidation only |

---

## 6. Bottleneck ranking

| Rank | Bottleneck | Severity | Why it matters | Effort |
|---|---|---|---|---|
| 1 | 8 duplicate trees | **Critical** | 8x CPU/memory for 1x information; effective sims are 1/8 | Medium |
| 2 | Hard bots ignore personality | **Critical** | 18/39 bots are the same; roster is not truthful | Low–Medium |
| 3 | Candidate pruning | **Critical** | Best move may never be searched; more sims useless | Medium |
| 4 | Shallow evaluation | **High** | Search optimizes a weak proxy; strength ceiling | High |
| 5 | Analysis design | **High** | Slow, expensive, deterministic, times out; poor capacity | Medium |
| 6 | No native deadline | **High** | Over-budget moves; phone hangs; 440k broke 1.5s | Low |
| 7 | Platform divergence | **High** | Fixes don't transfer; same bot differs by platform | Medium |
| 8 | No endgame/opening/TT/tree reuse | **Medium** | Missed exact wins; repetitive openings; wasted search | Medium–High |
| 9 | Budget chaos | **Medium** | Impossible to tune or benchmark one variable | Low |
| 10 | Measurement gaps | **Medium** | Every change is a guess; no Elo/recall/device data | Low |
| 11 | Product truth (stars/hints/undo) | **Medium** | Players see 39 bots and 3-star mastery that do not match behavior | Low |

---

## 7. Recommended fix sequence

No code changes should start until the owner approves the sequence and the acceptance tests.

### Phase 0 — Instrument before changing (1–2 days)

1. Add native search stats: requested sims, effective sims, threads, unique root actions, root visits/Q, candidate count, elapsed time.
2. Add a 1-thread vs 8-thread test on 20 positions. If results are identical, the duplicate-tree bug is confirmed.
3. Add candidate-recall test: candidate set vs all legal walls on 100 positions.
4. Add per-bot move-distribution test: 18 hard bots on the same 20 positions.
5. Add device latency test: mid-range Android and iPhone, p50/p95/max, thermal.

### Phase 1 — P0 plumbing (1–2 weeks)

1. **Fix parallelism.** Shared tree with virtual loss, or real root-parallel with distinct seeds/priors. Do not ship 8 duplicate trees.
2. **Fix budget resolver.** One `SearchBudget` object per bot/mode/platform: sims, time, threads, temperature, blunder, style. No hidden defaults.
3. **Fix hard-bot routing.** Pass profile/top-k into native; or route hard bots through profile-aware JS until native supports it.
4. **Add native deadline.** Stop at time, return best-so-far. Enforce 1.5s p95 on mid-range.
5. **Fix analysis forced moves.** Skip search for forced/only-legal moves; use cheap classification.
6. **Add quick-pass analysis.** 20–50 sims/ply + deep key moments; cache; async queue.
7. **Remove dead/stale code.** `evaluation.rs` unused; `review.rs` 35k comment; `rivalsDisarmed` unused; `_touches_mover_corridor` unused.

### Phase 2 — Strength (2–4 weeks)

1. **Candidate recall.** Exhaustive root walls at low/medium sims; learned prior later; include setup walls; include opponent wall replies deeper.
2. **Evaluation features.** Wall quality, corridor width, threats, tempo, strategic equity; calibrate against outcomes.
3. **Endgame solver.** No-wall races first; then 1-wall/2-wall exact endgames.
4. **Opening book.** Small, curated; removes repetitive early search.
5. **Tree reuse / transposition.** At least within a game; native TT.
6. **Final selection.** Q/LCB or risk-adjusted score, not raw visits; optional Dirichlet noise for variety.

### Phase 3 — Model/scale (after Phase 1–2)

1. Learned value/policy (Sigma-style ONNX or DuoOrb-trained).
2. Two model tiers: lite on device, full on server.
3. Unified engine core for bots, hints, analysis; variants fallback.
4. Server capacity: 4–8 vCPU or GPU; batch/queue; cache.

---

## 8. Acceptance tests

| Gate | Test | Pass criteria |
|---|---|---|
| G0 | 1-thread vs 8-thread | 8 threads is stronger, or same result at ~1/8 CPU; not identical duplicate trees |
| G1 | Rules/action parity | 100/100 positions legal; native vs JS same rules |
| G2 | Candidate recall | >= 99% of deep-best moves are in the candidate set |
| G3 | Strength | 50–100 games vs baseline; Elo gain with confidence interval; no regression per tier |
| G4 | Bot identity | 18 hard bots produce distinct move distributions on 20 positions |
| G5 | Latency | Mid-range Android p95 <= 1.2s, max <= 1.5s; no thermal throttle |
| G6 | Analysis | 70-ply quick review <= 8s; deep key moments <= 20s; no forced-move search |
| G7 | Capacity | t4g.small measured reviews/hour and concurrent; queue behavior |
| G8 | Platform parity | Same bot/profile gives same strength class on native and web |

---

## 9. What not to do

- **Do not just raise sims.** 440k already broke the time cap and changed nothing.
- **Do not run 440k on a phone.** 8 duplicate trees at 55k each is a memory/thermal risk.
- **Do not tune evaluation constants before measuring candidate recall and parallelism.** You will be tuning noise.
- **Do not ship “39 personalities” until hard bots use their profiles.**
- **Do not put the full analysis model on t4g.small and call it capacity.** The full model is heavier; capacity may be worse than the current analyzer.
- **Do not use a 12s synchronous request for a 70-ply deep review.** Use a queue.
- **Do not treat Sigma as a substitute for fixing the current plumbing.** Sigma improves evaluation/policy; it does not fix duplicate workers, budgets, personality routing, or analysis design.

---

## 10. Appendix — key code references

| Topic | File | Lines |
|---|---|---|
| Native MCTS, fake root parallelism | `packages/analyzer-rust/src/mcts.rs` | 982–1114 |
| Worker ignores seed/index | `packages/analyzer-rust/src/mcts.rs` | 985, 1108 |
| Effective sims per thread | `packages/analyzer-rust/src/mcts.rs` | 983 |
| Native 2P evaluation | `packages/analyzer-rust/src/mcts.rs` | 340–457 |
| Native candidate pruning | `packages/analyzer-rust/src/mcts.rs` | 60–337 |
| Native search constants | `packages/analyzer-rust/src/mcts.rs` | 482–485 |
| Depth equalization | `packages/analyzer-rust/src/mcts.rs` | 645–653 |
| Hint/tier thresholds | `packages/analyzer-rust/src/mcts.rs` | 1138–1154 |
| Analysis per ply | `packages/analyzer-rust/src/review.rs` | 112–127 |
| Stale 35k comment | `packages/analyzer-rust/src/review.rs` | 126 |
| Forced moves still searched | `packages/analyzer-rust/src/review.rs` | 123–127 |
| Dead 2P eval | `packages/analyzer-rust/src/evaluation.rs` | 1–68 |
| Hard-bot native routing | `apps/mobile/src/ai/aiWorkerClient.ts` | 158–169 |
| Native module wrapper | `modules/duoorb-ai-native/src/index.ts` | 42–58 |
| Bot roster / profiles | `packages/game-core/src/ai/personalities.ts` | 95+ |
| Profile constants | `packages/game-core/src/ai/constants.ts` | 5–71 |
| JS evaluation | `packages/game-core/src/ai/evaluation.ts` | 105–179 |
| JS candidate caps | `packages/game-core/src/ai/candidates.ts` | 361–466 |
| Inner plan walls | `packages/game-core/src/ai/candidates.ts` | 516–645 |
| JS search / fixed terminal profile | `packages/game-core/src/ai/search.ts` | 65–73, 163–167 |
| JS MCTS thresholds | `packages/game-core/src/mcts.ts` | 348–359, 656–663, 686 |
| Hint profile ignored on native | `apps/mobile/src/screens/GameScreen.tsx` | 1917–1941 |
| Bot stars ignore hints | `apps/mobile/src/screens/GameScreen.tsx` | 1185–1207 |
| Analysis server flow | `apps/server/src/analysis/analysis.service.ts` | 117–121 |

---

## 11. Final judgment

The current AI has three separable problems:

1. **Plumbing:** fake parallelism, no deadline, budget chaos, platform divergence.
2. **Knowledge:** shallow evaluation, hard-pruned candidates, no endgame/opening.
3. **Product truth:** 18 bots share one brain; hints and analysis are not the same engine; bot stars ignore hints.

Fixing (1) is cheap and gives an immediate effective-search gain. Fixing (2) raises the strength ceiling. Fixing (3) makes the product honest. Adding simulations before (1) and (2) is wasted compute — which is exactly what the 256k vs 440k test showed.

If the owner wants the best short-term return: **fix the duplicate-tree parallelism, the budget resolver, and hard-bot personality routing first.** Then measure candidate recall and latency. Only then decide whether to invest in evaluation features, a learned model, or Sigma.
