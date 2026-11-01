use crate::board::Board;
use crate::pathfinding::shortest_distance;
use crate::rules::{apply_action, get_legal_moves, is_legal_wall_placement};
use crate::types::{GameAction, GameState, Orientation, WallCoord};

pub const WIN_SCORE: i32 = 10_000;
pub const LOSS_SCORE: i32 = -10_000;
pub const TACTICAL_WIN_THRESHOLD: i32 = 8_000;
pub const TACTICAL_LOSS_THRESHOLD: i32 = -8_000;

/// Check if a position qualifies for exact tactical solving:
/// - 2-player match
/// - Mover is within 3 steps of winning OR both players have 0 walls and distance <= 5
pub fn can_solve_tactically(state: &GameState) -> bool {
    if state.players.len() != 2 || state.status == "COMPLETED" || state.status == "FINISHED" {
        return false;
    }

    let board = Board::from_walls(&state.walls);
    let mover = &state.players[state.current_player_index];
    let opp = &state.players[1 - state.current_player_index];

    let mover_dist = shortest_distance(mover.position, mover.goal_direction, &board, &state.mode);
    let opp_dist = shortest_distance(opp.position, opp.goal_direction, &board, &state.mode);

    let is_variant_2p = state.mode == "center2" || state.mode == "race2";
    if is_variant_2p {
        if mover_dist <= 4 || opp_dist <= 3 {
            return true;
        }
    } else if mover_dist <= 3 || opp_dist <= 2 {
        return true;
    }

    if mover.walls_remaining == 0 && opp.walls_remaining == 0 && mover_dist <= 5 {
        return true;
    }

    false
}

/// Solves the position using Alpha-Beta Minimax search up to depth `max_depth`.
/// Returns `Some((optimal_action, minimax_score))` if candidate moves exist,
/// or `None` if search was skipped or inconclusive.
pub fn solve_tactical_position_with_score(state: &GameState, max_depth: usize) -> Option<(GameAction, i32)> {
    if !can_solve_tactically(state) {
        return None;
    }

    let board = Board::from_walls(&state.walls);
    let candidates = generate_solver_candidates(state, &board);
    if candidates.is_empty() {
        return None;
    }

    let mut best_action = None;
    let mut alpha = -30_000;
    let beta = 30_000;

    let mover_idx = state.current_player_index;

    for action in candidates {
        let mut sim_board = board;
        if let Some(next_state) = apply_action(state, &action, &mut sim_board) {
            // Check immediate win
            if next_state.status == "COMPLETED" || next_state.status == "FINISHED" {
                return Some((action, WIN_SCORE));
            }

            let score = -negamax(&next_state, max_depth - 1, -beta, -alpha, &mut sim_board, mover_idx);
            if score > alpha {
                alpha = score;
                best_action = Some(action);
            }
        }
    }

    best_action.map(|action| (action, alpha))
}

/// Solves the position using Alpha-Beta Minimax search up to depth `max_depth`.
/// Returns `Some(optimal_action)` if an exact solution was found, or `None` if
/// search was skipped or inconclusive.
pub fn solve_tactical_position(state: &GameState, max_depth: usize) -> Option<GameAction> {
    solve_tactical_position_with_score(state, max_depth).map(|(act, _)| act)
}

