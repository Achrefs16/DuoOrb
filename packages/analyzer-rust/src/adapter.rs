use crate::board::Board;
use crate::neural::{map_index_to_action, NeuralPrediction, ACTION_SPACE};
use crate::pathfinding::shortest_distance;
use crate::types::{GameAction, GameState, GoalDirection};

#[derive(Debug, Clone)]
pub struct AdaptedPrediction {
    pub policy_logits: Vec<f32>,
    pub policy_probs: Vec<f32>,
    pub value: f32,
}

#[inline(always)]
fn logits_from_probs(probs: &[f32]) -> Vec<f32> {
    probs
        .iter()
        .map(|&p| if p > 1e-9 { p.ln() } else { -20.0 })
        .collect()
}

/// Adapt a raw 2P neural prediction for the specific rules, goal coordinates, and dynamics
/// of Center Rush, Race mode, 4-Player FFA, or Classic.
pub fn adapt_prediction(state: &GameState, raw: &NeuralPrediction) -> AdaptedPrediction {
    let mode = state.mode.as_str();

    match mode {
        "center2" | "center3" => adapt_center_rush(state, raw),
        m if m.starts_with("race") => adapt_race_mode(state, raw),
        "4p" => adapt_four_player(state, raw),
        _ => adapt_classic_2p(state, raw),
    }
}

/// Adapt prediction for Classic 2P:
/// Ground the raw value with graph-theoretic shortest path truth.
/// Prevents the neural net from hallucinating that holding unplaced walls
/// saves a player who is 5-10 steps behind in the race.
fn adapt_classic_2p(state: &GameState, raw: &NeuralPrediction) -> AdaptedPrediction {
    let probs = raw.policy_probs.clone();
    let mover_idx = state.current_player_index;
    let board = Board::from_walls(&state.walls);
    let mover = match state.players.get(mover_idx) {
        Some(m) => m,
        None => return AdaptedPrediction { policy_logits: raw.policy_logits.clone(), policy_probs: probs, value: raw.value },
    };

    let cur_dist = shortest_distance(mover.position, mover.goal_direction, &board, &state.mode);
    let min_opp_dist = state
        .players
        .iter()
        .enumerate()
        .filter(|(i, p)| *i != mover_idx && p.status != "FINISHED")
        .map(|(_, p)| shortest_distance(p.position, p.goal_direction, &board, &state.mode))
        .min()
        .unwrap_or(8);

    if cur_dist <= 0 {
        return AdaptedPrediction { policy_logits: raw.policy_logits.clone(), policy_probs: probs, value: 1.0 };
    }
    if min_opp_dist <= 0 {
        return AdaptedPrediction { policy_logits: raw.policy_logits.clone(), policy_probs: probs, value: -1.0 };
    }

    // Effective walls: player cannot place more walls than opponent's steps to goal
    let eff_my_walls = (mover.walls_remaining as i32).min(min_opp_dist);
    let opp_walls = state.players.iter().enumerate()
        .filter(|(i, p)| *i != mover_idx && p.status != "FINISHED")
        .map(|(_, p)| (p.walls_remaining as i32).min(cur_dist))
        .min()
        .unwrap_or(0);
    let wall_delta = ((eff_my_walls - opp_walls) as f32) * 0.55;

    let lead = (min_opp_dist - cur_dist) as f32 + wall_delta;
    let heuristic_val = (lead / 3.2).tanh();

    let dist_gap = (min_opp_dist - cur_dist).abs();
    let blend_weight = if dist_gap >= 4 {
        0.80
    } else if dist_gap >= 2 {
        0.60
    } else {
        0.35
    };

    let adapted_value = (blend_weight * heuristic_val + (1.0 - blend_weight) * raw.value).clamp(-1.0, 1.0);

    AdaptedPrediction {
        policy_logits: raw.policy_logits.clone(),
        policy_probs: probs,
        value: adapted_value,
    }
}

