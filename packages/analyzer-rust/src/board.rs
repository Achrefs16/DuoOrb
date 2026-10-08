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
        Self { h_walls: 0, v_walls: 0 }
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
        if row < 0 || row >= WALL_GRID_SIZE || col < 0 || col >= WALL_GRID_SIZE {
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
    pub fn does_wall_conflict(&self, wall: &WallCoord) -> bool {
        let (row, col) = (wall.row, wall.col);
        if row < 0 || row >= WALL_GRID_SIZE || col < 0 || col >= WALL_GRID_SIZE {
            return true;
        }

        // 1. Cross collision: H and V cannot cross at the same intersection
        if self.has_wall(row, col, Orientation::H) || self.has_wall(row, col, Orientation::V) {
            return true;
        }

        match wall.orientation {
            Orientation::H => {
                // Overlaps left or right by 1
                self.has_wall(row, col - 1, Orientation::H) || self.has_wall(row, col + 1, Orientation::H)
            }
            Orientation::V => {
                // Overlaps up or down by 1
                self.has_wall(row - 1, col, Orientation::V) || self.has_wall(row + 1, col, Orientation::V)
            }
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
