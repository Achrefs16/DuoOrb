use std::collections::HashSet;

use crate::board::Board;
use crate::pathfinding::{is_goal_cell, shortest_distance, shortest_path};
use crate::rules::{apply_action, get_legal_moves, is_legal_wall_placement};
use crate::types::{GameAction, GameState, Orientation, WallCoord};

pub struct Prng {
    state: u64,
}

impl Prng {
    pub fn new(seed: u64) -> Self {
        Self {
            state: if seed == 0 { 0x853c49e6748fea9b } else { seed },
        }
    }

    pub fn next_u64(&mut self) -> u64 {
        self.state = self.state.wrapping_add(0x9E3779B97F4A7C15);
        let mut z = self.state;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58476D1CE4E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D049BB133111EB);
        z ^ (z >> 31)
    }

    pub fn next_f64(&mut self) -> f64 {
        (self.next_u64() >> 11) as f64 / (1u64 << 53) as f64
    }

    pub fn gen_range(&mut self, min: usize, max: usize) -> usize {
        if min >= max {
            return min;
        }
        min + (self.next_u64() as usize % (max - min))
    }
}

pub fn position_seed(state: &GameState, ply: i32) -> u64 {
    let mut h: u64 = 0xcbf29ce484222325 ^ (ply as u64);
    for p in &state.players {
        h = h.wrapping_mul(0x100000001b3) ^ (p.position.row as u64);
        h = h.wrapping_mul(0x100000001b3) ^ (p.position.col as u64);
        h = h.wrapping_mul(0x100000001b3) ^ (p.walls_remaining as u64);
    }
    for w in &state.walls {
        h = h.wrapping_mul(0x100000001b3) ^ (w.row as u64);
        h = h.wrapping_mul(0x100000001b3) ^ (w.col as u64);
        h = h.wrapping_mul(0x100000001b3)
            ^ (match w.orientation {
                Orientation::H => 1,
                Orientation::V => 2,
            });
    }
    h
}

#[inline(always)]
fn distance_from(state: &GameState, player_idx: usize, board: &Board) -> i32 {
    match state.players.get(player_idx) {
        Some(p) => {
            let d = shortest_distance(p.position, p.goal_direction, board, &state.mode);
            if d < 0 {
                99
            } else {
                d
            }
        }
        None => 99,
    }
}