/// Adapt prediction for Center Rush:
/// - Goal is the single center cell (4, 4).
/// - Pawn moves that step closer to (4, 4) receive a high directional boost.
/// - Value is re-anchored around the center distance differential between mover and rival.
fn adapt_center_rush(state: &GameState, raw: &NeuralPrediction) -> AdaptedPrediction {
    let mut probs = raw.policy_probs.clone();
    if state.players.is_empty() || probs.len() != ACTION_SPACE {
        return AdaptedPrediction {
            policy_logits: raw.policy_logits.clone(),
            policy_probs: probs,
            value: raw.value,
        };
    }

    let mover_idx = state.current_player_index;
    let mover = &state.players[mover_idx];
    let is_p2 = mover_idx == 1;
    let board = Board::from_walls(&state.walls);

    let cur_dist = shortest_distance(mover.position, GoalDirection::Center, &board, &state.mode);

    // Adjust the 8 pawn move candidates (indices 0..8)
    for action_idx in 0..8 {
        if let Some(GameAction::Move { to }) = map_index_to_action(state, action_idx, is_p2) {
            let next_dist = shortest_distance(to, GoalDirection::Center, &board, &state.mode);
            if next_dist < cur_dist {
                // Moving closer to center: boost prior x2.5
                probs[action_idx] *= 2.5;
            } else if next_dist == cur_dist {
                // Lateral move around obstacle: maintain prior
                probs[action_idx] *= 1.0;
            } else {
                // Moving away from center: heavily damp prior
                probs[action_idx] *= 0.15;
            }
        }
    }

    // Re-normalize probabilities so they sum to 1.0
    normalize_probs(&mut probs);

    // Re-anchor value: blend neural positional control with center-distance race delta
    let min_opp_dist = state
        .players
        .iter()
        .enumerate()
        .filter(|(i, _)| *i != mover_idx)
        .map(|(_, p)| shortest_distance(p.position, GoalDirection::Center, &board, &state.mode))
        .min()
        .unwrap_or(8);

    let race_delta = ((min_opp_dist - cur_dist) as f32) / 8.0;
    let adapted_value = (0.4 * raw.value + 0.6 * race_delta).clamp(-1.0, 1.0);

    let logits = logits_from_probs(&probs);
    AdaptedPrediction {
        policy_logits: logits,
        policy_probs: probs,
        value: adapted_value,
    }
}

/// Adapt prediction for Race Mode (race2, race3, race4):
/// - Players share the same goal direction.
/// - Pawn moves advancing toward the shared goal line receive a boost.
/// - Value re-anchored on race delta.
fn adapt_race_mode(state: &GameState, raw: &NeuralPrediction) -> AdaptedPrediction {
    let mut probs = raw.policy_probs.clone();
    if state.players.is_empty() || probs.len() != ACTION_SPACE {
        return AdaptedPrediction {
            policy_logits: raw.policy_logits.clone(),
            policy_probs: probs,
            value: raw.value,
        };
    }

    let mover_idx = state.current_player_index;
    let mover = &state.players[mover_idx];
    let is_p2 = mover_idx == 1;
    let board = Board::from_walls(&state.walls);

    let cur_dist = shortest_distance(mover.position, mover.goal_direction, &board, &state.mode);

    for action_idx in 0..8 {
        if let Some(GameAction::Move { to }) = map_index_to_action(state, action_idx, is_p2) {
            let next_dist = shortest_distance(to, mover.goal_direction, &board, &state.mode);
            if next_dist < cur_dist {
                probs[action_idx] *= 2.0;
            } else if next_dist > cur_dist {
                probs[action_idx] *= 0.2;
            }
        }
    }

    normalize_probs(&mut probs);

    let min_opp_dist = state
        .players
        .iter()
        .enumerate()
        .filter(|(i, _)| *i != mover_idx)
        .map(|(_, p)| shortest_distance(p.position, p.goal_direction, &board, &state.mode))
        .min()
        .unwrap_or(8);

    let race_delta = ((min_opp_dist - cur_dist) as f32) / 8.0;
    let adapted_value = (0.4 * raw.value + 0.6 * race_delta).clamp(-1.0, 1.0);

    let logits = logits_from_probs(&probs);
    AdaptedPrediction {
        policy_logits: logits,
        policy_probs: probs,
        value: adapted_value,
    }
}

