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

const LEFT_COL_MASK: u128 = {
    let mut m = 0u128;
    let mut r = 0;
    while r < 9 {
        m |= 1u128 << (r * 9);
        r += 1;
    }
    m
};

const RIGHT_COL_MASK: u128 = LEFT_COL_MASK << 8;

#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum GoalMask {
    TopRow,      // Row 0
    BottomRow,   // Row 8
    LeftCol,     // Col 0
    RightCol,    // Col 8
    CenterCell,  // (4, 4) -> bit 40
}

impl GoalMask {
    #[inline(always)]
    pub const fn mask(self) -> u128 {
        match self {
            GoalMask::TopRow => 0x1FFu128,
            GoalMask::BottomRow => 0x1FFu128 << 72,
            GoalMask::LeftCol => LEFT_COL_MASK,
            GoalMask::RightCol => RIGHT_COL_MASK,
            GoalMask::CenterCell => 1u128 << (4 * 9 + 4),
        }
    }

    #[inline(always)]
    pub fn from_goal_and_mode(goal: GoalDirection, mode: &str) -> Self {
        if mode == "center2" || mode == "center3" {
            GoalMask::CenterCell
        } else {
            match goal {
                GoalDirection::Top => GoalMask::TopRow,
                GoalDirection::Bottom => GoalMask::BottomRow,
                GoalDirection::Left => GoalMask::LeftCol,
                GoalDirection::Right => GoalMask::RightCol,
                GoalDirection::Center => GoalMask::CenterCell,
            }
        }
    }
}

#[derive(Copy, Clone, Debug, PartialEq, Eq, Default)]
pub struct EdgeMasks {
    pub can_north: u128, // Bit (r*9+c) is 1 if cell can step to (r-1, c)
    pub can_south: u128, // Bit (r*9+c) is 1 if cell can step to (r+1, c)
    pub can_west: u128,  // Bit (r*9+c) is 1 if cell can step to (r, c-1)
    pub can_east: u128,  // Bit (r*9+c) is 1 if cell can step to (r, c+1)
}

impl EdgeMasks {
    #[inline]
    pub fn from_board(board: &Board) -> Self {
        let full_board: u128 = (1u128 << 81) - 1;
        let not_top_row: u128 = full_board & !0x1FFu128;
        let not_bottom_row: u128 = full_board & !(0x1FFu128 << 72);
        let not_left_col: u128 = full_board & !LEFT_COL_MASK;
        let not_right_col: u128 = full_board & !RIGHT_COL_MASK;

        let mut blocked_south: u128 = 0;
        let mut blocked_east: u128 = 0;

        // Expand 8x8 wall bits into 9x9 cell transition blocks
        let mut hw = board.h_walls;
        while hw != 0 {
            let idx = hw.trailing_zeros() as u32;
            hw &= hw - 1;
            let r = idx / 8;
            let c = idx % 8;
            let cell_bit = 1u128 << (r * 9 + c);
            // Horizontal wall at (r, c) blocks South from (r, c) and (r, c+1)
            blocked_south |= cell_bit | (cell_bit << 1);
        }

        let mut vw = board.v_walls;
        while vw != 0 {
            let idx = vw.trailing_zeros() as u32;
            vw &= vw - 1;
            let r = idx / 8;
            let c = idx % 8;
            let cell_bit = 1u128 << (r * 9 + c);
            // Vertical wall at (r, c) blocks East from (r, c) and (r+1, c)
            blocked_east |= cell_bit | (cell_bit << 9);
        }

        let can_south = not_bottom_row & !blocked_south;
        let can_north = not_top_row & !(blocked_south << 9);
        let can_east = not_right_col & !blocked_east;
        let can_west = not_left_col & !(blocked_east << 1);

        Self {
            can_north,
            can_south,
            can_west,
            can_east,
        }
    }

    /// Zero-allocation bitwise BFS returning exact shortest distance (-1 if trapped)
    #[inline(always)]
    pub fn shortest_distance(&self, start_r: u8, start_c: u8, goal: GoalMask) -> i32 {
        if start_r >= 9 || start_c >= 9 {
            return -1;
        }
        let start_bit = 1u128 << (start_r as u32 * 9 + start_c as u32);
        let target = goal.mask();
        if (start_bit & target) != 0 {
            return 0;
        }

        let mut visited = start_bit;
        let mut frontier = start_bit;
        let mut dist = 0;

        while frontier != 0 {
            dist += 1;
            let next_n = (frontier & self.can_north) >> 9;
            let next_s = (frontier & self.can_south) << 9;
            let next_w = (frontier & self.can_west) >> 1;
            let next_e = (frontier & self.can_east) << 1;

            frontier = (next_n | next_s | next_w | next_e) & !visited;
            if (frontier & target) != 0 {
                return dist;
            }
            visited |= frontier;
        }
        -1
    }