/// Walls that block `target_idx`'s shortest path, scored by the tempo they
/// gain against the wall owner's own race. A wall that delays us as much as
/// (or more than) the opponent is not a candidate: that is the old blind
/// "place a wall next to my pawn" noise that made every wall look like a
/// blunder.
fn blocking_wall_candidates(
    state: &GameState,
    actor_id: &str,
    target_idx: usize,
    board: &Board,
    horizon: usize,
) -> Vec<(i32, WallCoord)> {
    let target = match state.players.get(target_idx) {
        Some(p) => p,
        None => return vec![],
    };
    let base_dist = shortest_distance(target.position, target.goal_direction, board, &state.mode);
    if base_dist <= 0 {
        return vec![];
    }

    let actor = match state.players.iter().find(|p| p.id == actor_id) {
        Some(p) => p,
        None => return vec![],
    };
    let my_base =
        shortest_distance(actor.position, actor.goal_direction, board, &state.mode).max(0);

    let path = match shortest_path(target.position, target.goal_direction, board, &state.mode) {
        Some(p) => p,
        None => return vec![],
    };

    let mut candidates = Vec::with_capacity(32);
    let mut seen = HashSet::new();

    let mut add = |w: WallCoord| {
        if w.row >= 0 && w.row < 8 && w.col >= 0 && w.col < 8 && seen.insert(w) {
            candidates.push(w);
        }
    };

    // Bordering the target pawn.
    let (tr, tc) = (target.position.row, target.position.col);
    add(WallCoord {
        row: tr - 1,
        col: tc,
        orientation: Orientation::H,
    });
    add(WallCoord {
        row: tr,
        col: tc,
        orientation: Orientation::H,
    });
    add(WallCoord {
        row: tr,
        col: tc - 1,
        orientation: Orientation::V,
    });
    add(WallCoord {
        row: tr,
        col: tc,
        orientation: Orientation::V,
    });

    // Path crossing slots.
    let steps = path.len().min(horizon.max(2));
    let mut cur = target.position;
    for next in path.iter().take(steps) {
        let next = *next;
        if next.row == cur.row + 1 {
            add(WallCoord {
                row: cur.row,
                col: cur.col,
                orientation: Orientation::H,
            });
            add(WallCoord {
                row: cur.row,
                col: cur.col - 1,
                orientation: Orientation::H,
            });
        } else if next.row == cur.row - 1 {
            add(WallCoord {
                row: next.row,
                col: cur.col,
                orientation: Orientation::H,
            });
            add(WallCoord {
                row: next.row,
                col: cur.col - 1,
                orientation: Orientation::H,
            });
        } else if next.col == cur.col + 1 {
            add(WallCoord {
                row: cur.row,
                col: cur.col,
                orientation: Orientation::V,
            });
            add(WallCoord {
                row: cur.row - 1,
                col: cur.col,
                orientation: Orientation::V,
            });
        } else if next.col == cur.col - 1 {
            add(WallCoord {
                row: cur.row,
                col: next.col,
                orientation: Orientation::V,
            });
            add(WallCoord {
                row: cur.row - 1,
                col: next.col,
                orientation: Orientation::V,
            });
        }
        cur = next;
    }

    let mut scored = Vec::with_capacity(candidates.len());
    for slot in candidates {
        if !is_legal_wall_placement(state, actor_id, &slot, board) {
            continue;
        }
        let mut test_board = *board;
        test_board.place_wall(&slot);
        let after = shortest_distance(
            target.position,
            target.goal_direction,
            &test_board,
            &state.mode,
        );
        if after < 0 {
            continue;
        }
        let opp_delay = after - base_dist;
        let my_after = shortest_distance(
            actor.position,
            actor.goal_direction,
            &test_board,
            &state.mode,
        )
        .max(0);
        let self_cost = (my_after - my_base).max(0);
        let net_gain = opp_delay - self_cost;
        if net_gain > 0 || (base_dist == 1 && after > 1) {
            scored.push((net_gain, slot));
        }
    }

    scored.sort_by(|a, b| b.0.cmp(&a.0));
    scored
}

pub fn find_path_blocking_walls(
    state: &GameState,
    actor_id: &str,
    target_idx: usize,
    board: &Board,
    horizon: usize,
) -> Vec<WallCoord> {
    blocking_wall_candidates(state, actor_id, target_idx, board, horizon)
        .into_iter()
        .map(|(_, wall)| wall)
        .collect()
}

pub fn get_mcts_actions(
    state: &GameState,
    mover_idx: usize,
    board: &Board,
    wall_horizon: usize,
) -> Vec<GameAction> {
    if state.status == "COMPLETED" {
        return vec![];
    }
    let mover = match state.players.get(mover_idx) {
        Some(p) => p,
        None => return vec![],
    };
    let mut actions = Vec::with_capacity(40);

    // 1. Legal pawn moves.
    for cell in get_legal_moves(state, &mover.id, board) {
        actions.push(GameAction::Move { to: cell });
    }

    // 2. Only walls with positive net tempo gain. Critical one-step threats
    // are always considered so a winning block is never filtered away.
    if mover.walls_remaining > 0 {
        let critical: Vec<usize> = state
            .players
            .iter()
            .enumerate()
            .filter(|(idx, p)| {
                *idx != mover_idx
                    && p.status != "FINISHED"
                    && shortest_distance(p.position, p.goal_direction, board, &state.mode) == 1
            })
            .map(|(idx, _)| idx)
            .collect();

        let mut best_walls: Vec<(i32, WallCoord)> = Vec::new();
        let mut seen_walls = HashSet::new();
        for (idx, foe) in state.players.iter().enumerate() {
            if idx == mover_idx || foe.status == "FINISHED" {
                continue;
            }
            if !critical.is_empty() && !critical.contains(&idx) {
                continue;
            }
            for (gain, wall) in blocking_wall_candidates(state, &mover.id, idx, board, wall_horizon)
            {
                if seen_walls.insert(wall) {
                    best_walls.push((gain, wall));
                }
            }
        }
        best_walls.sort_by(|a, b| b.0.cmp(&a.0));
        let limit = if critical.is_empty() { 12 } else { 16 };
        for (_, wall) in best_walls.into_iter().take(limit) {
            actions.push(GameAction::PlaceWall { wall });
        }
    }

    actions
}

