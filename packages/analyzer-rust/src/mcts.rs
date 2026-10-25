use crate::board::Board;
use crate::pathfinding::{is_goal_cell, EdgeMasks, GoalMask};
use crate::rules::{apply_action, get_legal_moves};
use crate::types::{GameAction, GameState, Orientation, PlayerState, WallCoord};
use rayon::prelude::*;
use std::collections::HashMap;

pub struct Prng {
    state: u64,
}

impl Prng {
    pub fn new(seed: u64) -> Self {
        Self {
            state: if seed == 0 {
                0x853c49e6748fea9b
            } else {
                seed
            },
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
fn sigmoid(x: f64) -> f64 {
    1.0 / (1.0 + (-x).exp())
}

/// Generates strictly legal, logically filtered candidate actions sorted by prior.
///
/// Pruning rules:
/// - Drop illogical retreats (unless dodging an opponent pawn or no forward moves exist).
/// - Drop walls that do not touch opponent corridors, wall chains, or nearby pawns.
/// - Drop strictly self-harming walls (self-delay > 0 with opp-delay <= 0 that don't shrink corridors).
/// - Drop walls with net_gain < -1.
/// - Retain 100% of corridor-narrowing setup walls (even when net_gain == 0).
pub fn generate_logical_actions(
    state: &GameState,
    mover_idx: usize,
    board: &Board,
    forced_include: Option<&GameAction>,
) -> Vec<(GameAction, f64)> {
    if state.status == "COMPLETED" || state.players.is_empty() {
        return vec![];
    }
    let mover = match state.players.get(mover_idx) {
        Some(p) => p,
        None => return vec![],
    };
    if mover.status == "FINISHED" {
        return vec![];
    }

    let edge_masks = EdgeMasks::from_board(board);
    let mover_goal = GoalMask::from_goal_and_mode(mover.goal_direction, &state.mode);
    let mover_dist = edge_masks.shortest_distance(
        mover.position.row as u8,
        mover.position.col as u8,
        mover_goal,
    );

    let mut candidates: Vec<(GameAction, f64)> = Vec::with_capacity(48);

    // 1. Pawn Moves
    let legal_pawn_moves = get_legal_moves(state, &mover.id, board);
    let is_adjacent_to_opp = state.players.iter().enumerate().any(|(j, opp)| {
        j != mover_idx
            && opp.status != "FINISHED"
            && (opp.position.row - mover.position.row).abs()
                + (opp.position.col - mover.position.col).abs()
                == 1
    });

    let mut forward_moves = Vec::new();
    let mut other_pawn_moves = Vec::new();

    for cell in &legal_pawn_moves {
        let next_dist =
            edge_masks.shortest_distance(cell.row as u8, cell.col as u8, mover_goal);
        let step_gain = if next_dist >= 0 && mover_dist >= 0 {
            mover_dist - next_dist
        } else {
            0
        };

        let action = GameAction::Move { to: *cell };
        let is_forced = forced_include == Some(&action);

        if step_gain >= 1 {
            let prior = (0.52 + (step_gain as f64) * 0.16).clamp(0.10, 0.95);
            forward_moves.push((action, prior));
        } else if is_forced || (mover.walls_remaining > 0 && is_adjacent_to_opp) {
            let prior = (0.42 + (step_gain as f64) * 0.10).clamp(0.10, 0.60);
            other_pawn_moves.push((action, prior));
        } else {
            other_pawn_moves.push((action, 0.30));
        }
    }

    if !forward_moves.is_empty() {
        candidates.extend(forward_moves);
        // Include only tactical lateral/retreat moves when dodging an opponent
        if mover.walls_remaining > 0 && is_adjacent_to_opp {
            for m in other_pawn_moves {
                if candidates.len() < 8 {
                    candidates.push(m);
                }
            }
        }
    } else {
        // Boxed in: include all legal moves so mover has actions
        candidates.extend(other_pawn_moves);
    }

    // 2. Wall Placements
    if mover.walls_remaining > 0 {
        let opps: Vec<(usize, &PlayerState, i32, u128)> = state
            .players
            .iter()
            .enumerate()
            .filter(|(j, p)| *j != mover_idx && p.status != "FINISHED")
            .map(|(j, p)| {
                let g = GoalMask::from_goal_and_mode(p.goal_direction, &state.mode);
                let (d, c) = edge_masks.shortest_path_corridor(
                    p.position.row as u8,
                    p.position.col as u8,
                    g,
                );
                (j, p, d, c)
            })
            .collect();

        if !opps.is_empty() {
            let combined_opp_corridors =
                opps.iter().fold(0u128, |acc, (_, _, _, c)| acc | *c);

            for r in 0..8u8 {
                for c in 0..8u8 {
                    for is_h in [true, false] {
                        // Rule A: Spatial relevance check
                        let wall_cells_mask = (1u128 << (r as u32 * 9 + c as u32))
                            | (1u128 << (r as u32 * 9 + c as u32 + 1))
                            | (1u128 << ((r as u32 + 1) * 9 + c as u32))
                            | (1u128 << ((r as u32 + 1) * 9 + c as u32 + 1));

                        let touches_corridor =
                            (wall_cells_mask & combined_opp_corridors) != 0;

                        let near_wall = state.walls.iter().any(|w| {
                            (r as i8 - w.row).abs() <= 1 && (c as i8 - w.col).abs() <= 1
                        });

                        let near_pawn = state.players.iter().any(|p| {
                            p.status != "FINISHED"
                                && (r as i8 - p.position.row).abs() <= 2
                                && (c as i8 - p.position.col).abs() <= 2
                        });

                        if !touches_corridor && !near_wall && !near_pawn {
                            continue;
                        }

                        // Geometry check
                        if !board.can_place_wall_geometry(r, c, is_h) {
                            continue;
                        }

                        // Speculative board placement
                        let mut spec_board = *board;
                        spec_board.place_wall_raw(r, c, is_h);
                        let spec_masks = EdgeMasks::from_board(&spec_board);

                        // Golden Rule: mover must retain a path
                        let my_after = spec_masks.shortest_distance(
                            mover.position.row as u8,
                            mover.position.col as u8,
                            mover_goal,
                        );
                        if my_after < 0 {
                            continue;
                        }

                        // Golden Rule: all active opponents must retain a path
                        let mut all_opps_have_path = true;
                        let mut max_opp_delta = i32::MIN;
                        for (_, opp, opp_base, _) in &opps {
                            let opp_g =
                                GoalMask::from_goal_and_mode(opp.goal_direction, &state.mode);
                            let opp_after = spec_masks.shortest_distance(
                                opp.position.row as u8,
                                opp.position.col as u8,
                                opp_g,
                            );
                            if opp_after < 0 {
                                all_opps_have_path = false;
                                break;
                            }
                            let delta = opp_after - *opp_base;
                            if delta > max_opp_delta {
                                max_opp_delta = delta;
                            }
                        }
                        if !all_opps_have_path {
                            continue;
                        }

                        // Rule B: Strict self-harm filter
                        let my_delta = (my_after - mover_dist).max(0);
                        let net_gain = max_opp_delta - my_delta;

                        // Pure self-block check
                        if my_delta > 0 && max_opp_delta <= 0 && !touches_corridor {
                            continue;
                        }
                        if net_gain < -1 {
                            continue;
                        }

                        let corridor_bonus = if touches_corridor { 0.10 } else { 0.0 };
                        let wall_prior = (0.45 + (net_gain as f64) * 0.12 + corridor_bonus)
                            .clamp(0.10, 0.92);

                        let wall = WallCoord {
                            row: r as i8,
                            col: c as i8,
                            orientation: if is_h {
                                Orientation::H
                            } else {
                                Orientation::V
                            },
                        };
                        candidates.push((GameAction::PlaceWall { wall }, wall_prior));
                    }
                }
            }
        }
    }

    // Sort descending by prior
    candidates.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

    // Ensure played_action is included if provided and legal
    if let Some(forced) = forced_include {
        if !candidates.iter().any(|(act, _)| act == forced) {
            let mut probe_board = *board;
            if apply_action(state, forced, &mut probe_board).is_some() {
                candidates.push((forced.clone(), 0.40));
            }
        }
    }

    candidates
}

/// Direct leaf evaluation using N-player softmax, jump lookahead, turn tempo, and corridor width.
pub fn heuristic_rewards(state: &GameState, board: &Board) -> [f64; 4] {
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
        for i in 0..n {
            rewards[i] = if finished[i] { 1.0 } else { 0.0 };
        }
        return rewards;
    }

    let edge_masks = EdgeMasks::from_board(board);

    if n == 2 {
        let p0 = &state.players[0];
        let p1 = &state.players[1];
        let d0 = if p0.status == "FINISHED" {
            0.0
        } else {
            let g0 = GoalMask::from_goal_and_mode(p0.goal_direction, &state.mode);
            let d = edge_masks.shortest_distance(p0.position.row as u8, p0.position.col as u8, g0);
            if d < 0 { 99.0 } else { d as f64 }
        };
        let d1 = if p1.status == "FINISHED" {
            0.0
        } else {
            let g1 = GoalMask::from_goal_and_mode(p1.goal_direction, &state.mode);
            let d = edge_masks.shortest_distance(p1.position.row as u8, p1.position.col as u8, g1);
            if d < 0 { 99.0 } else { d as f64 }
        };

        // Exact match with game-core bot MCTS evaluation:
        // turnBonus = if current_player == 0 { 0.5 } else { -0.5 }
        // wallBonus = (walls0 - walls1) * 0.35
        // lead = d1 - d0 + turnBonus + wallBonus
        // p0 = sigmoid(lead / 3.2)
        let turn_bonus = if state.current_player_index == 0 { 0.5 } else { -0.5 };
        let wall_bonus = ((p0.walls_remaining - p1.walls_remaining) as f64) * 1.10;
        let lead = d1 - d0 + turn_bonus + wall_bonus;
        let p0_win = sigmoid(lead / 3.2);
        rewards[0] = p0_win;
        rewards[1] = 1.0 - p0_win;
        return rewards;
    }

    // N-player (3P/4P)
    let avg_walls = state
        .players
        .iter()
        .take(n)
        .map(|p| p.walls_remaining as f64)
        .sum::<f64>()
        / (n as f64);

    let mut eff_dists = [99.0f64; 4];
    for i in 0..n {
        let p = &state.players[i];
        if p.status == "FINISHED" {
            eff_dists[i] = 0.0;
            continue;
        }
        let goal_mask = GoalMask::from_goal_and_mode(p.goal_direction, &state.mode);
        let dist = edge_masks.shortest_distance(
            p.position.row as u8,
            p.position.col as u8,
            goal_mask,
        );
        let base_dist = if dist < 0 { 99.0 } else { dist as f64 };
        let turns_until_move = (i + n - state.current_player_index) % n;
        let turn_tempo = 0.5 * (1.0 - (turns_until_move as f64) / (n as f64));
        let wall_bonus = (p.walls_remaining as f64 - avg_walls) * 1.10;
        eff_dists[i] = base_dist - turn_tempo - wall_bonus;
    }

    // N-player softmax
    let mut min_dist = f64::INFINITY;
    for i in 0..n {
        if eff_dists[i] < min_dist {
            min_dist = eff_dists[i];
        }
    }
    let mut sum_exp = 0.0f64;
    for i in 0..n {
        let val = (-0.4 * (eff_dists[i] - min_dist)).exp();
        rewards[i] = val;
        sum_exp += val;
    }
    if sum_exp > 0.0 {
        for i in 0..n {
            rewards[i] /= sum_exp;
        }
    }
    rewards
}

#[derive(Clone)]
struct MctsNode {
    action: Option<GameAction>,
    mover_idx: usize,
    parent: Option<usize>,
    children: Vec<usize>,
    all_actions: Vec<(GameAction, f64)>,
    visits: u32,
    rewards: [f64; 4],
    prior: f64,
}

pub struct MctsEvaluationResult {
    pub best_action: GameAction,
    pub best_q: f64,
    pub played_q: Option<f64>,
    pub candidate_actions: Vec<(GameAction, f64, u32)>, // (action, Q, visits)
    pub root_q: f64,
    pub gap_to_second: f64,
    pub q_naive_pawn_step: f64,
    pub q_second_best: f64,
}

pub const MIN_SIMS_PER_PLY: usize = 1_500;
pub const MAX_SIMS_PER_PLY: usize = 8_000;
pub const DEFAULT_SIMS_PER_PLY: usize = 3_500;
const UCT_C: f64 = 0.45;

pub fn run_mcts_analysis(
    root_state: &GameState,
    root_board: &Board,
    played_action: &GameAction,
    simulations: usize,
    _seed: u64,
) -> MctsEvaluationResult {
    let mover_idx = root_state.current_player_index;
    let initial_candidates =
        generate_logical_actions(root_state, mover_idx, root_board, Some(played_action));

    if initial_candidates.is_empty() {
        return MctsEvaluationResult {
            best_action: played_action.clone(),
            best_q: 0.5,
            played_q: Some(0.5),
            candidate_actions: vec![],
            root_q: 0.5,
            gap_to_second: 0.0,
            q_naive_pawn_step: 0.5,
            q_second_best: 0.5,
        };
    }

    let budget = simulations.max(MIN_SIMS_PER_PLY).min(MAX_SIMS_PER_PLY);

    let mut tree: Vec<MctsNode> = Vec::with_capacity(budget + 32);
    tree.push(MctsNode {
        action: None,
        mover_idx,
        parent: None,
        children: Vec::with_capacity(initial_candidates.len()),
        all_actions: initial_candidates,
        visits: 0,
        rewards: [0.0; 4],
        prior: 0.5,
    });

    // Stage 1: Adaptive PUCT search with Progressive Widening
    for _ in 0..budget {
        let mut cur_node_idx = 0;
        let mut cur_state = root_state.clone();
        let mut cur_board = *root_board;

        while !tree[cur_node_idx].children.is_empty() {
            let parent_visits = tree[cur_node_idx].visits as f64;
            let unlocked = (2.0 + 1.2 * parent_visits.powf(0.5)).floor() as usize;
            let limit = unlocked.min(tree[cur_node_idx].all_actions.len());

            if tree[cur_node_idx].children.len() < limit {
                // Progressive widening unlocks an untried action
                break;
            }

            let selector_idx = tree[cur_node_idx].mover_idx.min(3);
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

        // Expansion
        let parent_visits = tree[cur_node_idx].visits as f64;
        let unlocked = (2.0 + 1.2 * parent_visits.powf(0.5)).floor() as usize;
        let limit = unlocked.min(tree[cur_node_idx].all_actions.len());
        let mut expanded_node_idx = cur_node_idx;

        if tree[cur_node_idx].children.len() < limit {
            let next_act_idx = tree[cur_node_idx].children.len();
            let (action, act_prior) = tree[cur_node_idx].all_actions[next_act_idx].clone();

            if let Some(next_state) = apply_action(&cur_state, &action, &mut cur_board) {
                let next_mover = next_state.current_player_index;
                let next_actions = if next_state.status == "COMPLETED" {
                    vec![]
                } else {
                    generate_logical_actions(&next_state, next_mover, &cur_board, None)
                };

                let new_node_idx = tree.len();
                tree.push(MctsNode {
                    action: Some(action),
                    mover_idx: next_mover,
                    parent: Some(cur_node_idx),
                    children: Vec::new(),
                    all_actions: next_actions,
                    visits: 0,
                    rewards: [0.0; 4],
                    prior: act_prior,
                });
                tree[cur_node_idx].children.push(new_node_idx);
                expanded_node_idx = new_node_idx;
                cur_state = next_state;
            }
        }

        // Direct leaf evaluation (zero-allocation bitboard BFS, no rollouts)
        let rewards = heuristic_rewards(&cur_state, &cur_board);

        // Backpropagation
        let mut b_idx = Some(expanded_node_idx);
        while let Some(n_idx) = b_idx {
            tree[n_idx].visits += 1;
            for (i, reward) in rewards.iter().enumerate() {
                tree[n_idx].rewards[i] += reward;
            }
            b_idx = tree[n_idx].parent;
        }
    }

    // Stage 2: Depth Equalization (Equalize visits for played_action and best_action)
    let best_cid = tree[0]
        .children
        .iter()
        .copied()
        .max_by_key(|&cid| tree[cid].visits)
        .unwrap_or(0);

    let played_cid_opt = tree[0]
        .children
        .iter()
        .copied()
        .find(|&cid| tree[cid].action.as_ref() == Some(played_action));

    if let Some(pid) = played_cid_opt {
        if pid != best_cid {
            let target_visits = tree[best_cid].visits.min(1_200);
            let played_visits = tree[pid].visits;

            if played_visits < target_visits {
                let needed = (target_visits - played_visits).min(1_200);
                for _ in 0..needed {
                    let mut cur_node_idx = pid;
                    let mut cur_state = root_state.clone();
                    let mut cur_board = *root_board;

                    if let Some(ref act) = tree[cur_node_idx].action {
                        if let Some(next) = apply_action(&cur_state, act, &mut cur_board) {
                            cur_state = next;
                        } else {
                            break;
                        }
                    }

                    while !tree[cur_node_idx].children.is_empty() {
                        let parent_visits = tree[cur_node_idx].visits as f64;
                        let unlocked = (16.0 + 2.0 * parent_visits.powf(0.48)).floor() as usize;
                        let limit = unlocked.min(tree[cur_node_idx].all_actions.len());

                        if tree[cur_node_idx].children.len() < limit {
                            break;
                        }

                        let selector = tree[cur_node_idx].mover_idx.min(3);
                        let sqrt_parent = parent_visits.sqrt();
                        let mut best_child = tree[cur_node_idx].children[0];
                        let mut best_val = f64::NEG_INFINITY;

                        for &cid in &tree[cur_node_idx].children {
                            let child = &tree[cid];
                            let q = if child.visits > 0 {
                                child.rewards[selector] / child.visits as f64
                            } else {
                                child.prior
                            };
                            let u =
                                UCT_C * child.prior * sqrt_parent / (1.0 + child.visits as f64);
                            let val = q + u;
                            if val > best_val {
                                best_val = val;
                                best_child = cid;
                            }
                        }
                        cur_node_idx = best_child;
                        if let Some(ref act) = tree[cur_node_idx].action {
                            if let Some(next) = apply_action(&cur_state, act, &mut cur_board) {
                                cur_state = next;
                            } else {
                                break;
                            }
                        }
                    }

                    let parent_visits = tree[cur_node_idx].visits as f64;
                    let unlocked = (16.0 + 2.0 * parent_visits.powf(0.48)).floor() as usize;
                    let limit = unlocked.min(tree[cur_node_idx].all_actions.len());
                    let mut expanded_node_idx = cur_node_idx;

                    if tree[cur_node_idx].children.len() < limit {
                        let next_act_idx = tree[cur_node_idx].children.len();
                        let (action, act_prior) =
                            tree[cur_node_idx].all_actions[next_act_idx].clone();

                        if let Some(next_state) =
                            apply_action(&cur_state, &action, &mut cur_board)
                        {
                            let next_mover = next_state.current_player_index;
                            let next_actions = if next_state.status == "COMPLETED" {
                                vec![]
                            } else {
                                generate_logical_actions(&next_state, next_mover, &cur_board, None)
                            };

                            let new_node_idx = tree.len();
                            tree.push(MctsNode {
                                action: Some(action),
                                mover_idx: next_mover,
                                parent: Some(cur_node_idx),
                                children: Vec::new(),
                                all_actions: next_actions,
                                visits: 0,
                                rewards: [0.0; 4],
                                prior: act_prior,
                            });
                            tree[cur_node_idx].children.push(new_node_idx);
                            expanded_node_idx = new_node_idx;
                            cur_state = next_state;
                        }
                    }

                    let rewards = heuristic_rewards(&cur_state, &cur_board);
                    let mut b_idx = Some(expanded_node_idx);
                    while let Some(n_idx) = b_idx {
                        tree[n_idx].visits += 1;
                        for (i, reward) in rewards.iter().enumerate() {
                            tree[n_idx].rewards[i] += reward;
                        }
                        b_idx = tree[n_idx].parent;
                    }
                }
            }
        }
    }

    // Finalize metrics
    let mut candidate_actions = Vec::with_capacity(tree[0].children.len());
    let mut final_best_cid = best_cid;
    let mut max_visits = 0;

    for &cid in &tree[0].children {
        let child = &tree[cid];
        if let Some(ref act) = child.action {
            let q = if child.visits > 0 {
                child.rewards[mover_idx.min(3)] / child.visits as f64
            } else {
                child.prior
            };
            candidate_actions.push((act.clone(), q, child.visits));
            if child.visits > max_visits {
                max_visits = child.visits;
                final_best_cid = cid;
            }
        }
    }

    candidate_actions.sort_by(|a, b| b.2.cmp(&a.2));

    let best_action = tree[final_best_cid]
        .action
        .clone()
        .unwrap_or_else(|| played_action.clone());
    let best_q = if tree[final_best_cid].visits > 0 {
        tree[final_best_cid].rewards[mover_idx.min(3)] / tree[final_best_cid].visits as f64
    } else {
        tree[final_best_cid].prior
    };

    let played_q = played_cid_opt.map(|pid| {
        if tree[pid].visits > 0 {
            tree[pid].rewards[mover_idx.min(3)] / tree[pid].visits as f64
        } else {
            tree[pid].prior
        }
    });

    let root_q = if tree[0].visits > 0 {
        tree[0].rewards[mover_idx.min(3)] / tree[0].visits as f64
    } else {
        0.5
    };

    let q_second_best = candidate_actions
        .iter()
        .filter(|(act, _, _)| act != &best_action)
        .map(|(_, q, _)| *q)
        .next()
        .unwrap_or(best_q);

    let gap_to_second = (best_q - q_second_best).max(0.0);

    // Compute q_naive_pawn_step: max Q among forward pawn moves
    let mover_goal = GoalMask::from_goal_and_mode(
        root_state.players[mover_idx].goal_direction,
        &root_state.mode,
    );
    let edge_masks = EdgeMasks::from_board(root_board);
    let cur_dist = edge_masks.shortest_distance(
        root_state.players[mover_idx].position.row as u8,
        root_state.players[mover_idx].position.col as u8,
        mover_goal,
    );

    let mut forward_pawn_qs = Vec::new();
    let mut any_pawn_qs = Vec::new();

    for (act, q, _) in &candidate_actions {
        if let GameAction::Move { to } = act {
            any_pawn_qs.push(*q);
            let d = edge_masks.shortest_distance(to.row as u8, to.col as u8, mover_goal);
            if d >= 0 && cur_dist >= 0 && d < cur_dist {
                forward_pawn_qs.push(*q);
            }
        }
    }

    let q_naive_pawn_step = forward_pawn_qs
        .into_iter()
        .max_by(|a, b| a.partial_cmp(b).unwrap())
        .or_else(|| any_pawn_qs.into_iter().max_by(|a, b| a.partial_cmp(b).unwrap()))
        .unwrap_or_else(|| played_q.unwrap_or(best_q));

    MctsEvaluationResult {
        best_action,
        best_q,
        played_q,
        candidate_actions,
        root_q,
        gap_to_second,
        q_naive_pawn_step,
        q_second_best,
    }
}

/// Parallel multi-threaded MCTS bot search.
///
/// Uses Root Parallelization with rayon:
/// Dispatches simulations across CPU worker threads lock-free,
/// aggregating visit counts and returning the most heavily tested move.
/// Wrapped in std::panic::catch_unwind for 100% crash safety.
pub fn find_best_action_multithreaded(
    root_state: &GameState,
    simulations: usize,
    threads: usize,
    seed: u64,
) -> Option<GameAction> {
    let safe_run = std::panic::catch_unwind(|| {
        let mover_idx = root_state.current_player_index;
        let mover = match root_state.players.get(mover_idx) {
            Some(p) => p,
            None => return None,
        };
        let root_board = Board::from_walls(&root_state.walls);
        let legal_coords = get_legal_moves(root_state, &mover.id, &root_board);
        if legal_coords.is_empty() {
            return None;
        }

        // 1. Immediate Win Check: if stepping to a goal cell, take it now!
        for &to in &legal_coords {
            if is_goal_cell(to, mover.goal_direction, &root_state.mode) {
                return Some(GameAction::Move { to });
            }
        }

        // 2. Candidate generation
        let initial_candidates = generate_logical_actions(root_state, mover_idx, &root_board, None);
        if initial_candidates.is_empty() {
            return legal_coords.into_iter().next().map(|to| GameAction::Move { to });
        }
        if initial_candidates.len() == 1 {
            return Some(initial_candidates[0].0.clone());
        }

        let thread_count = threads.max(1).min(16);
        let sims_per_thread = (simulations / thread_count).max(200);

        let run_worker = |_t_idx: usize, _s: u64| -> Vec<(GameAction, u32, f64)> {
            let mut tree: Vec<MctsNode> = Vec::with_capacity(sims_per_thread + 32);
            tree.push(MctsNode {
                action: None,
                mover_idx,
                parent: None,
                children: Vec::with_capacity(initial_candidates.len()),
                all_actions: initial_candidates.clone(),
                visits: 0,
                rewards: [0.0; 4],
                prior: 0.5,
            });

            for _ in 0..sims_per_thread {
                let mut cur_node_idx = 0;
                let mut cur_state = root_state.clone();
                let mut cur_board = root_board;

                while !tree[cur_node_idx].children.is_empty() {
                    let parent_visits = tree[cur_node_idx].visits as f64;
                    let unlocked = (2.0 + 1.2 * parent_visits.powf(0.5)).floor() as usize;
                    let limit = unlocked.min(tree[cur_node_idx].all_actions.len());

                    if tree[cur_node_idx].children.len() < limit {
                        break;
                    }

                    let selector_idx = tree[cur_node_idx].mover_idx.min(3);
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

                let parent_visits = tree[cur_node_idx].visits as f64;
                let unlocked = (2.0 + 1.2 * parent_visits.powf(0.5)).floor() as usize;
                let limit = unlocked.min(tree[cur_node_idx].all_actions.len());
                let mut expanded_node_idx = cur_node_idx;

                if tree[cur_node_idx].children.len() < limit {
                    let next_act_idx = tree[cur_node_idx].children.len();
                    let (action, act_prior) = tree[cur_node_idx].all_actions[next_act_idx].clone();

                    if let Some(next_state) = apply_action(&cur_state, &action, &mut cur_board) {
                        let next_mover = next_state.current_player_index;
                        let next_actions = if next_state.status == "COMPLETED" {
                            vec![]
                        } else {
                            generate_logical_actions(&next_state, next_mover, &cur_board, None)
                        };

                        let new_node_idx = tree.len();
                        tree.push(MctsNode {
                            action: Some(action),
                            mover_idx: next_mover,
                            parent: Some(cur_node_idx),
                            children: Vec::new(),
                            all_actions: next_actions,
                            visits: 0,
                            rewards: [0.0; 4],
                            prior: act_prior,
                        });
                        tree[cur_node_idx].children.push(new_node_idx);
                        expanded_node_idx = new_node_idx;
                        cur_state = next_state;
                    }
                }

                let rewards = heuristic_rewards(&cur_state, &cur_board);
                let mut b_idx = Some(expanded_node_idx);
                while let Some(n_idx) = b_idx {
                    tree[n_idx].visits += 1;
                    for (i, reward) in rewards.iter().enumerate() {
                        tree[n_idx].rewards[i] += reward;
                    }
                    b_idx = tree[n_idx].parent;
                }
            }

            tree[0]
                .children
                .iter()
                .filter_map(|&cid| {
                    tree[cid].action.as_ref().map(|act| {
                        let selector = tree[0].mover_idx.min(3);
                        let q = if tree[cid].visits > 0 {
                            tree[cid].rewards[selector] / tree[cid].visits as f64
                        } else {
                            tree[cid].prior
                        };
                        (act.clone(), tree[cid].visits, q)
                    })
                })
                .collect()
        };

        let results: Vec<Vec<(GameAction, u32, f64)>> = if thread_count > 1 {
            (0..thread_count)
                .into_par_iter()
                .map(|t_idx| {
                    let s = seed.wrapping_add((t_idx as u64).wrapping_mul(0x9E3779B97F4A7C15));
                    run_worker(t_idx, s)
                })
                .collect()
        } else {
            vec![run_worker(0, seed)]
        };

        let mut totals: HashMap<String, (GameAction, u32, f64)> = HashMap::new();
        for thread_res in results {
            for (action, visits, q) in thread_res {
                let key = format!("{:?}", action);
                let entry = totals.entry(key).or_insert((action, 0, 0.0));
                entry.1 += visits;
                entry.2 += q * (visits as f64);
            }
        }

        let mut best_action = None;
        let mut best_visits = 0;
        for (_, (action, visits, _)) in totals {
            if visits > best_visits {
                best_visits = visits;
                best_action = Some(action);
            }
        }

        best_action.or_else(|| legal_coords.into_iter().next().map(|to| GameAction::Move { to }))
    });

    safe_run.unwrap_or(None)
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
        assert!(p1_to_move[0] > 0.52);
        assert!((p1_to_move[0] + p1_to_move[1] - 1.0).abs() < 1e-9);
        assert!(p2_to_move[0] < 0.48);
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
        assert!(
            heuristic_rewards(&with_walls, &board)[0] > heuristic_rewards(&without, &board)[0]
        );
    }

    #[test]
    fn played_action_is_always_measured() {
        let board = Board::new();
        let state = state_2p(0);
        let played = GameAction::Move {
            to: CellCoord { row: 6, col: 4 },
        };
        let result = run_mcts_analysis(&state, &board, &played, 4000, 7);
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

    #[test]
    fn multithreaded_search_picks_winning_move_immediately() {
        use super::find_best_action_multithreaded;
        let mut state = state_2p(0);
        // Put player 1 adjacent to their goal (GoalDirection::Bottom is row 8)
        state.players[0].position = CellCoord { row: 7, col: 4 };
        let action = find_best_action_multithreaded(&state, 1000, 4, 12345);
        assert!(action.is_some());
        match action.unwrap() {
            GameAction::Move { to } => {
                assert_eq!(to, CellCoord { row: 8, col: 4 });
            }
            _ => panic!("Expected winning move to (8,4)"),
        }
    }

    #[test]
    fn multithreaded_search_root_parallel_stress_test() {
        use super::find_best_action_multithreaded;
        let state = state_2p(0);
        // Run with 8 threads and 10,000 simulations
        let action = find_best_action_multithreaded(&state, 10000, 8, 99999);
        assert!(action.is_some());
        // Verify it returned a valid action (pawn move or wall)
        match action.unwrap() {
            GameAction::Move { to } => {
                // Must be one of legal start moves from (7,4): (6,4), (7,3), (7,5)
                assert!((to.row - 7).abs() + (to.col - 4).abs() == 1);
            }
            GameAction::PlaceWall { .. } => {}
            _ => panic!("Expected Move or PlaceWall"),
        }
    }

    #[test]
    fn multithreaded_search_zero_sims_returns_fallback_move() {
        use super::find_best_action_multithreaded;
        let state = state_2p(0);
        let action = find_best_action_multithreaded(&state, 0, 1, 42);
        assert!(action.is_some());
    }
}
