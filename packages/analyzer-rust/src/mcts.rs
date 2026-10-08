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
        h = h.wrapping_mul(0x100000001b3) ^ (match w.orientation {
            Orientation::H => 1,
            Orientation::V => 2,
        });
    }
    h
}

pub fn find_path_blocking_walls(
    state: &GameState,
    actor_id: &str,
    target_idx: usize,
    board: &Board,
    horizon: usize,
) -> Vec<WallCoord> {
    let target = &state.players[target_idx];
    let base_dist = shortest_distance(target.position, target.goal_direction, board, &state.mode);
    if base_dist <= 0 {
        return vec![];
    }

    let path = match shortest_path(target.position, target.goal_direction, board, &state.mode) {
        Some(p) => p,
        None => return vec![],
    };

    let mut candidates = Vec::with_capacity(32);
    let mut seen = HashSet::new();

    let mut add = |w: WallCoord| {
        if w.row >= 0 && w.row < 8 && w.col >= 0 && w.col < 8 {
            if seen.insert(w) {
                candidates.push(w);
            }
        }
    };

    // Bordering target pawn
    let (tr, tc) = (target.position.row, target.position.col);
    add(WallCoord { row: tr - 1, col: tc, orientation: Orientation::H });
    add(WallCoord { row: tr, col: tc, orientation: Orientation::H });
    add(WallCoord { row: tr, col: tc - 1, orientation: Orientation::V });
    add(WallCoord { row: tr, col: tc, orientation: Orientation::V });

    // Path crossing slots
    let steps = path.len().min(horizon.max(2));
    let mut cur = target.position;
    for i in 0..steps {
        let next = path[i];
        if next.row == cur.row + 1 {
            add(WallCoord { row: cur.row, col: cur.col, orientation: Orientation::H });
            add(WallCoord { row: cur.row, col: cur.col - 1, orientation: Orientation::H });
        } else if next.row == cur.row - 1 {
            add(WallCoord { row: next.row, col: cur.col, orientation: Orientation::H });
            add(WallCoord { row: next.row, col: cur.col - 1, orientation: Orientation::H });
        } else if next.col == cur.col + 1 {
            add(WallCoord { row: cur.row, col: cur.col, orientation: Orientation::V });
            add(WallCoord { row: cur.row - 1, col: cur.col, orientation: Orientation::V });
        } else if next.col == cur.col - 1 {
            add(WallCoord { row: cur.row, col: next.col, orientation: Orientation::V });
            add(WallCoord { row: cur.row - 1, col: next.col, orientation: Orientation::V });
        }
        cur = next;
    }

    let mut valid_blocks = Vec::with_capacity(candidates.len());
    for slot in candidates {
        if is_legal_wall_placement(state, actor_id, &slot, board) {
            let mut test_board = *board;
            test_board.place_wall(&slot);
            let after = shortest_distance(target.position, target.goal_direction, &test_board, &state.mode);
            if after > base_dist {
                valid_blocks.push(slot);
            }
        }
    }

    valid_blocks
}