#[derive(Clone)]
struct MctsNode {
    action: Option<GameAction>,
    /// Player whose turn it is at this node. Selection maximizes this player's
    /// reward, which makes every level of the tree adversarial.
    mover_idx: usize,
    parent: Option<usize>,
    children: Vec<usize>,
    untried_actions: Vec<GameAction>,
    visits: u32,
    /// Cumulative win reward per player index (2P uses complementary values;
    /// 3P/4P uses per-player sigmoid estimates).
    rewards: [f64; 4],
    /// Heuristic prior for PUCT at the parent that created this node.
    prior: f64,
}

pub struct MctsEvaluationResult {
    pub best_action: GameAction,
    pub best_q: f64,
    pub played_q: Option<f64>,
    pub candidate_actions: Vec<(GameAction, f64, u32)>, // (action, Q, visits)
    pub root_q: f64,
    pub gap_to_second: f64,
}

#[inline(always)]
fn sigmoid(x: f64) -> f64 {
    1.0 / (1.0 + (-x).exp())
}

/// Leaves are scored for every seat, not just the root mover. 2P uses the
/// exact complementary sigmoid from the Phase 2 spec; 3P/4P scores each
/// active seat against its nearest rival.
fn heuristic_rewards(state: &GameState, board: &Board) -> [f64; 4] {
    let mut rewards = [0.0f64; 4];
    let n = state.players.len().min(4);
    if n == 0 {
        return rewards;
    }

    let finished: Vec<bool> = state
        .players
        .iter()
        .take(n)
        .map(|p| p.status == "FINISHED" || is_goal_cell(p.position, p.goal_direction, &state.mode))
        .collect();

    if state.status == "COMPLETED" || finished.iter().any(|f| *f) {
        if n == 2 {
            let winner = if finished[0] && !finished[1] {
                0
            } else if finished[1] && !finished[0] {
                1
            } else if state.current_player_index == 0 {
                0
            } else {
                1
            };
            rewards[winner] = 1.0;
            rewards[1 - winner] = 0.0;
            return rewards;
        }
        // No placement list in the analysis DTO: every finisher is treated as
        // a winner for its own reward channel, active seats stay below them.
        for i in 0..n {
            rewards[i] = if finished[i] { 1.0 } else { 0.0 };
        }
        return rewards;
    }

    let dists: Vec<i32> = (0..n).map(|i| distance_from(state, i, board)).collect();
    let walls: Vec<f64> = state
        .players
        .iter()
        .take(n)
        .map(|p| p.walls_remaining as f64)
        .collect();
    let avg_walls = walls.iter().sum::<f64>() / n as f64;

    if n == 2 {
        let turn_bonus = if state.current_player_index == 0 {
            0.5
        } else {
            -0.5
        };
        let wall_bonus = (walls[0] - walls[1]) * 0.35;
        let lead = (dists[1] - dists[0]) as f64 + turn_bonus + wall_bonus;
        let p0 = sigmoid(lead / 3.2);
        rewards[0] = p0;
        rewards[1] = 1.0 - p0;
        return rewards;
    }

    for i in 0..n {
        let min_opp = (0..n)
            .filter(|j| *j != i)
            .map(|j| dists[j])
            .min()
            .unwrap_or(dists[i]);
        let turn_bonus = if state.current_player_index == i {
            0.5
        } else {
            -0.5
        };
        let wall_bonus = (walls[i] - avg_walls) * 0.35;
        let lead = (min_opp - dists[i]) as f64 + turn_bonus + wall_bonus;
        rewards[i] = sigmoid(lead / 3.2);
    }
    rewards
}