    /// Computes both shortest distance AND a 128-bit mask of all cells lying on ANY shortest path
    #[inline]
    pub fn shortest_path_corridor(&self, start_r: u8, start_c: u8, goal: GoalMask) -> (i32, u128) {
        if start_r >= 9 || start_c >= 9 {
            return (-1, 0);
        }
        let start_bit = 1u128 << (start_r as u32 * 9 + start_c as u32);
        let target = goal.mask();
        if (start_bit & target) != 0 {
            return (0, start_bit);
        }

        let mut layers = [0u128; 82];
        layers[0] = start_bit;
        let mut visited = start_bit;
        let mut frontier = start_bit;
        let mut dist = 0usize;

        while frontier != 0 && dist < 81 {
            dist += 1;
            let next_n = (frontier & self.can_north) >> 9;
            let next_s = (frontier & self.can_south) << 9;
            let next_w = (frontier & self.can_west) >> 1;
            let next_e = (frontier & self.can_east) << 1;

            frontier = (next_n | next_s | next_w | next_e) & !visited;
            layers[dist] = frontier;
            if (frontier & target) != 0 {
                // Backward pass from goal to mark EVERY cell that participates in ANY shortest path
                let mut corridor = frontier & target;
                let mut rev = corridor;
                for d in (0..dist).rev() {
                    let prev_from_n = (rev << 9) & self.can_north;
                    let prev_from_s = (rev >> 9) & self.can_south;
                    let prev_from_w = (rev << 1) & self.can_west;
                    let prev_from_e = (rev >> 1) & self.can_east;
                    rev = (prev_from_n | prev_from_s | prev_from_w | prev_from_e) & layers[d];
                    corridor |= rev;
                }
                return (dist as i32, corridor);
            }
            visited |= frontier;
        }
        (-1, 0)
    }

    /// Computes shortest distance from EVERY cell to goal_row (0 for TopRow, 8 for BottomRow)
    /// in a single reverse bitwise BFS pass.
    #[inline]
    pub fn all_cell_distances_to_row(&self, goal_row: u8) -> [f32; 81] {
        let mut dists = [80.0f32; 81];
        let start_mask: u128 = if goal_row == 0 {
            0x1FFu128 // Row 0
        } else {
            0x1FFu128 << 72 // Row 8
        };

        let mut visited = start_mask;
        let mut frontier = start_mask;

        let mut temp = start_mask;
        while temp != 0 {
            let idx = temp.trailing_zeros() as usize;
            temp &= temp - 1;
            if idx < 81 {
                dists[idx] = 0.0;
            }
        }

        let mut d = 0;
        while frontier != 0 && d < 80 {
            d += 1;
            let next_n = (frontier & self.can_north) >> 9;
            let next_s = (frontier & self.can_south) << 9;
            let next_w = (frontier & self.can_west) >> 1;
            let next_e = (frontier & self.can_east) << 1;

            frontier = (next_n | next_s | next_w | next_e) & !visited;
            let mut layer = frontier;
            while layer != 0 {
                let idx = layer.trailing_zeros() as usize;
                layer &= layer - 1;
                if idx < 81 {
                    dists[idx] = d as f32;
                }
            }
            visited |= frontier;
        }

        dists
    }
}

#[inline(always)]
pub fn is_center_goal_mode(mode: &str) -> bool {
    mode == "center2" || mode == "center3"
}

#[inline(always)]
pub fn is_goal_cell(c: CellCoord, goal: GoalDirection, mode: &str) -> bool {
    if c.row < 0 || c.row >= BOARD_SIZE || c.col < 0 || c.col >= BOARD_SIZE {
        return false;
    }
    let mask = GoalMask::from_goal_and_mode(goal, mode).mask();
    let bit = 1u128 << (c.row as u32 * 9 + c.col as u32);
    (bit & mask) != 0
}

pub fn shortest_distance(from: CellCoord, goal: GoalDirection, board: &Board, mode: &str) -> i32 {
    let edge_masks = EdgeMasks::from_board(board);
    let goal_mask = GoalMask::from_goal_and_mode(goal, mode);
    edge_masks.shortest_distance(from.row as u8, from.col as u8, goal_mask)
}