pub fn get_mcts_actions(
    state: &GameState,
    mover_idx: usize,
    board: &Board,
    wall_horizon: usize,
) -> Vec<GameAction> {
    let mover = &state.players[mover_idx];
    let mut actions = Vec::with_capacity(40);

    // 1. Legal pawn moves
    for cell in get_legal_moves(state, &mover.id, board) {
        actions.push(GameAction::Move { to: cell });
    }

    // 2. Wall placements (if walls remain)
    if mover.walls_remaining > 0 {
        // Critical threat: if any opponent is 1-step from goal, prioritize blocking them!
        let critical_foe_idx = state.players.iter().enumerate().position(|(idx, p)| {
            idx != mover_idx
                && p.status != "FINISHED"
                && shortest_distance(p.position, p.goal_direction, board, &state.mode) == 1
        });

        if let Some(foe_idx) = critical_foe_idx {
            let blocks = find_path_blocking_walls(state, &mover.id, foe_idx, board, wall_horizon);
            for w in blocks {
                actions.push(GameAction::PlaceWall { wall: w });
            }
        } else {
            // General strategic walls
            let mut seen_walls = HashSet::new();

            // Walls around own pawn
            let (mr, mc) = (mover.position.row, mover.position.col);
            let touch_slots = [
                WallCoord { row: mr - 1, col: mc, orientation: Orientation::H },
                WallCoord { row: mr, col: mc, orientation: Orientation::H },
                WallCoord { row: mr, col: mc - 1, orientation: Orientation::V },
                WallCoord { row: mr, col: mc, orientation: Orientation::V },
            ];
            for w in touch_slots {
                if w.row >= 0 && w.row < 8 && w.col >= 0 && w.col < 8 {
                    if seen_walls.insert(w) && is_legal_wall_placement(state, &mover.id, &w, board) {
                        actions.push(GameAction::PlaceWall { wall: w });
                    }
                }
            }

            // Path blocking walls for opponents
            for (idx, foe) in state.players.iter().enumerate() {
                if idx == mover_idx || foe.status == "FINISHED" {
                    continue;
                }
                let blocks = find_path_blocking_walls(state, &mover.id, idx, board, wall_horizon);
                for w in blocks.into_iter().take(8) {
                    if seen_walls.insert(w) {
                        actions.push(GameAction::PlaceWall { wall: w });
                    }
                }
            }
        }
    }

    actions
}

#[derive(Clone)]
struct MctsNode {
    action: Option<GameAction>,
    #[allow(dead_code)]
    mover_idx: usize,
    parent: Option<usize>,
    children: Vec<usize>,
    untried_actions: Vec<GameAction>,
    visits: u32,
    total_reward: f64,
}

pub struct MctsEvaluationResult {
    pub best_action: GameAction,
    pub best_q: f64,
    pub played_q: Option<f64>,
    pub candidate_actions: Vec<(GameAction, f64, u32)>, // (action, Q, visits)
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

    let initial_actions = get_mcts_actions(root_state, mover_idx, root_board, 8);
    if initial_actions.is_empty() {
        return MctsEvaluationResult {
            best_action: played_action.clone(),
            best_q: 0.5,
            played_q: Some(0.5),
            candidate_actions: vec![],
        };
    }

    let mut tree: Vec<MctsNode> = Vec::with_capacity(simulations + 10);
    tree.push(MctsNode {
        action: None,
        mover_idx,
        parent: None,
        children: Vec::with_capacity(initial_actions.len()),
        untried_actions: initial_actions,
        visits: 0,
        total_reward: 0.0,
    });

    const UCT_C: f64 = 0.45;