fn negamax(
    state: &GameState,
    depth: usize,
    mut alpha: i32,
    beta: i32,
    board: &mut Board,
    root_player_idx: usize,
) -> i32 {
    let mover_idx = state.current_player_index;
    let opp_idx = 1 - mover_idx;

    let mover = &state.players[mover_idx];
    let opp = &state.players[opp_idx];

    let mover_dist = shortest_distance(mover.position, mover.goal_direction, board, &state.mode);
    let opp_dist = shortest_distance(opp.position, opp.goal_direction, board, &state.mode);

    // Terminal: opponent has already reached goal and completed match
    if state.status == "COMPLETED" || state.players[opp_idx].status == "FINISHED" || opp_dist == 0 {
        return LOSS_SCORE + (10 - depth as i32);
    }

    // Current player has reached goal
    if mover_dist == 0 || state.players[mover_idx].status == "FINISHED" {
        return WIN_SCORE - (10 - depth as i32);
    }

    // Leaf evaluation at depth cutoff
    if depth == 0 {
        let dist_delta = (opp_dist - mover_dist) * 100;
        let wall_delta = (mover.walls_remaining - opp.walls_remaining) * 25;
        return dist_delta + wall_delta;
    }

    let candidates = generate_solver_candidates(state, board);
    if candidates.is_empty() {
        return LOSS_SCORE + (10 - depth as i32);
    }

    for action in candidates {
        let mut sim_board = *board;
        if let Some(next_state) = apply_action(state, &action, &mut sim_board) {
            let score = -negamax(&next_state, depth - 1, -beta, -alpha, &mut sim_board, root_player_idx);
            if score >= beta {
                return beta; // Beta cutoff
            }
            if score > alpha {
                alpha = score;
            }
        }
    }

    alpha
}

