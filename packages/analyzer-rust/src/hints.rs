use serde::{Deserialize, Serialize};

use crate::board::Board;
use crate::hybrid::find_ranked_hybrid_actions;
use crate::pathfinding::shortest_distance;
use crate::rules::{apply_action, is_legal_action};
use crate::solver::solve_tactical_position;
use crate::types::{CellCoord, GameAction, GameState, Orientation, WallCoord};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HintCandidate {
    pub action: GameAction,
    pub win_probability: f32, // [0.0, 1.0]
    pub tactical_tag: String,
    pub explanation: String,
    pub own_distance_delta: i32,
    pub opp_distance_delta: i32,
    pub notation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HintResponse {
    pub best_action: GameAction,
    pub win_probability: f32,
    pub tactical_tag: String,
    pub explanation: String,
    pub notation: String,
    pub alternatives: Vec<HintCandidate>,
}

pub fn cell_notation(cell: CellCoord) -> String {
    let col_char = match cell.col {
        0 => 'a',
        1 => 'b',
        2 => 'c',
        3 => 'd',
        4 => 'e',
        5 => 'f',
        6 => 'g',
        7 => 'h',
        8 => 'i',
        _ => '?',
    };
    let row_char = match cell.row {
        0 => '1',
        1 => '2',
        2 => '3',
        3 => '4',
        4 => '5',
        5 => '6',
        6 => '7',
        7 => '8',
        8 => '9',
        _ => '?',
    };
    format!("{}{}", col_char, row_char)
}

pub fn wall_notation(wall: &WallCoord) -> String {
    let col_char = match wall.col {
        0 => 'a',
        1 => 'b',
        2 => 'c',
        3 => 'd',
        4 => 'e',
        5 => 'f',
        6 => 'g',
        7 => 'h',
        _ => '?',
    };
    let row_char = match wall.row {
        0 => '1',
        1 => '2',
        2 => '3',
        3 => '4',
        4 => '5',
        5 => '6',
        6 => '7',
        7 => '8',
        _ => '?',
    };
    let orient = match wall.orientation {
        Orientation::H => "H",
        Orientation::V => "V",
    };
    format!("{}{}{}", orient, col_char, row_char)
}

pub fn action_notation(action: &GameAction) -> String {
    match action {
        GameAction::Move { to } => cell_notation(*to),
        GameAction::PlaceWall { wall } => wall_notation(wall),
        GameAction::Resign => "Resign".to_string(),
        GameAction::Timeout => "Timeout".to_string(),
    }
}

/// Evaluates state before and after action to produce a Grandmaster tactical explanation.
fn evaluate_candidate_tactics(
    state: &GameState,
    action: &GameAction,
    _raw_win_prob: f32,
) -> (String, String, i32, i32, String) {
    let mover_idx = state.current_player_index;
    let mover = match state.players.get(mover_idx) {
        Some(p) => p,
        None => return ("DEFAULT".into(), "Play best available action".into(), 0, 0, "".into()),
    };

    let board_before = Board::from_walls(&state.walls);
    let d_before_own = shortest_distance(mover.position, mover.goal_direction, &board_before, &state.mode);

    // Find nearest active opponent distance before move
    let mut d_before_opp = i32::MAX;
    for (idx, p) in state.players.iter().enumerate() {
        if idx != mover_idx && p.status == "ACTIVE" {
            let d = shortest_distance(p.position, p.goal_direction, &board_before, &state.mode);
            if d > 0 && d < d_before_opp {
                d_before_opp = d;
            }
        }
    }
    if d_before_opp == i32::MAX {
        d_before_opp = 10;
    }

    let mut board_after = board_before;
    let notation = action_notation(action);

    let next_state = match apply_action(state, action, &mut board_after) {
        Some(s) => s,
        None => return ("ILLEGAL".into(), "Illegal move".into(), 0, 0, notation),
    };

    let mover_after = &next_state.players[mover_idx];
    let d_after_own = shortest_distance(mover_after.position, mover_after.goal_direction, &board_after, &state.mode);

    let mut d_after_opp = i32::MAX;
    for (idx, p) in next_state.players.iter().enumerate() {
        if idx != mover_idx && p.status == "ACTIVE" {
            let d = shortest_distance(p.position, p.goal_direction, &board_after, &state.mode);
            if d > 0 && d < d_after_opp {
                d_after_opp = d;
            }
        }
    }
    if d_after_opp == i32::MAX {
        d_after_opp = 10;
    }

    let own_delta = d_before_own - d_after_own;
    let opp_delta = d_after_opp - d_before_opp;

    let (tag, explanation) = match action {
        GameAction::Move { to } => {
            let cell_str = cell_notation(*to);
            if d_after_own == 0 {
                (
                    "GOAL_CONVERSION".to_string(),
                    format!("Pawn step to {} lands directly on the goal line to claim victory!", cell_str),
                )
            } else if (to.row - mover.position.row).abs() > 1 || (to.col - mover.position.col).abs() > 1 {
                (
                    "PAWN_LEAP".to_string(),
                    format!("Tactical jump to {} vaults over opponent to seize a decisive sprint advantage.", cell_str),
                )
            } else if own_delta > 0 && d_after_own < d_before_opp {
                let lead = d_before_opp - d_after_own;
                (
                    "RACE_SPRINT".to_string(),
                    format!("Sprint forward to {} establishing a commanding {}-step lead in the race.", cell_str, lead),
                )
            } else if own_delta > 0 {
                (
                    "TEMPO_ADVANCE".to_string(),
                    format!("Advance pawn to {} shortening your path to {} steps while maintaining pressure.", cell_str, d_after_own),
                )
            } else {
                (
                    "POSITIONAL_STEP".to_string(),
                    format!("Pawn shift to {} repositioning to bypass enemy wall funnels.", cell_str),
                )
            }
        }
        GameAction::PlaceWall { wall } => {
            let orient_desc = if wall.orientation == Orientation::H { "Horizontal" } else { "Vertical" };
            if d_before_opp <= 2 && opp_delta >= 1 {
                (
                    "EMERGENCY_BLOCK".to_string(),
                    format!("Critical {} wall at {} halts opponent's immediate sprint to the finish.", orient_desc, notation),
                )
            } else if opp_delta >= 3 {
                (
                    "CORRIDOR_SEAL".to_string(),
                    format!("Sealing {} wall at {} forces a devastating {}-step detour onto the opponent.", orient_desc, notation, opp_delta),
                )
            } else if opp_delta >= 1 {
                (
                    "DETOUR_BLOCK".to_string(),
                    format!("Calculated {} wall at {} adds {} steps to opponent's route while keeping your lane open.", orient_desc, notation, opp_delta),
                )
            } else if own_delta == 0 {
                (
                    "STRATEGIC_FUNNEL".to_string(),
                    format!("Proactive {} wall at {} shapes the board structure to restrict enemy counterplay.", orient_desc, notation),
                )
            } else {
                (
                    "DEFENSIVE_ANCHOR".to_string(),
                    format!("Guarding {} wall at {} fortifies your perimeter against future traps.", orient_desc, notation),
                )
            }
        }
        GameAction::Resign => ("RESIGN".to_string(), "No legal moves available.".to_string()),
        GameAction::Timeout => ("TIMEOUT".to_string(), "Player ran out of time.".to_string()),
    };

    (tag, explanation, own_delta, opp_delta, notation)
}

/// The Grandmaster Oracle Engine:
/// Evaluates current position, identifies the optimal tactical move, win probability,
/// and rich tactical explanations for top 3 candidates.
pub fn get_grandmaster_hint(state: &GameState) -> HintResponse {
    // 1. Tactical Endgame Solver (checks if immediate win or forced conversion exists)
    if let Some(solver_action) = solve_tactical_position(state, 8) {
        if is_legal_action(state, &solver_action) {
            let (tag, explanation, _own_delta, _opp_delta, notation) =
                evaluate_candidate_tactics(state, &solver_action, 0.99);
            return HintResponse {
                best_action: solver_action,
                win_probability: 0.99,
                tactical_tag: tag,
                explanation,
                notation,
                alternatives: vec![],
            };
        }
    }

    // 2. 2P Classic Duel: Powered by Pure AlphaZero MCTS (exact same engine as Milo)
    if state.mode == "2p" {
        if let Some(evaluator) = crate::hybrid::get_global_evaluator() {
            let az_ranked = crate::alphazero::run_alphazero_mcts_ranked(evaluator, state, 50, 2.0);
            if !az_ranked.is_empty() {
                let mut evaluated = Vec::with_capacity(3);
                for r in az_ranked.into_iter().take(3) {
                    let (tag, explanation, own_delta, opp_delta, notation) =
                        evaluate_candidate_tactics(state, &r.action, r.win_prob);
                    evaluated.push(HintCandidate {
                        action: r.action,
                        win_probability: r.win_prob,
                        tactical_tag: tag,
                        explanation,
                        own_distance_delta: own_delta,
                        opp_distance_delta: opp_delta,
                        notation,
                    });
                }
                let best = evaluated.remove(0);
                return HintResponse {
                    best_action: best.action,
                    win_probability: best.win_probability,
                    tactical_tag: best.tactical_tag,
                    explanation: best.explanation,
                    notation: best.notation,
                    alternatives: evaluated,
                };
            }
        }
    }

    // 3. Variant / Multi-Player Fallback
    let mut candidates = Vec::with_capacity(12);
    let hybrid_ranked = find_ranked_hybrid_actions(state, 2000, 4, 12345, 12, true);
    for h in hybrid_ranked {
        if !candidates.iter().any(|c: &(GameAction, f32)| c.0 == h.action) {
            let win_p = (h.q.clamp(0.05, 0.98) * 0.75 + h.prob.clamp(0.0, 1.0) * 0.25).clamp(0.05, 0.98);
            candidates.push((h.action, win_p));
        }
    }

    // Guardrail: Fallback to legal pawn moves if somehow empty
    if candidates.is_empty() {
        let board = Board::from_walls(&state.walls);
        if let Some(mover) = state.players.get(state.current_player_index) {
            for m in crate::rules::get_legal_moves(state, &mover.id, &board) {
                candidates.push((GameAction::Move { to: m }, 0.50));
            }
        }
    }

    if candidates.is_empty() {
        return HintResponse {
            best_action: GameAction::Resign,
            win_probability: 0.0,
            tactical_tag: "NO_MOVES".to_string(),
            explanation: "No legal moves remaining.".to_string(),
            notation: "None".to_string(),
            alternatives: vec![],
        };
    }

    // STRICT SORT: Ensure candidate 0 is the highest win probability move
    candidates.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

    // Evaluate tactical reasoning and path deltas for top candidates
    let mut evaluated = Vec::with_capacity(candidates.len());
    for (action, raw_prob) in candidates.into_iter().take(3) {
        let (tag, explanation, own_delta, opp_delta, notation) =
            evaluate_candidate_tactics(state, &action, raw_prob);
        evaluated.push(HintCandidate {
            action,
            win_probability: raw_prob,
            tactical_tag: tag,
            explanation,
            own_distance_delta: own_delta,
            opp_distance_delta: opp_delta,
            notation,
        });
    }

    let best = evaluated.remove(0);
    HintResponse {
        best_action: best.action,
        win_probability: best.win_probability,
        tactical_tag: best.tactical_tag,
        explanation: best.explanation,
        notation: best.notation,
        alternatives: evaluated,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{GoalDirection, PlayerState};

    fn make_hint_test_state() -> GameState {
        GameState {
            game_id: "test-hint".to_string(),
            mode: "2p".to_string(),
            current_player_index: 0,
            players: vec![
                PlayerState {
                    id: "p1".to_string(),
                    index: 0,
                    display_name: "P1".to_string(),
                    position: CellCoord { row: 0, col: 4 },
                    walls_remaining: 10,
                    goal_direction: GoalDirection::Bottom,
                    status: "ACTIVE".to_string(),
                },
                PlayerState {
                    id: "p2".to_string(),
                    index: 1,
                    display_name: "P2".to_string(),
                    position: CellCoord { row: 8, col: 4 },
                    walls_remaining: 10,
                    goal_direction: GoalDirection::Top,
                    status: "ACTIVE".to_string(),
                },
            ],
            walls: vec![],
            move_number: 1,
            status: "IN_PROGRESS".to_string(),
        }
    }

    #[test]
    fn test_hint_oracle_produces_grandmaster_recommendation() {
        let state = make_hint_test_state();
        let hint = get_grandmaster_hint(&state);

        assert!(is_legal_action(&state, &hint.best_action));
        assert!(hint.win_probability > 0.0 && hint.win_probability <= 1.0);
        assert!(!hint.tactical_tag.is_empty());
        assert!(!hint.explanation.is_empty());
        assert!(!hint.notation.is_empty());
    }

    #[test]
    fn test_hint_identifies_immediate_win_conversion() {
        let mut state = make_hint_test_state();
        state.players[0].position = CellCoord { row: 7, col: 4 }; // 1 step from row 8!
        let hint = get_grandmaster_hint(&state);

        assert!(hint.win_probability >= 0.95);
        assert_eq!(hint.tactical_tag, "GOAL_CONVERSION");
        assert!(matches!(hint.best_action, GameAction::Move { to } if to.row == 8));
    }

    #[test]
    fn test_hint_never_suggests_backward_when_forward_available() {
        let mut state = make_hint_test_state();
        state.players[0].position = CellCoord { row: 3, col: 4 }; // goal is bottom (row 8)
        let hint = get_grandmaster_hint(&state);
        if let GameAction::Move { to } = hint.best_action {
            assert!(to.row >= 3, "Hint must never recommend retreating backward! Got row {}", to.row);
        }
    }

    #[test]
    fn test_cell_notation_format() {
        assert_eq!(cell_notation(CellCoord { row: 0, col: 0 }), "a1");
        assert_eq!(cell_notation(CellCoord { row: 4, col: 4 }), "e5");
        assert_eq!(cell_notation(CellCoord { row: 8, col: 8 }), "i9");
    }

    #[test]
    fn test_wall_notation_format() {
        let w = WallCoord { row: 3, col: 4, orientation: Orientation::H };
        assert_eq!(wall_notation(&w), "He4");
        let wv = WallCoord { row: 0, col: 0, orientation: Orientation::V };
        assert_eq!(wall_notation(&wv), "Va1");
    }
}
