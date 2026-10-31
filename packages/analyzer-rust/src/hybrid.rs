use std::sync::OnceLock;

use crate::adapter::adapt_prediction;
use crate::neural::{map_index_to_action, NeuralEvaluator};
use crate::rules::is_legal_action;
use crate::solver::solve_tactical_position;
use crate::types::{GameAction, GameState};

static EXPLICIT_EVALUATOR: OnceLock<Option<NeuralEvaluator>> = OnceLock::new();
static GLOBAL_NEURAL_EVALUATOR: OnceLock<Option<NeuralEvaluator>> = OnceLock::new();

/// Explicitly configure the global evaluator (e.g. from WebAssembly in-memory byte slice).
pub fn set_global_evaluator(evaluator: NeuralEvaluator) {
    let _ = EXPLICIT_EVALUATOR.set(Some(evaluator));
}

/// Returns the global NeuralEvaluator singleton if the ONNX model is available on disk or memory.
pub fn get_global_evaluator() -> Option<&'static NeuralEvaluator> {
    if let Some(Some(evaluator)) = EXPLICIT_EVALUATOR.get() {
        return Some(evaluator);
    }
    GLOBAL_NEURAL_EVALUATOR
        .get_or_init(|| {
            #[cfg(not(any(target_arch = "wasm32", target_os = "android", target_os = "ios")))]
            {
                use std::path::Path;
                let possible_paths = [
                    "models/quoridor_9x9.onnx",
                    "packages/analyzer-rust/models/quoridor_9x9.onnx",
                    "../analyzer-rust/models/quoridor_9x9.onnx",
                    "../../packages/analyzer-rust/models/quoridor_9x9.onnx",
                ];

                for path_str in possible_paths {
                    let path = Path::new(path_str);
                    if path.exists() {
                        match NeuralEvaluator::load_from_path(path) {
                            Ok(evaluator) => {
                                eprintln!("[duoorb-ai] Loaded ONNX neural model from {}", path_str);
                                return Some(evaluator);
                            }
                            Err(err) => {
                                eprintln!("[duoorb-ai] Failed to load ONNX model from {}: {}", path_str, err);
                            }
                        }
                    }
                }
            }

            #[cfg(not(target_arch = "wasm32"))]
            {
                const EMBEDDED_MODEL_BYTES: &[u8] = include_bytes!("../models/quoridor_9x9.onnx");
                match NeuralEvaluator::load_from_bytes(EMBEDDED_MODEL_BYTES) {
                    Ok(evaluator) => {
                        eprintln!("[duoorb-ai] Loaded embedded ONNX neural model ({} bytes)", EMBEDDED_MODEL_BYTES.len());
                        return Some(evaluator);
                    }
                    Err(err) => {
                        eprintln!("[duoorb-ai] Failed to load embedded ONNX model: {}", err);
                    }
                }
            }

            eprintln!("[duoorb-ai] ONNX model not found, running on pure heuristic engine.");
            None
        })
        .as_ref()
}

#[derive(Debug, Clone)]
pub struct HybridAction {
    pub action: GameAction,
    pub source: &'static str, // "solver", "neural", "heuristic_fallback"
    pub confidence: f32,
}