    for _ in 0..simulations {
        // 1. Selection
        let mut cur_node_idx = 0;
        let mut cur_state = root_state.clone();
        let mut cur_board = *root_board;

        while tree[cur_node_idx].untried_actions.is_empty() && !tree[cur_node_idx].children.is_empty() {
            let parent_visits = tree[cur_node_idx].visits as f64;
            let log_parent = parent_visits.ln();

            let mut best_child_idx = tree[cur_node_idx].children[0];
            let mut best_uct = -1e9;

            for &child_idx in &tree[cur_node_idx].children {
                let child = &tree[child_idx];
                let q = if child.visits > 0 {
                    child.total_reward / child.visits as f64
                } else {
                    0.5
                };
                let uct = q + UCT_C * (log_parent / (child.visits.max(1) as f64)).sqrt();
                if uct > best_uct {
                    best_uct = uct;
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

        // 2. Expansion
        let mut expanded_node_idx = cur_node_idx;
        if !tree[cur_node_idx].untried_actions.is_empty() {
            let untried_len = tree[cur_node_idx].untried_actions.len();
            let pick_idx = rng.gen_range(0, untried_len);
            let action = tree[cur_node_idx].untried_actions.swap_remove(pick_idx);

            if let Some(next_state) = apply_action(&cur_state, &action, &mut cur_board) {
                cur_state = next_state;
                let next_mover = cur_state.current_player_index;
                let next_actions = get_mcts_actions(&cur_state, next_mover, &cur_board, 6);

                let new_node_idx = tree.len();
                tree.push(MctsNode {
                    action: Some(action),
                    mover_idx: next_mover,
                    parent: Some(cur_node_idx),
                    children: Vec::new(),
                    untried_actions: next_actions,
                    visits: 0,
                    total_reward: 0.0,
                });
                tree[cur_node_idx].children.push(new_node_idx);
                expanded_node_idx = new_node_idx;
            }
        }

        // 3. Rollout / Simulation
        let mut sim_state = cur_state;
        let mut sim_board = cur_board;
        let mut rollout_depth = 0;
        let max_rollout = 16;
        let mut terminal_winner: Option<usize> = None;

        // Check if already won
        for (idx, p) in sim_state.players.iter().enumerate() {
            if is_goal_cell(p.position, p.goal_direction, &sim_state.mode) {
                terminal_winner = Some(idx);
                break;
            }
        }

        while terminal_winner.is_none() && rollout_depth < max_rollout {
            let active_mover = sim_state.current_player_index;
            let p = &sim_state.players[active_mover];
            if is_goal_cell(p.position, p.goal_direction, &sim_state.mode) {
                terminal_winner = Some(active_mover);
                break;
            }

            // High-probability shortest path step
            let legals = get_legal_moves(&sim_state, &p.id, &sim_board);
            if legals.is_empty() {
                break;
            }

            // Find move along shortest path
            let path_opt = shortest_path(p.position, p.goal_direction, &sim_board, &sim_state.mode);
            let chosen_action = if let Some(path) = path_opt {
                if !path.is_empty() && legals.contains(&path[0]) && rng.next_f64() < 0.80 {
                    GameAction::Move { to: path[0] }
                } else {
                    let r = rng.gen_range(0, legals.len());
                    GameAction::Move { to: legals[r] }
                }
            } else {
                let r = rng.gen_range(0, legals.len());
                GameAction::Move { to: legals[r] }
            };

            if let Some(next) = apply_action(&sim_state, &chosen_action, &mut sim_board) {
                sim_state = next;
                rollout_depth += 1;
            } else {
                break;
            }
        }

        // Evaluation score from the perspective of root mover
        let reward: f64 = if let Some(winner) = terminal_winner {
            if winner == mover_idx { 1.0 } else { 0.0 }
        } else {
            // Heuristic standing at rollout end
            let my_dist = shortest_distance(
                sim_state.players[mover_idx].position,
                sim_state.players[mover_idx].goal_direction,
                &sim_board,
                &sim_state.mode,
            ).max(1);

            let opp_idx = (mover_idx + 1) % sim_state.players.len();
            let opp_dist = shortest_distance(
                sim_state.players[opp_idx].position,
                sim_state.players[opp_idx].goal_direction,
                &sim_board,
                &sim_state.mode,
            ).max(1);

            let lead = (opp_dist - my_dist) as f64;
            // Sigmoid normalized reward
            1.0 / (1.0 + (-lead / 2.5).exp())
        };

        // 4. Backpropagation
        let mut b_idx = Some(expanded_node_idx);
        while let Some(n_idx) = b_idx {
            tree[n_idx].visits += 1;
            tree[n_idx].total_reward += reward;
            b_idx = tree[n_idx].parent;
        }
    }

    // Inspect root children to find best action and played action
    let mut candidate_actions = Vec::with_capacity(tree[0].children.len());
    let mut best_action_opt: Option<GameAction> = None;
    let mut best_visits = 0u32;
    let mut best_q = 0.5;
    let mut played_q: Option<f64> = None;

    for &child_idx in &tree[0].children {
        let child = &tree[child_idx];
        if let Some(ref act) = child.action {
            let q = if child.visits > 0 {
                child.total_reward / child.visits as f64
            } else {
                0.5
            };

            candidate_actions.push((act.clone(), q, child.visits));

            if child.visits > best_visits {
                best_visits = child.visits;
                best_action_opt = Some(act.clone());
                best_q = q;
            }

            if act == played_action {
                played_q = Some(q);
            }
        }
    }

    let best_action = best_action_opt.unwrap_or_else(|| played_action.clone());

    MctsEvaluationResult {
        best_action,
        best_q,
        played_q,
        candidate_actions,
    }
}
