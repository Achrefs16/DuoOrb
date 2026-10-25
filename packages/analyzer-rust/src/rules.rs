use crate::board::{Board, BOARD_SIZE};
use crate::pathfinding::{has_path_to_goal, is_goal_cell};
use crate::types::{CellCoord, GameAction, GameState, PlayerState, WallCoord};

#[inline(always)]
pub fn is_cell_within_board(c: CellCoord) -> bool {
    c.row >= 0 && c.row < BOARD_SIZE && c.col >= 0 && c.col < BOARD_SIZE
}

#[inline(always)]
pub fn get_player_at(cell: CellCoord, players: &[PlayerState]) -> Option<&PlayerState> {
    players
        .iter()
        .find(|p| p.status != "FINISHED" && p.position == cell)
}

const ORTHOGONAL_DIRS: [(i8, i8); 4] = [
    (-1, 0), // UP
    (1, 0),  // DOWN
    (0, -1), // LEFT
    (0, 1),  // RIGHT
];

fn get_perpendicular_dirs(dr: i8, _dc: i8) -> [(i8, i8); 2] {
    if dr != 0 {
        [(0, -1), (0, 1)] // horizontal perps
    } else {
        [(-1, 0), (1, 0)] // vertical perps
    }
}

pub fn get_legal_moves(state: &GameState, player_id: &str, board: &Board) -> Vec<CellCoord> {
    let player = match state.players.iter().find(|p| p.id == player_id) {
        Some(p) => p,
        None => return vec![],
    };

    let current = player.position;
    let mut legal = Vec::with_capacity(8);

    for (dr, dc) in ORTHOGONAL_DIRS {
        let neighbor = CellCoord {
            row: current.row + dr,
            col: current.col + dc,
        };

        if !is_cell_within_board(neighbor) || board.is_blocked(current, neighbor) {
            continue;
        }

        let opponent = get_player_at(neighbor, &state.players);

        if opponent.is_none() {
            legal.push(neighbor);
        } else {
            // Jump rule
            let straight_behind = CellCoord {
                row: neighbor.row + dr,
                col: neighbor.col + dc,
            };

            let is_straight_oob = !is_cell_within_board(straight_behind);
            let is_straight_blocked = board.is_blocked(neighbor, straight_behind);
            let is_straight_occupied =
                !is_straight_oob && get_player_at(straight_behind, &state.players).is_some();

            if !is_straight_oob && !is_straight_blocked && !is_straight_occupied {
                legal.push(straight_behind);
            } else {
                for (pdr, pdc) in get_perpendicular_dirs(dr, dc) {
                    let diag = CellCoord {
                        row: neighbor.row + pdr,
                        col: neighbor.col + pdc,
                    };
                    if is_cell_within_board(diag)
                        && !board.is_blocked(neighbor, diag)
                        && get_player_at(diag, &state.players).is_none()
                    {
                        legal.push(diag);
                    }
                }
            }
        }
    }

    legal
}

pub fn is_legal_wall_placement(
    state: &GameState,
    player_id: &str,
    wall: &WallCoord,
    board: &Board,
) -> bool {
    let player = match state.players.iter().find(|p| p.id == player_id) {
        Some(p) => p,
        None => return false,
    };

    if player.walls_remaining <= 0 {
        return false;
    }

    if board.does_wall_conflict(wall) {
        return false;
    }

    // Speculatively place wall and check all active players retain a goal path
    let mut spec_board = *board;
    spec_board.place_wall(wall);

    for p in &state.players {
        if p.status == "ACTIVE"
            && !has_path_to_goal(p.position, p.goal_direction, &spec_board, &state.mode)
        {
            return false;
        }
    }

    true
}

