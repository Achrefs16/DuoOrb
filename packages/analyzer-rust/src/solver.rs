use crate::board::Board;
use crate::pathfinding::shortest_distance;
use crate::rules::{apply_action, get_legal_moves, is_legal_wall_placement};
use crate::types::{GameAction, GameState, Orientation, WallCoord};

const WIN_SCORE: i32 = 10_000;
const LOSS_SCORE: i32 = -10_000;

/// Check if a position qualifies for exact tactical solving:
/// - 2-player match
/// - Mover is within 3 steps of winning OR both players have 0 walls and distance <= 5
pub fn can_solve_tactically(state: &GameState) -> bool {
    if state.players.len() != 2 || state.status == "FINISHED" {
        return false;
    }

    let board = Board::from_walls(&state.walls);
    let mover = &state.players[state.current_player_index];
    let opp = &state.players[1 - state.current_player_index];

    let mover_dist = shortest_distance(mover.position, mover.goal_direction, &board, &state.mode);
    let opp_dist = shortest_distance(opp.position, opp.goal_direction, &board, &state.mode);

    if mover_dist <= 3 || opp_dist <= 2 {
        return true;
    }

    if mover.walls_remaining == 0 && opp.walls_remaining == 0 && mover_dist <= 5 {
        return true;
    }

    false
}

/// Solves the position using Alpha-Beta Minimax search up to depth `max_depth`.
/// Returns `Some(optimal_action)` if an exact solution was found, or `None` if
/// search was skipped or inconclusive.
pub fn solve_tactical_position(state: &GameState, max_depth: usize) -> Option<GameAction> {
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
            if next_state.status == "FINISHED" {
                return Some(action);
            }

            let score = -negamax(&next_state, max_depth - 1, -beta, -alpha, &mut sim_board, mover_idx);
            if score > alpha {
                alpha = score;
                best_action = Some(action);
            }
        }
    }

    best_action
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

    // Terminal: current player has reached goal
    if mover_dist == 0 || state.status == "FINISHED" {
        return WIN_SCORE - (10 - depth as i32);
    }

    // Opponent has already reached goal
    if opp_dist == 0 {
        return LOSS_SCORE + (10 - depth as i32);
    }

    // Leaf evaluation at depth cutoff
    if depth == 0 {
        let dist_delta = (opp_dist - mover_dist) * 100;
        let wall_delta = (mover.walls_remaining - opp.walls_remaining) * 25;
        let score = dist_delta + wall_delta;
        return if mover_idx == root_player_idx { score } else { -score };
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
            // Generate walls near the opponent
            let min_r = (opp.position.row - 1).max(0) as i8;
            let max_r = (opp.position.row + 1).min(7) as i8;
            let min_c = (opp.position.col - 1).max(0) as i8;
            let max_c = (opp.position.col + 1).min(7) as i8;

            for r in min_r..=max_r {
                for c in min_c..=max_c {
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
}