/// Six-ply adversarial rollout. Each seat walks its own shortest path 95% of
/// the time and never voluntarily steps away from its goal. Randomness is
/// reserved for ties/blocked paths, not for walking backward.
fn rollout_rewards(state: &GameState, board: &Board, rng: &mut Prng) -> [f64; 4] {
    let mut sim_state = state.clone();
    let mut sim_board = *board;

    for _ in 0..6 {
        if sim_state.status == "COMPLETED" || sim_state.players.is_empty() {
            break;
        }
        let idx = sim_state.current_player_index;
        if idx >= sim_state.players.len() {
            break;
        }
        if sim_state.players[idx].status == "FINISHED" {
            break;
        }

        let p = sim_state.players[idx].clone();
        let legals = get_legal_moves(&sim_state, &p.id, &sim_board);
        if legals.is_empty() {
            break;
        }

        let current_dist =
            shortest_distance(p.position, p.goal_direction, &sim_board, &sim_state.mode).max(0);
        let path = shortest_path(p.position, p.goal_direction, &sim_board, &sim_state.mode);

        let chosen = if let Some(ref path) = path {
            if !path.is_empty() && legals.contains(&path[0]) && rng.next_f64() < 0.95 {
                Some(path[0])
            } else {
                None
            }
        } else {
            None
        };

        let chosen = chosen.unwrap_or_else(|| {
            let mut best_dist = i32::MAX;
            let mut best: Vec<_> = Vec::new();
            for cell in &legals {
                let d = shortest_distance(*cell, p.goal_direction, &sim_board, &sim_state.mode);
                if d < 0 || d > current_dist {
                    continue;
                }
                if d < best_dist {
                    best_dist = d;
                    best.clear();
                    best.push(*cell);
                } else if d == best_dist {
                    best.push(*cell);
                }
            }
            if best.is_empty() {
                legals[rng.gen_range(0, legals.len())]
            } else {
                best[rng.gen_range(0, best.len())]
            }
        });

        if let Some(next) =
            apply_action(&sim_state, &GameAction::Move { to: chosen }, &mut sim_board)
        {
            sim_state = next;
        } else {
            break;
        }
    }

    heuristic_rewards(&sim_state, &sim_board)
}

fn is_playable_action(action: &GameAction) -> bool {
    matches!(
        action,
        GameAction::Move { .. } | GameAction::PlaceWall { .. }
    )
}

