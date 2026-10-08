use crate::board::{Board, BOARD_SIZE};
use crate::types::{CellCoord, GoalDirection};

pub const BOARD_CELLS: usize = (BOARD_SIZE * BOARD_SIZE) as usize; // 81

#[inline(always)]
pub fn cell_index(c: CellCoord) -> usize {
    (c.row as usize) * (BOARD_SIZE as usize) + (c.col as usize)
}

#[inline(always)]
pub fn coord_from_index(idx: usize) -> CellCoord {
    CellCoord {
        row: (idx / (BOARD_SIZE as usize)) as i8,
        col: (idx % (BOARD_SIZE as usize)) as i8,
    }
}

#[inline(always)]
pub fn is_center_goal_mode(mode: &str) -> bool {
    mode == "4p" || mode == "center2" || mode == "center3"
}

#[inline(always)]
pub fn is_goal_cell(c: CellCoord, goal: GoalDirection, mode: &str) -> bool {
    if is_center_goal_mode(mode) {
        c.row == 4 && c.col == 4
    } else {
        match goal {
            GoalDirection::Top => c.row == 0,
            GoalDirection::Bottom => c.row == BOARD_SIZE - 1,
            GoalDirection::Left => c.col == 0,
            GoalDirection::Right => c.col == BOARD_SIZE - 1,
            GoalDirection::Center => c.row == 4 && c.col == 4,
        }
    }
}

const DIRS: [(i8, i8); 4] = [(-1, 0), (1, 0), (0, -1), (0, 1)];

pub fn shortest_distance(from: CellCoord, goal: GoalDirection, board: &Board, mode: &str) -> i32 {
    if is_goal_cell(from, goal, mode) {
        return 0;
    }

    let mut dist = [-1i16; BOARD_CELLS];
    let mut queue = [0u8; BOARD_CELLS];
    let mut head = 0usize;
    let mut tail = 0usize;

    let start_idx = cell_index(from);
    dist[start_idx] = 0;
    queue[tail] = start_idx as u8;
    tail += 1;

    while head < tail {
        let cur_idx = queue[head] as usize;
        head += 1;
        let cur_dist = dist[cur_idx];
        let cur_cell = coord_from_index(cur_idx);

        if is_goal_cell(cur_cell, goal, mode) {
            return cur_dist as i32;
        }

        for (dr, dc) in DIRS {
            let next = CellCoord {
                row: cur_cell.row + dr,
                col: cur_cell.col + dc,
            };
            if next.row >= 0 && next.row < BOARD_SIZE && next.col >= 0 && next.col < BOARD_SIZE {
                if !board.is_blocked(cur_cell, next) {
                    let next_idx = cell_index(next);
                    if dist[next_idx] == -1 {
                        dist[next_idx] = cur_dist + 1;
                        queue[tail] = next_idx as u8;
                        tail += 1;
                    }
                }
            }
        }
    }

    -1 // unreachable
}

pub fn shortest_path(from: CellCoord, goal: GoalDirection, board: &Board, mode: &str) -> Option<Vec<CellCoord>> {
    if is_goal_cell(from, goal, mode) {
        return Some(vec![]);
    }

    let mut parent = [255u8; BOARD_CELLS];
    let mut visited = [false; BOARD_CELLS];
    let mut queue = [0u8; BOARD_CELLS];
    let mut head = 0usize;
    let mut tail = 0usize;

    let start_idx = cell_index(from);
    visited[start_idx] = true;
    queue[tail] = start_idx as u8;
    tail += 1;

    let mut goal_idx: Option<usize> = None;

    while head < tail {
        let cur_idx = queue[head] as usize;
        head += 1;
        let cur_cell = coord_from_index(cur_idx);

        if is_goal_cell(cur_cell, goal, mode) {
            goal_idx = Some(cur_idx);
            break;
        }

        for (dr, dc) in DIRS {
            let next = CellCoord {
                row: cur_cell.row + dr,
                col: cur_cell.col + dc,
            };
            if next.row >= 0 && next.row < BOARD_SIZE && next.col >= 0 && next.col < BOARD_SIZE {
                if !board.is_blocked(cur_cell, next) {
                    let next_idx = cell_index(next);
                    if !visited[next_idx] {
                        visited[next_idx] = true;
                        parent[next_idx] = cur_idx as u8;
                        queue[tail] = next_idx as u8;
                        tail += 1;
                    }
                }
            }
        }
    }

    if let Some(mut cur) = goal_idx {
        let mut path = Vec::with_capacity(16);
        while cur != start_idx {
            path.push(coord_from_index(cur));
            cur = parent[cur] as usize;
        }
        path.reverse();
        Some(path)
    } else {
        None
    }
}

pub fn has_path_to_goal(from: CellCoord, goal: GoalDirection, board: &Board, mode: &str) -> bool {
    shortest_distance(from, goal, board, mode) >= 0
}