/// The Master AI Decision Engine:
/// 1. TACTICAL SOLVER: If within 3 steps of goal or forced race, solves exactly via depth-8 Minimax.
/// 2. NEURAL + MCTS: Evaluates ONNX neural net to extract AlphaZero priors, then executes MCTS simulations.
/// 3. HEURISTIC FALLBACK: If anything fails or model absent, executes multi-threaded Rust MCTS.
pub fn find_hybrid_action(
    state: &GameState,
    simulations: usize,
    threads: usize,
    seed: u64,
) -> HybridAction {
    let ranked = find_ranked_hybrid_actions(state, simulations, threads, seed, 1, true);
    if let Some(top) = ranked.into_iter().next() {
        let source = if top.prob >= 0.98 {
            "solver"
        } else if get_global_evaluator().is_some() {
            "neural"
        } else {
            "heuristic_fallback"
        };
        HybridAction {
            action: top.action,
            source,
            confidence: top.q,
        }
    } else {
        HybridAction {
            action: GameAction::Resign,
            source: "heuristic_fallback",
            confidence: 0.0,
        }
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct HybridRankedAction {
    pub action: GameAction,
    pub prob: f32,
    pub logit: f32,
    pub q: f32,
    pub is_wall: bool,
}

/// Returns ranked candidate actions from the hybrid engine (Solver + Neural-guided MCTS).
pub fn find_ranked_hybrid_actions(
    state: &GameState,
    simulations: usize,
    threads: usize,
    seed: u64,
    limit: usize,
    use_solver: bool,
) -> Vec<HybridRankedAction> {
    let mut ranked = Vec::new();
    let mover_idx = state.current_player_index;
    let is_p2 = mover_idx == 1;

    // 1. TACTICAL ENDGAME SOLVER (only if enabled, e.g. Elo >= 1600 or hints)
    let solver_action_opt = if use_solver {
        solve_tactical_position(state, 8).filter(|act| is_legal_action(state, act))
    } else {
        None
    };

    if let Some(ref solver_action) = solver_action_opt {
        let is_wall = matches!(solver_action, GameAction::PlaceWall { .. });
        ranked.push(HybridRankedAction {
            action: solver_action.clone(),
            prob: 1.0,
            logit: 10.0,
            q: 0.99,
            is_wall,
        });
        if limit == 1 {
            return ranked;
        }
    }

    // 2. EXTRACT NEURAL PRIORS (AlphaZero Policy Head)
    let mut neural_priors_vec = Vec::new();
    if let Some(evaluator) = get_global_evaluator() {
        if let Ok(raw_pred) = evaluator.evaluate(state) {
            let adapted = adapt_prediction(state, &raw_pred);
            for (action_idx, &prob) in adapted.policy_probs.iter().enumerate() {
                if prob > 0.0001 {
                    if let Some(action) = map_index_to_action(state, action_idx, is_p2) {
                        if is_legal_action(state, &action) {
                            neural_priors_vec.push((action, prob));
                        }
                    }
                }
            }
        }
    }

    let neural_priors_slice = if !neural_priors_vec.is_empty() {
        Some(neural_priors_vec.as_slice())
    } else {
        None
    };

    // 3. MULTI-THREADED MCTS TREE SEARCH (Guided by AlphaZero Neural Priors)
    let mcts_ranked = crate::mcts::find_ranked_actions_with_priors(
        state,
        simulations,
        threads,
        seed,
        neural_priors_slice,
    );

    let total_visits: u32 = mcts_ranked.iter().map(|c| c.visits).sum();
    for c in mcts_ranked {
        if ranked.len() >= limit {
            break;
        }
        if !ranked.iter().any(|r| r.action == c.action) {
            let is_wall = matches!(c.action, GameAction::PlaceWall { .. });
            let prob = if total_visits > 0 {
                c.visits as f32 / total_visits as f32
            } else {
                0.1
            };

            // In AlphaZero, logit combines search visits (lookahead proof) and Q score (win equity)
            // plus prior bonus from neural net
            let prior_bonus = neural_priors_vec
                .iter()
                .find(|(a, _)| a == &c.action)
                .map(|(_, p)| (*p).ln().max(-4.0) * 0.4)
                .unwrap_or(0.0);

            let logit = (c.visits as f32 + 1.0).ln() * 1.5 + (c.q as f32) * 3.0 + prior_bonus;
            let q = c.q as f32;
            ranked.push(HybridRankedAction {
                action: c.action,
                prob,
                logit,
                q,
                is_wall,
            });
        }
    }

    // 4. Fill candidates up to limit with top AlphaZero neural priors (for SigmaQuoridor-style top-20 pool)
    if ranked.len() < limit && !neural_priors_vec.is_empty() {
        neural_priors_vec.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        for (act, p) in neural_priors_vec {
            if ranked.len() >= limit {
                break;
            }
            if !ranked.iter().any(|r| r.action == act) {
                let is_wall = matches!(act, GameAction::PlaceWall { .. });
                ranked.push(HybridRankedAction {
                    action: act,
                    prob: p,
                    logit: (p as f32).ln().max(-4.0) * 0.5,
                    q: 0.5,
                    is_wall,
                });
            }
        }
    }

    // 5. GUARANTEE: Never empty if legal pawn moves exist
    if ranked.is_empty() {
        let board = crate::board::Board::new();
        if let Some(mover) = state.players.get(mover_idx) {
            let pawn_moves = crate::rules::get_legal_moves(state, &mover.id, &board);
            for m in pawn_moves.into_iter().take(limit) {
                ranked.push(HybridRankedAction {
                    action: GameAction::Move { to: m },
                    prob: 0.5,
                    logit: 0.0,
                    q: 0.5,
                    is_wall: false,
                });
            }
        }
    }

    ranked
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{CellCoord, GoalDirection, PlayerState};

    #[test]
    fn hybrid_engine_uses_solver_for_immediate_win() {
        let state = GameState {
            game_id: "test-win".to_string(),
            mode: "2p".to_string(),
            current_player_index: 0,
            players: vec![
                PlayerState {
                    id: "p1".to_string(),
                    index: 0,
                    display_name: "P1".to_string(),
                    position: CellCoord { row: 1, col: 4 }, // 1 step from row 0!
                    walls_remaining: 0,
                    goal_direction: GoalDirection::Top,
                    status: "ACTIVE".to_string(),
                },
                PlayerState {
                    id: "p2".to_string(),
                    index: 1,
                    display_name: "P2".to_string(),
                    position: CellCoord { row: 4, col: 4 },
                    walls_remaining: 0,
                    goal_direction: GoalDirection::Bottom,
                    status: "ACTIVE".to_string(),
                },
            ],
            walls: vec![],
            move_number: 18,
            status: "IN_PROGRESS".to_string(),
        };

        let result = find_hybrid_action(&state, 1000, 2, 12345);
        assert_eq!(result.source, "solver");
        assert_eq!(
            result.action,
            GameAction::Move {
                to: CellCoord { row: 0, col: 4 }
            }
        );
    }

    #[test]
    fn hybrid_engine_uses_neural_for_opening() {
        let state = GameState {
            game_id: "test-opening".to_string(),
            mode: "2p".to_string(),
            current_player_index: 0,
            players: vec![
                PlayerState {
                    id: "p1".to_string(),
                    index: 0,
                    display_name: "P1".to_string(),
                    position: CellCoord { row: 8, col: 4 },
                    walls_remaining: 10,
                    goal_direction: GoalDirection::Top,
                    status: "ACTIVE".to_string(),
                },
                PlayerState {
                    id: "p2".to_string(),
                    index: 1,
                    display_name: "P2".to_string(),
                    position: CellCoord { row: 0, col: 4 },
                    walls_remaining: 10,
                    goal_direction: GoalDirection::Bottom,
                    status: "ACTIVE".to_string(),
                },
            ],
            walls: vec![],
            move_number: 0,
            status: "IN_PROGRESS".to_string(),
        };

        let result = find_hybrid_action(&state, 1000, 2, 12345);
        assert!(result.source == "neural" || result.source == "heuristic_fallback");
        // Initial move should be legal forward pawn sprint
        assert!(matches!(result.action, GameAction::Move { .. }));
    }
}