pub fn run_mcts_analysis(
    root_state: &GameState,
    root_board: &Board,
    played_action: &GameAction,
    simulations: usize,
    seed: u64,
) -> MctsEvaluationResult {
    let mut rng = Prng::new(seed);
    let mover_idx = root_state.current_player_index;

    let mut initial_actions = get_mcts_actions(root_state, mover_idx, root_board, 8);
    if initial_actions.is_empty() {
        return MctsEvaluationResult {
            best_action: played_action.clone(),
            best_q: 0.5,
            played_q: Some(0.5),
            candidate_actions: vec![],
            root_q: 0.5,
            gap_to_second: 0.0,
        };
    }

    // The played action must never be starved out of the tree. Walls the
    // generator didn't propose are still measured with the same budget.
    if !initial_actions.contains(played_action) && is_playable_action(played_action) {
        let mut probe_board = *root_board;
        if apply_action(root_state, played_action, &mut probe_board).is_some() {
            initial_actions.push(played_action.clone());
        }
    }

    let root_sims = (simulations * 3 / 4).max(1);
    let dedicated_sims = (simulations / 4).max(32);

    let mut tree: Vec<MctsNode> = Vec::with_capacity(root_sims + 16);
    tree.push(MctsNode {
        action: None,
        mover_idx,
        parent: None,
        children: Vec::with_capacity(initial_actions.len()),
        untried_actions: initial_actions,
        visits: 0,
        rewards: [0.0; 4],
        prior: 0.5,
    });

    const UCT_C: f64 = 0.45;

    for _ in 0..root_sims {
        // 1. Adversarial PUCT selection: each node maximizes the seat that
        // moves there, so opponents never cooperate with the root mover.
        let mut cur_node_idx = 0;
        let mut cur_state = root_state.clone();
        let mut cur_board = *root_board;

        while tree[cur_node_idx].untried_actions.is_empty()
            && !tree[cur_node_idx].children.is_empty()
        {
            let selector_idx = tree[cur_node_idx].mover_idx.min(3);
            let parent_visits = tree[cur_node_idx].visits as f64;
            let sqrt_parent = parent_visits.sqrt();

            let mut best_child_idx = tree[cur_node_idx].children[0];
            let mut best_score = f64::NEG_INFINITY;

            for &child_idx in &tree[cur_node_idx].children {
                let child = &tree[child_idx];
                let q = if child.visits > 0 {
                    child.rewards[selector_idx] / child.visits as f64
                } else {
                    child.prior
                };
                let u = UCT_C * child.prior * sqrt_parent / (1.0 + child.visits as f64);
                let score = q + u;
                if score > best_score {
                    best_score = score;
                    best_child_idx = child_idx;
                }
            }

            cur_node_idx = best_child_idx;
            if let Some(ref act) = tree[cur_node_idx].action {
                if let Some(next) = apply_action(&cur_state, act, &mut cur_board) {
                    cur_state = next;
                } else {
                    break;
                }
            }
        }

        // 2. Expansion.
        let mut expanded_node_idx = cur_node_idx;
        if !tree[cur_node_idx].untried_actions.is_empty() {
            let selector_idx = tree[cur_node_idx].mover_idx.min(3);
            let untried_len = tree[cur_node_idx].untried_actions.len();
            let pick_idx = rng.gen_range(0, untried_len);
            let action = tree[cur_node_idx].untried_actions.swap_remove(pick_idx);

            if let Some(next_state) = apply_action(&cur_state, &action, &mut cur_board) {
                let next_mover = next_state.current_player_index;
                let next_actions = if next_state.status == "COMPLETED" {
                    vec![]
                } else {
                    get_mcts_actions(&next_state, next_mover, &cur_board, 6)
                };
                let rewards_after = heuristic_rewards(&next_state, &cur_board);
                let prior = rewards_after[selector_idx].clamp(0.01, 0.99);

                let new_node_idx = tree.len();
                tree.push(MctsNode {
                    action: Some(action),
                    mover_idx: next_mover,
                    parent: Some(cur_node_idx),
                    children: Vec::new(),
                    untried_actions: next_actions,
                    visits: 0,
                    rewards: [0.0; 4],
                    prior,
                });
                tree[cur_node_idx].children.push(new_node_idx);
                expanded_node_idx = new_node_idx;
                cur_state = next_state;
            }
        }

        // 3. Rollout and 4. backpropagate the full per-seat reward vector.
        let rewards = rollout_rewards(&cur_state, &cur_board, &mut rng);
        let mut b_idx = Some(expanded_node_idx);
        while let Some(n_idx) = b_idx {
            tree[n_idx].visits += 1;
            for (i, reward) in rewards.iter().enumerate() {
                tree[n_idx].rewards[i] += reward;
            }
            b_idx = tree[n_idx].parent;
        }
    }

    // Inspect root children. Best action requires a meaningful sample size;
    // with a 1,000-sim budget this is normally 25+ visits for every candidate.
    let mut candidate_actions = Vec::with_capacity(tree[0].children.len());
    let mut best_action_opt: Option<GameAction> = None;
    let mut best_q = 0.5;
    let mut best_visits = 0u32;
    let mut sampled_action_opt: Option<GameAction> = None;
    let mut sampled_visits = 0u32;
    let mut sampled_q = 0.5;

    for &child_idx in &tree[0].children {
        let child = &tree[child_idx];
        if let Some(ref act) = child.action {
            let q = if child.visits > 0 {
                child.rewards[mover_idx.min(3)] / child.visits as f64
            } else {
                child.prior
            };
            candidate_actions.push((act.clone(), q, child.visits));

            if child.visits > sampled_visits {
                sampled_visits = child.visits;
                sampled_action_opt = Some(act.clone());
                sampled_q = q;
            }
            if child.visits >= 25 && child.visits > best_visits {
                best_visits = child.visits;
                best_action_opt = Some(act.clone());
                best_q = q;
            }
        }
    }

    if best_action_opt.is_none() {
        best_action_opt = sampled_action_opt;
        best_q = sampled_q;
    }
    let best_action = best_action_opt.unwrap_or_else(|| played_action.clone());

    // Dedicated evaluation of the played action. Even a low-visit root child
    // is topped up to at least 250 adversarial rollouts, so played_q can
    // never be a 1-visit zero.
    let played_q: Option<f64>;
    if best_action == *played_action {
        played_q = Some(best_q);
    } else {
        let mut root_child_sum = 0.0;
        let mut root_child_visits = 0u32;
        for &child_idx in &tree[0].children {
            let child = &tree[child_idx];
            if child.action.as_ref() == Some(played_action) {
                root_child_sum = child.rewards[mover_idx.min(3)];
                root_child_visits = child.visits;
                break;
            }
        }

        let mut probe_board = *root_board;
        if let Some(after_played) = apply_action(root_state, played_action, &mut probe_board) {
            let mut dedicated_sum = 0.0;
            for _ in 0..dedicated_sims {
                dedicated_sum +=
                    rollout_rewards(&after_played, &probe_board, &mut rng)[mover_idx.min(3)];
            }
            let total_visits = root_child_visits as f64 + dedicated_sims as f64;
            played_q = Some((root_child_sum + dedicated_sum) / total_visits);
        } else {
            // Illegal history entry: do not invent a blunder.
            played_q = Some(best_q);
        }
    }

    candidate_actions.sort_by(|a, b| b.2.cmp(&a.2));

    let root_q = if tree[0].visits > 0 {
        tree[0].rewards[mover_idx.min(3)] / tree[0].visits as f64
    } else {
        0.5
    };

    let second_best_q = candidate_actions
        .iter()
        .filter(|(act, _, _)| act != &best_action)
        .map(|(_, q, _)| *q)
        .next()
        .unwrap_or(best_q);
    let gap_to_second = (best_q - second_best_q).max(0.0);

    MctsEvaluationResult {
        best_action,
        best_q,
        played_q,
        candidate_actions,
        root_q,
        gap_to_second,
    }
}

