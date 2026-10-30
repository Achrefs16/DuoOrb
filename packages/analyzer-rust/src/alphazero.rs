use std::collections::HashMap;

use crate::board::Board;
use crate::neural::NeuralEvaluator;
use crate::pathfinding::{compute_player_path_edges, is_goal_cell};
use crate::rules::{apply_action, is_legal_wall_fast};
use crate::types::{GameAction, GameState};

pub struct AzNode {
    pub state: GameState,
    pub mover_idx: usize,
    pub is_terminal: bool,
    pub terminal_value: f32,
    pub actions: Vec<GameAction>,
    pub priors: Vec<f32>,
    pub visits: Vec<u32>,
    pub values: Vec<f32>,
    pub children: Vec<Option<usize>>,
}

#[inline]
pub fn compute_2p_state_hash(state: &GameState, board: &Board) -> u64 {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    std::hash::Hash::hash(&board.h_walls, &mut hasher);
    std::hash::Hash::hash(&board.v_walls, &mut hasher);
    if let Some(p1) = state.players.first() {
        std::hash::Hash::hash(&p1.position, &mut hasher);
        std::hash::Hash::hash(&p1.walls_remaining, &mut hasher);
    }
    if let Some(p2) = state.players.get(1) {
        std::hash::Hash::hash(&p2.position, &mut hasher);
        std::hash::Hash::hash(&p2.walls_remaining, &mut hasher);
    }
    std::hash::Hash::hash(&state.current_player_index, &mut hasher);
    std::hash::Hasher::finish(&hasher)
}

#[derive(Debug, Clone)]
pub struct AlphaZeroRankedAction {
    pub action: GameAction,
    pub win_prob: f32,
    pub visits: u32,
    pub q: f32,
}