pub fn shortest_path(
    from: CellCoord,
    goal: GoalDirection,
    board: &Board,
    mode: &str,
) -> Option<Vec<CellCoord>> {
    let edge_masks = EdgeMasks::from_board(board);
    let goal_mask = GoalMask::from_goal_and_mode(goal, mode);
    let (dist, corridor) =
        edge_masks.shortest_path_corridor(from.row as u8, from.col as u8, goal_mask);
    if dist < 0 {
        return None;
    }
    if dist == 0 {
        return Some(vec![]);
    }

    let mut path = Vec::with_capacity(dist as usize);
    let mut cur_r = from.row as u8;
    let mut cur_c = from.col as u8;

    for step in 1..=dist {
        let expected_dist = dist - step;
        let cur_bit = 1u128 << (cur_r as u32 * 9 + cur_c as u32);

        let neighbors = [
            (cur_r.wrapping_sub(1), cur_c, (cur_bit & edge_masks.can_north) != 0), // North
            (cur_r + 1, cur_c, (cur_bit & edge_masks.can_south) != 0),             // South
            (cur_r, cur_c.wrapping_sub(1), (cur_bit & edge_masks.can_west) != 0),  // West
            (cur_r, cur_c + 1, (cur_bit & edge_masks.can_east) != 0),             // East
        ];

        let mut next_coord = None;
        for (nr, nc, can_step) in neighbors {
            if can_step && nr < 9 && nc < 9 {
                let n_bit = 1u128 << (nr as u32 * 9 + nc as u32);
                if (n_bit & corridor) != 0 {
                    let d = edge_masks.shortest_distance(nr, nc, goal_mask);
                    if d == expected_dist {
                        next_coord = Some((nr, nc));
                        break;
                    }
                }
            }
        }

        if let Some((nr, nc)) = next_coord {
            path.push(CellCoord {
                row: nr as i8,
                col: nc as i8,
            });
            cur_r = nr;
            cur_c = nc;
        } else {
            break;
        }
    }

    Some(path)
}

pub fn has_path_to_goal(from: CellCoord, goal: GoalDirection, board: &Board, mode: &str) -> bool {
    shortest_distance(from, goal, board, mode) >= 0
}

/// Bitwise representation of all graph edges traversed by a player's shortest path.
/// Used for zero-BFS fast-rejection of candidate wall placements.
#[derive(Copy, Clone, Debug, Default, PartialEq, Eq)]
pub struct PlayerPathEdges {
    pub v_edges: u128, // Bit (r*9 + c) for vertical step between (r, c) and (r+1, c)
    pub h_edges: u128, // Bit (r*8 + c) for horizontal step between (r, c) and (r, c+1)
}

impl PlayerPathEdges {
    #[inline(always)]
    pub fn intersects_h_wall(&self, r: u8, c: u8) -> bool {
        if r >= 8 || c >= 8 {
            return true;
        }
        let mask = (1u128 << (r as usize * 9 + c as usize))
            | (1u128 << (r as usize * 9 + c as usize + 1));
        (self.v_edges & mask) != 0
    }

    #[inline(always)]
    pub fn intersects_v_wall(&self, r: u8, c: u8) -> bool {
        if r >= 8 || c >= 8 {
            return true;
        }
        let mask = (1u128 << (r as usize * 8 + c as usize))
            | (1u128 << ((r as usize + 1) * 8 + c as usize));
        (self.h_edges & mask) != 0
    }
}

pub fn compute_player_path_edges(
    from: CellCoord,
    goal: GoalDirection,
    board: &Board,
    mode: &str,
) -> PlayerPathEdges {
    let mut edges = PlayerPathEdges::default();
    if let Some(path) = shortest_path(from, goal, board, mode) {
        let mut prev = from;
        for curr in path {
            if curr.row == prev.row + 1 && curr.col == prev.col {
                if prev.row >= 0 && prev.row < 8 && prev.col >= 0 && prev.col < 9 {
                    edges.v_edges |= 1u128 << (prev.row as usize * 9 + prev.col as usize);
                }
            } else if curr.row == prev.row - 1 && curr.col == prev.col {
                if curr.row >= 0 && curr.row < 8 && curr.col >= 0 && curr.col < 9 {
                    edges.v_edges |= 1u128 << (curr.row as usize * 9 + curr.col as usize);
                }
            } else if curr.col == prev.col + 1 && curr.row == prev.row {
                if prev.row >= 0 && prev.row < 9 && prev.col >= 0 && prev.col < 8 {
                    edges.h_edges |= 1u128 << (prev.row as usize * 8 + prev.col as usize);
                }
            } else if curr.col == prev.col - 1 && curr.row == prev.row {
                if curr.row >= 0 && curr.row < 9 && curr.col >= 0 && curr.col < 8 {
                    edges.h_edges |= 1u128 << (curr.row as usize * 8 + curr.col as usize);
                }
            }
            prev = curr;
        }
    }
    edges
}
