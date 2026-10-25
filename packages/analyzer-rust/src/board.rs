use crate::types::{CellCoord, Orientation, WallCoord};

pub const BOARD_SIZE: i8 = 9;
pub const WALL_GRID_SIZE: i8 = 8;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct Board {
    pub h_walls: u64,
    pub v_walls: u64,
}

impl Board {
    #[inline(always)]
    pub fn new() -> Self {
        Self {
            h_walls: 0,
            v_walls: 0,
        }
    }

    pub fn from_walls(walls: &[WallCoord]) -> Self {
        let mut board = Self::new();
        for w in walls {
            board.place_wall(w);
        }
        board
    }

    #[inline(always)]
    fn bit_index(row: i8, col: i8) -> Option<u32> {
        if !(0..WALL_GRID_SIZE).contains(&row) || !(0..WALL_GRID_SIZE).contains(&col) {
            None
        } else {
            Some((row as u32) * 8 + (col as u32))
        }
    }

    #[inline(always)]
    pub fn has_wall(&self, row: i8, col: i8, orientation: Orientation) -> bool {
        match Self::bit_index(row, col) {
            Some(idx) => match orientation {
                Orientation::H => (self.h_walls & (1u64 << idx)) != 0,
                Orientation::V => (self.v_walls & (1u64 << idx)) != 0,
            },
            None => false,
        }
    }

    #[inline(always)]
    pub fn is_blocked(&self, from: CellCoord, to: CellCoord) -> bool {
        if to.row == from.row + 1 && to.col == from.col {
            self.has_wall(from.row, from.col, Orientation::H)
                || self.has_wall(from.row, from.col - 1, Orientation::H)
        } else if to.row == from.row - 1 && to.col == from.col {
            self.has_wall(to.row, from.col, Orientation::H)
                || self.has_wall(to.row, from.col - 1, Orientation::H)
        } else if to.col == from.col + 1 && to.row == from.row {
            self.has_wall(from.row, from.col, Orientation::V)
                || self.has_wall(from.row - 1, from.col, Orientation::V)
        } else if to.col == from.col - 1 && to.row == from.row {
            self.has_wall(from.row, to.col, Orientation::V)
                || self.has_wall(from.row - 1, to.col, Orientation::V)
        } else {
            false
        }
    }

    #[inline(always)]
    pub fn can_place_wall_geometry(&self, r: u8, c: u8, is_horizontal: bool) -> bool {
        if r >= 8 || c >= 8 {
            return false;
        }
        let idx = (r * 8 + c) as u64;
        let bit = 1u64 << idx;

        // Cross-orientation collision at exact intersection (r, c)
        if ((self.h_walls | self.v_walls) & bit) != 0 {
            return false;
        }

        if is_horizontal {
            // Check left (r, c-1) and right (r, c+1) horizontal overlap
            let left_conflict = c > 0 && (self.h_walls & (1u64 << (idx - 1))) != 0;
            let right_conflict = c < 7 && (self.h_walls & (1u64 << (idx + 1))) != 0;
            !(left_conflict || right_conflict)
        } else {
            // Check up (r-1, c) and down (r+1, c) vertical overlap
            let up_conflict = r > 0 && (self.v_walls & (1u64 << (idx - 8))) != 0;
            let down_conflict = r < 7 && (self.v_walls & (1u64 << (idx + 8))) != 0;
            !(up_conflict || down_conflict)
        }
    }

    #[inline(always)]
    pub fn does_wall_conflict(&self, wall: &WallCoord) -> bool {
        if wall.row < 0 || wall.row >= WALL_GRID_SIZE || wall.col < 0 || wall.col >= WALL_GRID_SIZE {
            return true;
        }
        !self.can_place_wall_geometry(
            wall.row as u8,
            wall.col as u8,
            wall.orientation == Orientation::H,
        )
    }

    #[inline(always)]
    pub fn place_wall_raw(&mut self, r: u8, c: u8, is_horizontal: bool) {
        let bit = 1u64 << ((r * 8 + c) as u64);
        if is_horizontal {
            self.h_walls |= bit;
        } else {
            self.v_walls |= bit;
        }
    }

    #[inline(always)]
    pub fn remove_wall_raw(&mut self, r: u8, c: u8, is_horizontal: bool) {
        let bit = 1u64 << ((r * 8 + c) as u64);
        if is_horizontal {
            self.h_walls &= !bit;
        } else {
            self.v_walls &= !bit;
        }
    }

    #[inline(always)]
    pub fn place_wall(&mut self, wall: &WallCoord) {
        if let Some(idx) = Self::bit_index(wall.row, wall.col) {
            match wall.orientation {
                Orientation::H => self.h_walls |= 1u64 << idx,
                Orientation::V => self.v_walls |= 1u64 << idx,
            }
        }
    }

    #[inline(always)]
    pub fn remove_wall(&mut self, wall: &WallCoord) {
        if let Some(idx) = Self::bit_index(wall.row, wall.col) {
            match wall.orientation {
                Orientation::H => self.h_walls &= !(1u64 << idx),
                Orientation::V => self.v_walls &= !(1u64 << idx),
            }
        }
    }
}