pub fn apply_action(
    state: &GameState,
    action: &GameAction,
    board: &mut Board,
) -> Option<GameState> {
    let mut next_state = state.clone();
    let mover_idx = state.current_player_index;
    let mover = &state.players[mover_idx];
    let mover_id = mover.id.clone();

    match action {
        GameAction::Move { to } => {
            let legal = get_legal_moves(state, &mover_id, board);
            if !legal.contains(to) {
                return None;
            }
            next_state.players[mover_idx].position = *to;
            // Goal completion is a rules concern, not a per-seat special case:
            // 1v1 ends immediately; 3P/4P continues until N-1 players finish.
            if is_goal_cell(
                *to,
                next_state.players[mover_idx].goal_direction,
                &next_state.mode,
            ) {
                next_state.players[mover_idx].status = "FINISHED".to_string();
                let total = next_state.players.len();
                let finished = next_state
                    .players
                    .iter()
                    .filter(|p| p.status == "FINISHED")
                    .count();
                if total <= 2 || finished >= total.saturating_sub(1) {
                    next_state.status = "COMPLETED".to_string();
                }
            }
        }
        GameAction::PlaceWall { wall } => {
            if !is_legal_wall_placement(state, &mover_id, wall, board) {
                return None;
            }
            board.place_wall(wall);
            next_state.walls.push(*wall);
            next_state.players[mover_idx].walls_remaining -= 1;
        }
        GameAction::Resign | GameAction::Timeout => {
            next_state.players[mover_idx].status = "FINISHED".to_string();
        }
    }

    // Advance turn
    let total_players = next_state.players.len();
    if total_players == 0 {
        return Some(next_state);
    }
    let mut next_idx = (mover_idx + 1) % total_players;
    let mut iterations = 0;
    while next_state.players[next_idx].status == "FINISHED" && iterations < total_players {
        next_idx = (next_idx + 1) % total_players;
        iterations += 1;
    }
    next_state.current_player_index = next_idx;

    Some(next_state)
}

#[cfg(test)]
mod tests {
    use super::apply_action;
    use crate::board::Board;
    use crate::types::{CellCoord, GameAction, GameState, GoalDirection, PlayerState};

    fn seat(id: &str, row: i8, col: i8, goal: GoalDirection) -> PlayerState {
        PlayerState {
            id: id.to_string(),
            index: 0,
            display_name: id.to_string(),
            position: CellCoord { row, col },
            walls_remaining: 10,
            goal_direction: goal,
            status: "ACTIVE".to_string(),
        }
    }

    #[test]
    fn three_player_goal_keeps_the_match_running() {
        let state = GameState {
            game_id: "3p".to_string(),
            mode: "4p".to_string(),
            current_player_index: 0,
            players: vec![
                seat("p1", 3, 4, GoalDirection::Center),
                seat("p2", 0, 0, GoalDirection::Center),
                seat("p3", 8, 8, GoalDirection::Center),
            ],
            walls: vec![],
            status: "IN_PROGRESS".to_string(),
        };
        let mut board = Board::new();
        let next = apply_action(
            &state,
            &GameAction::Move {
                to: CellCoord { row: 4, col: 4 },
            },
            &mut board,
        )
        .expect("center goal move must be legal");
        assert_eq!(next.players[0].status, "FINISHED");
        assert_eq!(next.status, "IN_PROGRESS");
        assert_eq!(next.current_player_index, 1);
    }

    #[test]
    fn two_player_goal_completes_immediately() {
        let state = GameState {
            game_id: "2p".to_string(),
            mode: "2p".to_string(),
            current_player_index: 0,
            players: vec![
                seat("p1", 7, 4, GoalDirection::Bottom),
                seat("p2", 1, 4, GoalDirection::Top),
            ],
            walls: vec![],
            status: "IN_PROGRESS".to_string(),
        };
        let mut board = Board::new();
        let next = apply_action(
            &state,
            &GameAction::Move {
                to: CellCoord { row: 8, col: 4 },
            },
            &mut board,
        )
        .expect("goal move must be legal");
        assert_eq!(next.players[0].status, "FINISHED");
        assert_eq!(next.status, "COMPLETED");
    }
}