/// Pure AlphaZero Monte Carlo Tree Search (Zero Handcrafted Biases).
/// Evaluates states using both the policy head P(s, a) and value head V(s) from quoridor_9x9.onnx.
/// Uses Transposition Caching, Path-Edge Fast-Reject, and Neural Prior Pruning for high performance.
pub fn run_alphazero_mcts_ranked(
    evaluator: &NeuralEvaluator,
    root_state: &GameState,
    simulations: usize,
    c_puct: f32,
) -> Vec<AlphaZeroRankedAction> {
    let mover_idx = root_state.current_player_index;
    let mover = match root_state.players.get(mover_idx) {
        Some(p) => p,
        None => return vec![],
    };

    // 1. Immediate win check: if any legal pawn move reaches the goal, play it immediately
    let root_board = Board::from_walls(&root_state.walls);
    let legal_pawn_moves = crate::rules::get_legal_moves(root_state, &mover.id, &root_board);
    for to in &legal_pawn_moves {
        if is_goal_cell(*to, mover.goal_direction, &root_state.mode) {
            return vec![AlphaZeroRankedAction {
                action: GameAction::Move { to: *to },
                win_prob: 0.99,
                visits: simulations as u32,
                q: 0.99,
            }];
        }
    }

    // 2. Transposition cache for neural forward passes: StateHash -> (PolicyProbs, Value)
    let mut trans_table: HashMap<u64, (Vec<f32>, f32)> = HashMap::with_capacity(simulations + 16);

    // 3. Evaluate root state
    let root_pred = match evaluator.evaluate(root_state) {
        Ok(p) => p,
        Err(_) => return vec![],
    };
    let root_hash = compute_2p_state_hash(root_state, &root_board);
    trans_table.insert(root_hash, (root_pred.policy_probs.clone(), root_pred.value));

    let is_p2 = mover_idx == 1;
    let mut legal_actions = Vec::new();
    let mut priors = Vec::new();

    // Precompute shortest-path edges for fast wall validation
    let p1_edges = compute_player_path_edges(
        root_state.players[0].position,
        root_state.players[0].goal_direction,
        &root_board,
        &root_state.mode,
    );
    let p2_edges = compute_player_path_edges(
        root_state.players[1].position,
        root_state.players[1].goal_direction,
        &root_board,
        &root_state.mode,
    );
    let root_path_edges = [p1_edges, p2_edges];

    for (action_idx, &prior) in root_pred.policy_probs.iter().enumerate() {
        if action_idx < 8 {
            if let Some(action) = crate::neural::map_index_to_action(root_state, action_idx, is_p2) {
                if let GameAction::Move { to } = action {
                    if legal_pawn_moves.contains(&to) {
                        legal_actions.push(action);
                        priors.push(prior);
                    }
                }
            }
        } else if mover.walls_remaining > 0 && prior > 0.001 {
            if let Some(action) = crate::neural::map_index_to_action(root_state, action_idx, is_p2) {
                if let GameAction::PlaceWall { ref wall } = action {
                    if is_legal_wall_fast(root_state, &mover.id, wall, &root_board, &root_path_edges) {
                        legal_actions.push(action);
                        priors.push(prior);
                    }
                }
            }
        }
    }

    if legal_actions.is_empty() {
        return vec![];
    }
    if legal_actions.len() == 1 {
        return vec![AlphaZeroRankedAction {
            action: legal_actions.remove(0),
            win_prob: 0.50,
            visits: simulations as u32,
            q: 0.0,
        }];
    }

    // Normalize priors
    let total_prior: f32 = priors.iter().sum();
    if total_prior > 0.0 {
        for p in &mut priors {
            *p /= total_prior;
        }
    }

    let action_count = legal_actions.len();
    let root_node = AzNode {
        state: root_state.clone(),
        mover_idx,
        is_terminal: false,
        terminal_value: 0.0,
        actions: legal_actions,
        priors,
        visits: vec![0; action_count],
        values: vec![0.0; action_count],
        children: vec![None; action_count],
    };

    let mut tree: Vec<AzNode> = Vec::with_capacity(simulations + 4);
    tree.push(root_node);

    for _ in 0..simulations {
        // Step A: Selection down the tree via PUCT
        let mut cur_node_idx = 0;
        let mut path: Vec<(usize, usize)> = Vec::with_capacity(16);

        loop {
            let node = &tree[cur_node_idx];
            if node.is_terminal {
                break;
            }

            let sum_n: u32 = node.visits.iter().sum();
            let sqrt_n = (sum_n as f32 + 1.0).sqrt();

            let mut best_action_idx = 0;
            let mut best_puct = f32::NEG_INFINITY;

            for i in 0..node.actions.len() {
                let n = node.visits[i];
                let q = if n > 0 {
                    node.values[i] / (n as f32)
                } else {
                    0.0
                };
                let u = c_puct * node.priors[i] * sqrt_n / (1.0 + n as f32);
                let score = q + u;
                if score > best_puct {
                    best_puct = score;
                    best_action_idx = i;
                }
            }

            path.push((cur_node_idx, best_action_idx));

            if let Some(child_idx) = tree[cur_node_idx].children[best_action_idx] {
                cur_node_idx = child_idx;
            } else {
                break;
            }
        }

        // Step B: Expand leaf & evaluate
        let leaf_value_for_cur_mover: f32;
        let (parent_idx, action_idx) = *path.last().unwrap();
        let parent = &tree[parent_idx];

        if parent.is_terminal {
            leaf_value_for_cur_mover = parent.terminal_value;
        } else {
            let action = &parent.actions[action_idx];
            let mut scratch_board = Board::from_walls(&parent.state.walls);
            let next_state_opt = apply_action(&parent.state, action, &mut scratch_board);

            if let Some(next_state) = next_state_opt {
                if next_state.status == "COMPLETED" {
                    let child_idx = tree.len();
                    tree.push(AzNode {
                        state: next_state,
                        mover_idx: 1 - parent.mover_idx,
                        is_terminal: true,
                        terminal_value: -1.0,
                        actions: Vec::new(),
                        priors: Vec::new(),
                        visits: Vec::new(),
                        values: Vec::new(),
                        children: Vec::new(),
                    });
                    tree[parent_idx].children[action_idx] = Some(child_idx);
                    leaf_value_for_cur_mover = 1.0;
                } else {
                    let next_mover_idx = next_state.current_player_index;
                    let is_next_p2 = next_mover_idx == 1;
                    let child_board = Board::from_walls(&next_state.walls);
                    let state_hash = compute_2p_state_hash(&next_state, &child_board);

                    // Query or populate transposition table
                    let (child_actions, child_priors, next_mover_value) = if let Some(cached) = trans_table.get(&state_hash) {
                        let mut acts = Vec::new();
                        let mut prs = Vec::new();
                        let next_mover = &next_state.players[next_mover_idx];
                        let p1_e = compute_player_path_edges(
                            next_state.players[0].position,
                            next_state.players[0].goal_direction,
                            &child_board,
                            &next_state.mode,
                        );
                        let p2_e = compute_player_path_edges(
                            next_state.players[1].position,
                            next_state.players[1].goal_direction,
                            &child_board,
                            &next_state.mode,
                        );
                        let path_e = [p1_e, p2_e];
                        let legal_pawns = crate::rules::get_legal_moves(&next_state, &next_mover.id, &child_board);

                        for (a_idx, &p) in cached.0.iter().enumerate() {
                            if a_idx < 8 {
                                if let Some(act) = crate::neural::map_index_to_action(&next_state, a_idx, is_next_p2) {
                                    if let GameAction::Move { to } = act {
                                        if legal_pawns.contains(&to) {
                                            acts.push(act);
                                            prs.push(p);
                                        }
                                    }
                                }
                            } else if next_mover.walls_remaining > 0 && p > 0.002 {
                                if let Some(act) = crate::neural::map_index_to_action(&next_state, a_idx, is_next_p2) {
                                    if let GameAction::PlaceWall { ref wall } = act {
                                        if is_legal_wall_fast(&next_state, &next_mover.id, wall, &child_board, &path_e) {
                                            acts.push(act);
                                            prs.push(p);
                                        }
                                    }
                                }
                            }
                        }
                        let total_p: f32 = prs.iter().sum();
                        if total_p > 0.0 {
                            for p in &mut prs {
                                *p /= total_p;
                            }
                        }
                        (acts, prs, cached.1)
                    } else {
                        match evaluator.evaluate(&next_state) {
                            Ok(pred) => {
                                trans_table.insert(state_hash, (pred.policy_probs.clone(), pred.value));
                                let mut acts = Vec::new();
                                let mut prs = Vec::new();
                                let next_mover = &next_state.players[next_mover_idx];
                                let p1_e = compute_player_path_edges(
                                    next_state.players[0].position,
                                    next_state.players[0].goal_direction,
                                    &child_board,
                                    &next_state.mode,
                                );
                                let p2_e = compute_player_path_edges(
                                    next_state.players[1].position,
                                    next_state.players[1].goal_direction,
                                    &child_board,
                                    &next_state.mode,
                                );
                                let path_e = [p1_e, p2_e];
                                let legal_pawns = crate::rules::get_legal_moves(&next_state, &next_mover.id, &child_board);

                                for (a_idx, &p) in pred.policy_probs.iter().enumerate() {
                                    if a_idx < 8 {
                                        if let Some(act) = crate::neural::map_index_to_action(&next_state, a_idx, is_next_p2) {
                                            if let GameAction::Move { to } = act {
                                                if legal_pawns.contains(&to) {
                                                    acts.push(act);
                                                    prs.push(p);
                                                }
                                            }
                                        }
                                    } else if next_mover.walls_remaining > 0 && p > 0.002 {
                                        if let Some(act) = crate::neural::map_index_to_action(&next_state, a_idx, is_next_p2) {
                                            if let GameAction::PlaceWall { ref wall } = act {
                                                if is_legal_wall_fast(&next_state, &next_mover.id, wall, &child_board, &path_e) {
                                                    acts.push(act);
                                                    prs.push(p);
                                                }
                                            }
                                        }
                                    }
                                }
                                let total_p: f32 = prs.iter().sum();
                                if total_p > 0.0 {
                                    for p in &mut prs {
                                        *p /= total_p;
                                    }
                                }
                                (acts, prs, pred.value)
                            }
                            Err(_) => (Vec::new(), Vec::new(), 0.0),
                        }
                    };

                    let child_act_count = child_actions.len();
                    let child_idx = tree.len();
                    tree.push(AzNode {
                        state: next_state,
                        mover_idx: next_mover_idx,
                        is_terminal: child_act_count == 0,
                        terminal_value: 0.0,
                        actions: child_actions,
                        priors: child_priors,
                        visits: vec![0; child_act_count],
                        values: vec![0.0; child_act_count],
                        children: vec![None; child_act_count],
                    });
                    tree[parent_idx].children[action_idx] = Some(child_idx);
                    leaf_value_for_cur_mover = -next_mover_value;
                }
            } else {
                leaf_value_for_cur_mover = -1.0;
            }
        }

        // Step C: Backpropagate along path
        let mut value_to_backprop = leaf_value_for_cur_mover;
        let mut last_mover = tree[parent_idx].mover_idx;

        for &(n_idx, a_idx) in path.iter().rev() {
            let cur_mover = tree[n_idx].mover_idx;
            if cur_mover != last_mover {
                value_to_backprop = -value_to_backprop;
                last_mover = cur_mover;
            }
            tree[n_idx].visits[a_idx] += 1;
            tree[n_idx].values[a_idx] += value_to_backprop;
        }
    }

    // Step D: Return ranked root actions sorted by visit count
    let root = &tree[0];
    let mut ranked: Vec<AlphaZeroRankedAction> = Vec::with_capacity(root.actions.len());

    for i in 0..root.actions.len() {
        let visits = root.visits[i];
        let q = if visits > 0 {
            (root.values[i] / visits as f32).clamp(-1.0, 1.0)
        } else {
            0.0
        };
        let win_prob = ((q + 1.0) * 0.5).clamp(0.02, 0.98);
        ranked.push(AlphaZeroRankedAction {
            action: root.actions[i].clone(),
            win_prob,
            visits,
            q,
        });
    }

    ranked.sort_by(|a, b| {
        b.visits
            .cmp(&a.visits)
            .then_with(|| b.win_prob.partial_cmp(&a.win_prob).unwrap_or(std::cmp::Ordering::Equal))
    });
    ranked
}

/// Helper that returns the single top-ranked action for Milo bot play.
pub fn run_alphazero_mcts(
    evaluator: &NeuralEvaluator,
    root_state: &GameState,
    simulations: usize,
    c_puct: f32,
) -> GameAction {
    let ranked = run_alphazero_mcts_ranked(evaluator, root_state, simulations, c_puct);
    ranked
        .into_iter()
        .next()
        .map(|r| r.action)
        .unwrap_or(GameAction::Resign)
}