#[cfg(test)]
mod tests {
    use super::{heuristic_rewards, run_mcts_analysis, Prng};
    use crate::board::Board;
    use crate::types::{CellCoord, GameAction, GameState, GoalDirection, PlayerState};

    fn player(id: &str, row: i8, col: i8, goal: GoalDirection, walls: i32) -> PlayerState {
        PlayerState {
            id: id.to_string(),
            index: 0,
            display_name: id.to_string(),
            position: CellCoord { row, col },
            walls_remaining: walls,
            goal_direction: goal,
            status: "ACTIVE".to_string(),
        }
    }

    fn state_2p(current: usize) -> GameState {
        GameState {
            game_id: "test".to_string(),
            mode: "2p".to_string(),
            current_player_index: current,
            players: vec![
                player("p1", 7, 4, GoalDirection::Bottom, 10),
                player("p2", 1, 4, GoalDirection::Top, 10),
            ],
            walls: vec![],
            status: "IN_PROGRESS".to_string(),
        }
    }

    #[test]
    fn turn_tempo_breaks_a_symmetric_race() {
        let board = Board::new();
        let p1_to_move = heuristic_rewards(&state_2p(0), &board);
        let p2_to_move = heuristic_rewards(&state_2p(1), &board);
        assert!(p1_to_move[0] > 0.53);
        assert!((p1_to_move[0] + p1_to_move[1] - 1.0).abs() < 1e-9);
        assert!(p2_to_move[0] < 0.47);
    }

    #[test]
    fn extra_walls_are_worth_more_than_zero() {
        let board = Board::new();
        let mut with_walls = state_2p(0);
        with_walls.players[0].walls_remaining = 10;
        with_walls.players[1].walls_remaining = 2;
        let mut without = state_2p(0);
        without.players[0].walls_remaining = 2;
        without.players[1].walls_remaining = 2;
        assert!(heuristic_rewards(&with_walls, &board)[0] > heuristic_rewards(&without, &board)[0]);
    }

    #[test]
    fn played_action_is_always_measured() {
        let board = Board::new();
        let state = state_2p(0);
        let played = GameAction::Move {
            to: CellCoord { row: 6, col: 4 },
        };
        let result = run_mcts_analysis(&state, &board, &played, 160, 7);
        assert!(result.played_q.is_some());
        assert!(!result.candidate_actions.is_empty());
        assert!(result.best_q >= 0.0 && result.best_q <= 1.0);
    }

    #[test]
    fn prng_is_deterministic() {
        let mut a = Prng::new(9);
        let mut b = Prng::new(9);
        assert_eq!(a.next_u64(), b.next_u64());
        assert_eq!(a.next_f64(), b.next_f64());
    }
}
