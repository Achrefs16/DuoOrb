# Phase 2 Implementation Plan: Backend Rust Analysis Engine Overhaul ("Everything Is a Blunder" Bug Fix)

> **Phase:** 2 of 6  
> **Packages Affected:** `@duoorb/analyzer-rust` (`packages/analyzer-rust`), `@duoorb/server` (`apps/server/src/analysis`)  
> **Dependencies:** Independent of mobile UI phases  
> **Goal:** Fix the 4 critical bugs in `packages/analyzer-rust` causing almost every move that is not the engine's #1 choice to be marked as a `BLUNDER`, and enforce the strict rule that a **`BLUNDER` only occurs when a move flips the evaluation bar to the other side or throws away the game**.

---

## 1. Root-Cause Diagnosis (Verified by Live Simulation)

When we ran `packages/analyzer-rust` on a 30-move game, normal forward pawn moves and standard walls were graded as `BLUNDER` with `best_q = 0.898` and `played_q = 0.000` (`0/1` visits) or `0.250` (`1/4` visits)! Even worse, on consecutive plies, P1 had `best_q = 0.858` (85.8% win chance for P1) and 1 ply later P2 had `best_q = 0.882` (88.2% win chance for P2).

Here are the **4 exact bugs** in `packages/analyzer-rust/src/` causing this:

### Bug 1 — Cooperative (Non-Adversarial) Tree Selection (`src/mcts.rs:259-271`)
Look at [`packages/analyzer-rust/src/mcts.rs`](file:///c:/Users/achra/Documents/DuoOrb/packages/analyzer-rust/src/mcts.rs#L259-L271) and lines `361-392`:
```rust
// Line 362: reward is ALWAYS from root mover_idx's perspective!
let reward: f64 = if let Some(winner) = terminal_winner {
    if winner == mover_idx { 1.0 } else { 0.0 }
} ...
// Line 261: at EVERY node in the tree (even when it is the OPPONENT'S turn!),
// selection maximizes child.total_reward / child.visits!
let q = if child.visits > 0 {
    child.total_reward / child.visits as f64
} else {
    0.5
};
```
Because `q` is always the **root mover's** win rate, when MCTS selects a move at depth 1 (where it is the **opponent's** turn), it picks the move for the opponent that **maximizes the root mover's win rate**! In other words, the engine assumes the opponent will cooperate to help the root mover win, inflating `best_q` on the main line to `0.85–0.95` on every single turn!

### Bug 2 — `played_action` Is Starved of Simulations in the Root Tree (`src/mcts.rs:402-423`)
In `run_mcts_analysis` (`mcts.rs:213-433`), all 1,000 simulations are run from `root_state` with `UCT_C = 0.45`.
- If `played_action` loses its first 1 or 2 noisy rollouts (`q = 0.00`), `UCT_C = 0.45` never visits it again (`child.visits == 1..4` out of `1,000`).
- If `played_action` was a wall not returned by `get_mcts_actions` (`mcts.rs:128-192`), `played_action` is **not even in `tree[0].children`**, so `played_q` is `None`!
- Comparing a 1-visit `played_q = 0.000` against an 800-visit cooperative `best_q = 0.898` yields `delta_q = 0.898` $\rightarrow$ **`BLUNDER`**!

### Bug 3 — Rollouts Walk Randomly Backward 20% of the Time & Leaf Eval Ignores Turn Tempo and Walls (`src/mcts.rs:342, 365-384`)
- At line `342`: `if !path.is_empty() && legals.contains(&path[0]) && rng.next_f64() < 0.80` means on **20% of rollout plies**, pawns pick a random move (often walking backward!), creating huge rollout variance.
- At lines `366-384`: Leaf evaluation `lead = (opp_dist - my_dist)` ignores:
  1. **Whose turn it is (`sim_state.current_player_index`)**: After `mover` plays a move, it is the opponent's turn (`-0.5` tempo).
  2. **Wall reserve (`walls_remaining`)**: Placing a defensive wall or a `+1` step wall spends 1 wall and 1 turn; ignoring wall value and self-cost makes almost every wall placement look like a tempo loss.