/// Adapt prediction for 4-Player FFA:
/// - Evaluates threat matrix across all 3 opponents simultaneously.
fn adapt_four_player(state: &GameState, raw: &NeuralPrediction) -> AdaptedPrediction {
    let board = Board::from_walls(&state.walls);
    let mover_idx = state.current_player_index;
    let mover = match state.players.get(mover_idx) {
        Some(m) => m,
        None => {
            return AdaptedPrediction {
                policy_logits: raw.policy_logits.clone(),
                policy_probs: raw.policy_probs.clone(),
                value: raw.value,
            }
        }
    };

    let mover_dist = shortest_distance(mover.position, mover.goal_direction, &board, &state.mode);
    let min_rival_dist = state
        .players
        .iter()
        .enumerate()
        .filter(|(i, _)| *i != mover_idx)
        .map(|(_, p)| shortest_distance(p.position, p.goal_direction, &board, &state.mode))
        .min()
        .unwrap_or(8);

    // In 4-player FFA, if any rival is 1-2 steps from winning, emergency defense is required
    let threat_penalty = if min_rival_dist <= 2 && mover_dist > min_rival_dist {
        -0.4f32
    } else {
        0.0f32
    };

    let race_delta = ((min_rival_dist - mover_dist) as f32) / 8.0;
    let adapted_value = (0.5 * raw.value + 0.5 * race_delta + threat_penalty).clamp(-1.0, 1.0);

    let logits = raw.policy_logits.clone();
    AdaptedPrediction {
        policy_logits: logits,
        policy_probs: raw.policy_probs.clone(),
        value: adapted_value,
    }
}

#[inline(always)]
fn normalize_probs(probs: &mut [f32]) {
    let sum: f32 = probs.iter().sum();
    if sum > 0.0 {
        for p in probs.iter_mut() {
            *p /= sum;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{CellCoord, PlayerState};

    #[test]
    fn center_rush_adapts_pawn_moves_toward_center() {
        let state = GameState {
            game_id: "center-test".to_string(),
            mode: "center2".to_string(),
            current_player_index: 0,
            players: vec![
                PlayerState {
                    id: "p1".to_string(),
                    index: 0,
                    display_name: "P1".to_string(),
                    position: CellCoord { row: 8, col: 4 }, // Bottom center, moves up to (4,4)
                    walls_remaining: 5,
                    goal_direction: GoalDirection::Center,
                    status: "ACTIVE".to_string(),
                },
                PlayerState {
                    id: "p2".to_string(),
                    index: 1,
                    display_name: "P2".to_string(),
                    position: CellCoord { row: 0, col: 4 }, // Top center, moves down to (4,4)
                    walls_remaining: 5,
                    goal_direction: GoalDirection::Center,
                    status: "ACTIVE".to_string(),
                },
            ],
            walls: vec![],
            move_number: 0,
            status: "IN_PROGRESS".to_string(),
        };

        // Create uniform raw predictions
        let raw = NeuralPrediction {
            policy_logits: vec![0.0; ACTION_SPACE],
            policy_probs: vec![1.0 / ACTION_SPACE as f32; ACTION_SPACE],
            value: 0.0,
        };

        let adapted = adapt_prediction(&state, &raw);

        // Action index 0 is Up in SigmaQuoridor (advancing from row 8 towards row 7, closer to 4)
        // Action index 1 is Down (retreating from row 8 towards row 9, illegal / away)
        assert!(
            adapted.policy_probs[0] > adapted.policy_probs[1],
            "Move toward center must have higher probability than move away from center"
        );
        let sum: f32 = adapted.policy_probs.iter().sum();
        assert!((sum - 1.0).abs() < 1e-4, "Probabilities must sum to 1.0");
    }
}