/// Generates focused candidates for the endgame solver:
/// - All legal pawn moves
/// - Tactical walls that directly increase opponent's distance (if walls remain and opp_dist <= 4)
fn generate_solver_candidates(state: &GameState, board: &Board) -> Vec<GameAction> {
    let mut actions = Vec::with_capacity(16);
    let mover_idx = state.current_player_index;
    let mover = &state.players[mover_idx];
    let opp = &state.players[1 - mover_idx];

    // 1. Pawn moves (always considered)
    for to in get_legal_moves(state, &mover.id, board) {
        actions.push(GameAction::Move { to });
    }

    // 2. Tactical wall placements (only if walls remain and opponent is threatening a win)
    if mover.walls_remaining > 0 {
        let opp_dist = shortest_distance(opp.position, opp.goal_direction, board, &state.mode);
        if opp_dist <= 4 {
            let mut candidate_vertices = Vec::new();

            // Generate walls near the opponent
            let min_r = (opp.position.row - 1).max(0) as i8;
            let max_r = (opp.position.row + 1).min(7) as i8;
            let min_c = (opp.position.col - 1).max(0) as i8;
            let max_c = (opp.position.col + 1).min(7) as i8;

            for r in min_r..=max_r {
                for c in min_c..=max_c {
                    candidate_vertices.push((r, c));
                }
            }

            // In Center Rush, also consider the goal choke vertices surrounding the center (4,4)
            if state.mode == "center2" {
                for &(cr, cc) in &[(3, 3), (3, 4), (4, 3), (4, 4)] {
                    if !candidate_vertices.contains(&(cr, cc)) {
                        candidate_vertices.push((cr, cc));
                    }
                }
            }

            for (r, c) in candidate_vertices {
                for &orientation in &[Orientation::H, Orientation::V] {
                    let wall = WallCoord { row: r, col: c, orientation };
                    if is_legal_wall_placement(state, &mover.id, &wall, board) {
                        let mut test_board = *board;
                        test_board.place_wall(&wall);
                        let new_opp_dist = shortest_distance(opp.position, opp.goal_direction, &test_board, &state.mode);
                        if new_opp_dist > opp_dist {
                            // Only keep walls that actually delay the opponent
                            actions.push(GameAction::PlaceWall { wall });
                        }
                    }
                }
            }
        }
    }

    actions
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{CellCoord, GoalDirection, PlayerState};

    #[test]
    fn solver_identifies_immediate_winning_step() {
        let state = GameState {
            game_id: "solver-win".to_string(),
            mode: "2p".to_string(),
            current_player_index: 0,
            players: vec![
                PlayerState {
                    id: "p1".to_string(),
                    index: 0,
                    display_name: "P1".to_string(),
                    position: CellCoord { row: 1, col: 4 }, // 1 step from row 0
                    walls_remaining: 0,
                    goal_direction: GoalDirection::Top,
                    status: "ACTIVE".to_string(),
                },
                PlayerState {
                    id: "p2".to_string(),
                    index: 1,
                    display_name: "P2".to_string(),
                    position: CellCoord { row: 3, col: 4 },
                    walls_remaining: 0,
                    goal_direction: GoalDirection::Bottom,
                    status: "ACTIVE".to_string(),
                },
            ],
            walls: vec![],
            move_number: 20,
            status: "IN_PROGRESS".to_string(),
        };

        assert!(can_solve_tactically(&state));
        let best = solve_tactical_position(&state, 6).expect("Solver should find move");
        assert_eq!(
            best,
            GameAction::Move {
                to: CellCoord { row: 0, col: 4 }
            },
            "Solver must immediately take the winning goal step"
        );
    }

    #[test]
    fn solver_blocks_opponent_one_step_from_win() {
        let state = GameState {
            game_id: "solver-block".to_string(),
            mode: "2p".to_string(),
            current_player_index: 0,
            players: vec![
                PlayerState {
                    id: "p1".to_string(),
                    index: 0,
                    display_name: "P1".to_string(),
                    position: CellCoord { row: 5, col: 4 }, // 5 steps away
                    walls_remaining: 3,
                    goal_direction: GoalDirection::Top,
                    status: "ACTIVE".to_string(),
                },
                PlayerState {
                    id: "p2".to_string(),
                    index: 1,
                    display_name: "P2".to_string(),
                    position: CellCoord { row: 7, col: 4 }, // 1 step from row 8!
                    walls_remaining: 0,
                    goal_direction: GoalDirection::Bottom,
                    status: "ACTIVE".to_string(),
                },
            ],
            walls: vec![],
            move_number: 25,
            status: "IN_PROGRESS".to_string(),
        };

        assert!(can_solve_tactically(&state));
        let best = solve_tactical_position(&state, 6).expect("Solver should find move");
        // Must place a horizontal wall at row 7 to block opponent from stepping to row 8
        match best {
            GameAction::PlaceWall { wall } => {
                assert_eq!(wall.row, 7);
                assert_eq!(wall.orientation, Orientation::H);
            }
            _ => panic!("Solver must place a wall to stop rival from winning on next turn"),
        }
    }

    #[test]
    fn solver_triggers_early_and_blocks_in_center2() {
        let state = GameState {
            game_id: "solver-center2".to_string(),
            mode: "center2".to_string(),
            current_player_index: 0,
            players: vec![
                PlayerState {
                    id: "p1".to_string(),
                    index: 0,
                    display_name: "P1".to_string(),
                    position: CellCoord { row: 7, col: 4 }, // dist = 3 to (4,4)
                    walls_remaining: 5,
                    goal_direction: GoalDirection::Center,
                    status: "ACTIVE".to_string(),
                },
                PlayerState {
                    id: "p2".to_string(),
                    index: 1,
                    display_name: "P2".to_string(),
                    position: CellCoord { row: 3, col: 4 }, // dist = 1 to (4,4)!
                    walls_remaining: 5,
                    goal_direction: GoalDirection::Center,
                    status: "ACTIVE".to_string(),
                },
            ],
            walls: vec![],
            move_number: 2,
            status: "IN_PROGRESS".to_string(),
        };

        assert!(can_solve_tactically(&state), "Center2 at d <= 4 must qualify for tactical solve");
        let best = solve_tactical_position(&state, 6).expect("Solver should find tactical move in Center2");
        // P2 is only 1 step from (4,4). P1 must place a wall to block P2's direct path!
        match best {
            GameAction::PlaceWall { wall } => {
                assert!(wall.row <= 3, "Wall must obstruct P2 from reaching center");
            }
            _ => panic!("Expected tactical wall to prevent opponent from reaching center first"),
        }
    }
}