### Bug 4 — `classify_mcts_move` Has No "Bar-Flip" Guard (`src/classifier.rs:12-62`)
- [`packages/analyzer-rust/src/classifier.rs`](file:///c:/Users/achra/Documents/DuoOrb/packages/analyzer-rust/src/classifier.rs#L47-L59) classifies any move with `delta_q > 0.42` as `Blunder` without checking whether the evaluation bar actually flipped to the opponent's side or whether the move actually worsened the shortest-path race!

---

## 2. Step-by-Step File Modifications

### Step 2.1 — Fix 3P/4P Goal Completion in `packages/analyzer-rust/src/rules.rs`
**File:** [`packages/analyzer-rust/src/rules.rs`](file:///c:/Users/achra/Documents/DuoOrb/packages/analyzer-rust/src/rules.rs#L115-L156)

In `apply_action` (`lines 122-128`), when `GameAction::Move { to }` reaches a goal cell (`is_goal_cell(*to, mover.goal_direction, &state.mode)`):
```rust
GameAction::Move { to } => {
    let legals = get_legal_moves(state, &mover.id, board);
    if !legals.contains(to) {
        return None;
    }
    next.players[mover_idx].position = *to;
    if is_goal_cell(*to, next.players[mover_idx].goal_direction, &next.mode) {
        next.players[mover_idx].status = "FINISHED".to_string();
        if next.players.len() <= 2 {
            next.status = "COMPLETED".to_string();
        }
    }
}
```

---

### Step 2.2 — Fix Adversarial Tree Selection, Leaf Evaluation & Dedicated `played_action` Evaluation in `packages/analyzer-rust/src/mcts.rs`
**File:** [`packages/analyzer-rust/src/mcts.rs`](file:///c:/Users/achra/Documents/DuoOrb/packages/analyzer-rust/src/mcts.rs)

1. **Filter Self-Harming Walls in `find_path_blocking_walls` (`lines 56-126`) and `get_mcts_actions` (`lines 128-192`):**
   - Compute `my_base = shortest_distance(mover.position, mover.goal_direction, board, &state.mode)`.
   - For each candidate wall `slot`, compute `opp_delay = opp_after - opp_base` and `self_cost = my_after - my_base`.
   - Compute `net_gain = opp_delay - self_cost`.
   - Only include blocking walls where `net_gain > 0` (or `opp_base == 1 && opp_after > 1`), sorted by `net_gain` descending!
   - Remove the blind `touch_slots` around `mover.position` (`lines 160-174`) unless they provide positive `net_gain`.

2. **Per-Player Adversarial Reward Vector on `MctsNode` (`lines 194-205`):**
   ```rust
   #[derive(Clone)]
   struct MctsNode {
       action: Option<GameAction>,
       mover_idx: usize, // Player whose turn it is AT this node
       parent: Option<usize>,
       children: Vec<usize>,
       untried_actions: Vec<GameAction>,
       visits: u32,
       rewards: [f64; 4], // Cumulative win reward for each player index 0..4
       prior: f64,        // Heuristic prior P(s, a) for PUCT selection
   }
   ```

3. **Adversarial PUCT Selection (`lines 252-281`):**
   - At node `cur_node_idx`, let `selector_idx = tree[cur_node_idx].mover_idx` (the player who chooses the move at `cur_node_idx`).
   - For each `&child_idx` in `&tree[cur_node_idx].children`:
     ```rust
     let child = &tree[child_idx];
     let q = if child.visits > 0 {
         child.rewards[selector_idx] / child.visits as f64
     } else {
         child.prior
     };
     let u = UCT_C * child.prior * (parent_visits.sqrt() / (1.0 + child.visits as f64));
     let score = q + u;
     ```
   - Now at depth 0 (`selector_idx == root_mover`), P1 picks moves that maximize **P1's** win rate; at depth 1 (`selector_idx == opp_idx`), P2 picks moves that maximize **P2's** win rate!

4. **Accurate Rollout & Turn/Wall-Aware Leaf Evaluation (`lines 310-392`):**
   - Reduce rollout depth from `16` to `6` plies with `95%` shortest-path step probability (never stepping backward toward own baseline unless forced).
   - At rollout end, compute `rewards: [f64; 4]`:
     - For 2P mode:
       ```rust
       let p0_dist = shortest_distance(sim_state.players[0].position, sim_state.players[0].goal_direction, &sim_board, &sim_state.mode).max(0) as f64;
       let p1_dist = shortest_distance(sim_state.players[1].position, sim_state.players[1].goal_direction, &sim_board, &sim_state.mode).max(0) as f64;
       let turn_bonus = if sim_state.current_player_index == 0 { 0.5 } else { -0.5 };
       let wall_diff = (sim_state.players[0].walls_remaining - sim_state.players[1].walls_remaining) as f64;
       let wall_bonus = wall_diff * 0.35;
       let p0_lead = (p1_dist - p0_dist) + turn_bonus + wall_bonus;
       let p0_win = 1.0 / (1.0 + (-p0_lead / 3.2).exp());
       rewards[0] = p0_win;
       rewards[1] = 1.0 - p0_win;
       ```
     - Backpropagate `rewards[0..player_count]` up all nodes on the path!

5. **Dedicated Evaluation of `played_action` (`run_mcts_analysis`):**
   - Ensure `played_action` is always in `initial_actions` at the root.
   - Run `750` adversarial simulations from `root_state`.
   - Find `best_child` (highest visits / Q among root children with $\ge 25$ visits) and record `best_q = best_child.rewards[mover_idx] / best_child.visits as f64`.
   - If `played_action == best_action`, set `played_q = Some(best_q)`.
   - Otherwise, evaluate the state **after `played_action`** (`apply_action(root_state, played_action, ...)`) by running **`250` dedicated adversarial simulations** from `state_after_played` (or combining root child visits with dedicated rollouts on `state_after_played`) so `played_q` is always measured with $\ge 250$ adversarial simulations — **never a 1-visit `0.000`!**

---

### Step 2.3 — Implement True "Bar-Flip" Blunder Classification in `packages/analyzer-rust/src/classifier.rs`
**File:** [`packages/analyzer-rust/src/classifier.rs`](file:///c:/Users/achra/Documents/DuoOrb/packages/analyzer-rust/src/classifier.rs)

Update `classify_mcts_move` to take `(best_q: f64, played_q: f64, net_step_delta: i16, forced: bool)`:

```rust
pub fn classify_mcts_move(
    best_q: f64,
    played_q: f64,
    net_step_delta: i16, // (my_dist_before - my_dist_after) - (opp_dist_before - opp_dist_after) compared to best
    forced: bool,
) -> (MoveAssessment, f64, f64) {
    if forced {
        return (MoveAssessment::Forced, 0.0, 100.0);
    }

    let delta_q = (best_q - played_q).max(0.0);
    let loss = delta_q * 40.0;

    // Did the move flip the evaluation bar from our side/equal to the opponent's side?
    // Or did it throw away a clear winning/equal position into a losing position?
    let flipped_bar = (best_q >= 0.46 && played_q <= 0.32)
        || (best_q >= 0.65 && played_q <= 0.44)
        || delta_q >= 0.36;

    let assessment = if delta_q <= 0.025 || (net_step_delta >= 0 && delta_q <= 0.05) {
        MoveAssessment::Best
    } else if delta_q <= 0.06 {
        MoveAssessment::Excellent
    } else if delta_q <= 0.12 {
        MoveAssessment::Good
    } else if delta_q <= 0.20 {
        MoveAssessment::Inaccuracy
    } else if !flipped_bar || delta_q <= 0.28 {
        // Even if delta_q is 0.21..0.28, if the bar did NOT flip to the other side,
        // cap it at MISTAKE (never a false BLUNDER!)
        MoveAssessment::Mistake
    } else {
        MoveAssessment::Blunder
    };

    let accuracy = match assessment {
        MoveAssessment::Best | MoveAssessment::Forced => 100.0,
        MoveAssessment::Excellent => (100.0 - delta_q * 120.0).clamp(90.0, 99.0),
        MoveAssessment::Good => (92.0 - delta_q * 140.0).clamp(76.0, 90.0),
        MoveAssessment::Inaccuracy => (78.0 - delta_q * 150.0).clamp(52.0, 75.0),
        MoveAssessment::Mistake => (55.0 - delta_q * 120.0).clamp(25.0, 50.0),
        MoveAssessment::Blunder => (25.0 - delta_q * 50.0).clamp(0.0, 20.0),
    };

    (assessment, loss, accuracy)
}
```

---

### Step 2.4 — Invalidate Stale Cached Analyses & Bump `analysisVersion`
**Files:**
- [`packages/analyzer-rust/src/review.rs:190`](file:///c:/Users/achra/Documents/DuoOrb/packages/analyzer-rust/src/review.rs#L190)
- [`apps/server/src/analysis/analysis.service.ts:44`](file:///c:/Users/achra/Documents/DuoOrb/apps/server/src/analysis/analysis.service.ts#L44)

1. Bump `analysis_version` in `review.rs:190` from `"analysis-2.0"` to `"analysis-2.1"`.
2. In `apps/server/src/analysis/analysis.service.ts:44`:
   - When checking the PostgreSQL `gameAnalysis` cache (`cached && cached.reviewData`), verify `cached.analysisVersion === 'analysis-2.1'`. If an old match was cached with `"analysis-2.0"` (the buggy all-blunder version), automatically recompute it with `"analysis-2.1"` and `upsert` the fresh review!

---

## 3. Build & Verification Checklist for Phase 2
- [ ] Run `cargo build --release` inside `packages/analyzer-rust` and `node scripts/copy-binary.js` to update `duoorb-analyzer.node`.
- [ ] Run `node packages/analyzer-rust/tests/binding.test.js`.
- [ ] Run the 30-move simulated game benchmark and verify:
  - Normal shortest-path moves and reasonable walls are graded `BEST` / `EXCELLENT` / `GOOD`.
  - Suboptimal tempo moves that don't flip the bar are graded `INACCURACY` / `MISTAKE`.
  - Only genuine game-throwing moves that flip the bar across to the opponent (`best_q >= 0.46 -> played_q <= 0.32` or `delta_q >= 0.36`) are graded `BLUNDER`.
