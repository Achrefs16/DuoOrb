use std::path::Path;
use std::sync::Arc;
use tract_onnx::prelude::*;

use crate::board::Board;
use crate::types::{CellCoord, GameAction, GameState, Orientation, WallCoord};

pub const BOARD_DIM: usize = 9;
pub const WALL_DIM: usize = 8;
pub const NUM_CHANNELS: usize = 8;
pub const ACTION_SPACE: usize = 136; // 8 pawn dirs + 64 H-walls + 64 V-walls

/// All 8 pawn move directions in SigmaQuoridor coordinates: (dx, dy)
/// 0: Up (0, 1)
/// 1: Down (0, -1)
/// 2: Left (-1, 0)
/// 3: Right (1, 0)
/// 4: Up-Left (-1, 1)
/// 5: Up-Right (1, 1)
/// 6: Down-Left (-1, -1)
/// 7: Down-Right (1, -1)
const SIGMA_PAWN_DIRS: [(i8, i8); 8] = [
    (0, 1),
    (0, -1),
    (-1, 0),
    (1, 0),
    (-1, 1),
    (1, 1),
    (-1, -1),
    (1, -1),
];

pub type RunnableOnnxModel = RunnableModel<TypedFact, Box<dyn TypedOp>, Graph<TypedFact, Box<dyn TypedOp>>>;

pub struct NeuralEvaluator {
    model: Arc<RunnableOnnxModel>,
}

#[derive(Debug, Clone)]
pub struct NeuralPrediction {
    pub policy_logits: Vec<f32>,
    pub policy_probs: Vec<f32>,
    pub value: f32,
}

#[derive(Debug, Clone)]
pub struct RankedNeuralAction {
    pub action: GameAction,
    pub prior: f32,
    pub logit: f32,
}

impl NeuralEvaluator {
    /// Load an ONNX model from file path and optimize it for inference.
    pub fn load_from_path<P: AsRef<Path>>(path: P) -> TractResult<Self> {
        let model = tract_onnx::onnx()
            .model_for_path(path)?
            .with_input_fact(0, f32::fact([1, NUM_CHANNELS, BOARD_DIM, BOARD_DIM]).into())?
            .into_optimized()?
            .into_runnable()?;
        Ok(Self {
            model: Arc::new(model),
        })
    }

    /// Load an ONNX model directly from in-memory byte slice (useful for mobile assets & embedded).
    pub fn load_from_bytes(bytes: &[u8]) -> TractResult<Self> {
        let mut cursor = std::io::Cursor::new(bytes);
        let model = tract_onnx::onnx()
            .model_for_read(&mut cursor)?
            .with_input_fact(0, f32::fact([1, NUM_CHANNELS, BOARD_DIM, BOARD_DIM]).into())?
            .into_optimized()?
            .into_runnable()?;
        Ok(Self {
            model: Arc::new(model),
        })
    }

    /// Run inference for the current player's perspective.
    pub fn evaluate(&self, state: &GameState) -> TractResult<NeuralPrediction> {
        let tensor_data = encode_board_tensor(state);
        let tensor = tract_ndarray::Array4::from_shape_vec(
            (1, NUM_CHANNELS, BOARD_DIM, BOARD_DIM),
            tensor_data,
        )
        .map_err(|e| anyhow::anyhow!("Tensor shape error: {}", e))?;

        let tract_tensor: Tensor = tensor.into();
        let outputs = self.model.run(tvec!(tract_tensor.into()))?;

        // Extract outputs: "policy_logits" (1x136) and "value" (1x1 or scalar)
        // Tract outputs are returned in the order defined by the ONNX graph.
        let policy_view = outputs[0].to_array_view::<f32>()?;
        let value_view = outputs[1].to_array_view::<f32>()?;

        let policy_logits = policy_view.iter().copied().collect::<Vec<f32>>();
        let value = value_view.iter().copied().next().unwrap_or(0.0);

        // Compute softmax for policy probabilities
        let max_logit = policy_logits.iter().copied().fold(f32::NEG_INFINITY, f32::max);
        let exp_sum: f32 = policy_logits.iter().map(|&x| (x - max_logit).exp()).sum();
        let policy_probs: Vec<f32> = if exp_sum > 0.0 {
            policy_logits.iter().map(|&x| (x - max_logit).exp() / exp_sum).collect()
        } else {
            vec![1.0 / ACTION_SPACE as f32; ACTION_SPACE]
        };

        Ok(NeuralPrediction {
            policy_logits,
            policy_probs,
            value,
        })
    }

    /// Return ranked legal actions from the neural prediction for the current state.
    pub fn get_ranked_legal_actions(&self, state: &GameState) -> TractResult<Vec<RankedNeuralAction>> {
        let prediction = self.evaluate(state)?;
        let mover_idx = state.current_player_index;
        let is_p2 = mover_idx == 1;

        let mut ranked = Vec::new();

        for (action_idx, &prior) in prediction.policy_probs.iter().enumerate() {
            if let Some(action) = map_index_to_action(state, action_idx, is_p2) {
                if crate::rules::is_legal_action(state, &action) {
                    ranked.push(RankedNeuralAction {
                        action,
                        prior,
                        logit: prediction.policy_logits[action_idx],
                    });
                }
            }
        }

        // Sort by prior probability descending
        ranked.sort_by(|a, b| b.prior.partial_cmp(&a.prior).unwrap_or(std::cmp::Ordering::Equal));
        Ok(ranked)
    }
}

/// Encode the GameState into an 8-channel 9x9 float tensor from the mover's canonical perspective.
pub fn encode_board_tensor(state: &GameState) -> Vec<f32> {
    let mut planes = vec![0.0f32; NUM_CHANNELS * BOARD_DIM * BOARD_DIM];
    if state.players.is_empty() {
        return planes;
    }

    let mover_idx = state.current_player_index;
    let opp_idx = if mover_idx == 0 { 1 } else { 0 };

    let mover = &state.players[mover_idx];
    let opp = if state.players.len() > opp_idx {
        &state.players[opp_idx]
    } else {
        mover
    };

    let is_p2 = mover_idx == 1;

    // DuoOrb -> SigmaQuoridor coordinates:
    // DuoOrb row: 0 is top, 8 is bottom. col: 0 is left, 8 is right.
    // SigmaQuoridor: y=0 is bottom, y=8 is top. x=0 is left, x=8 is right.
    // sigma_x = col
    // sigma_y = 8 - row
    let (mover_sx, mover_sy) = (mover.position.col, 8 - mover.position.row);
    let (opp_sx, opp_sy) = (opp.position.col, 8 - opp.position.row);

    // Canonical perspective: if Player 2's turn, flip vertically so mover moves towards y=8
    let (my_x, my_y, opp_x, opp_y) = if !is_p2 {
        (mover_sx, mover_sy, opp_sx, opp_sy)
    } else {
        (mover_sx, 8 - mover_sy, opp_sx, 8 - opp_sy)
    };

    // Helper to index [channel, y, x] in flat buffer
    let idx = |ch: usize, y: usize, x: usize| -> usize {
        ch * (BOARD_DIM * BOARD_DIM) + y * BOARD_DIM + x
    };

    // Channel 0: My pawn 1-hot
    if (0..9).contains(&my_x) && (0..9).contains(&my_y) {
        planes[idx(0, my_y as usize, my_x as usize)] = 1.0;
    }

    // Channel 1: Opponent pawn 1-hot
    if (0..9).contains(&opp_x) && (0..9).contains(&opp_y) {
        planes[idx(1, opp_y as usize, opp_x as usize)] = 1.0;
    }

    // Channels 2 & 3: Wall matrices (2 = H, 3 = V)
    // In SigmaQuoridor (game.py lines 694-701 & 950-951):
    // Horizontal wall at (x, y) covers TWO cells: (y, x) and (y, x + 1) in hwalls.
    // Vertical wall at (x, y) covers TWO cells: (y, x) and (y + 1, x) in vwalls.
    let mut hw = [0.0f32; BOARD_DIM * BOARD_DIM];
    let mut vw = [0.0f32; BOARD_DIM * BOARD_DIM];

    for wall in &state.walls {
        let wx = wall.col as usize;
        let wy = (7 - wall.row) as usize; // DuoOrb row 0..7 -> SigmaQuoridor y 0..7
        if wx < 8 && wy < 8 {
            match wall.orientation {
                Orientation::H => {
                    hw[wy * BOARD_DIM + wx] = 1.0;
                    hw[wy * BOARD_DIM + (wx + 1)] = 1.0;
                }
                Orientation::V => {
                    vw[wy * BOARD_DIM + wx] = 1.0;
                    vw[(wy + 1) * BOARD_DIM + wx] = 1.0;
                }
            }
        }
    }

    // Populate channels 2 & 3 with vertical canonical flipping when P2:
    // SigmaQuoridor game.py lines 897-903:
    // flipped_hw[:N - 1] = hw[:N - 1][::-1]  (rows 0..7 reversed: y -> 7 - y)
    // flipped_vw = vw[::-1].copy()            (rows 0..8 reversed: y -> 8 - y)
    for y in 0..BOARD_DIM {
        for x in 0..BOARD_DIM {
            if !is_p2 {
                planes[idx(2, y, x)] = hw[y * BOARD_DIM + x];
                planes[idx(3, y, x)] = vw[y * BOARD_DIM + x];
            } else {
                planes[idx(2, y, x)] = if y < 8 {
                    hw[(7 - y) * BOARD_DIM + x]
                } else {
                    0.0
                };
                planes[idx(3, y, x)] = vw[(8 - y) * BOARD_DIM + x];
            }
        }
    }

    // Channels 4 & 5: Remaining walls normalized by 10.0
    let norm = 10.0f32;
    let my_walls_val = (mover.walls_remaining.max(0) as f32) / norm;
    let opp_walls_val = (opp.walls_remaining.max(0) as f32) / norm;
    for y in 0..BOARD_DIM {
        for x in 0..BOARD_DIM {
            planes[idx(4, y, x)] = my_walls_val;
            planes[idx(5, y, x)] = opp_walls_val;
        }
    }

    // Channels 6 & 7: BFS distance grids to mover's goal (Row 8 in canonical view) and opponent goal (Row 0)
    // SigmaQuoridor game.py lines 894 & 904:
    // P1 canonical: my_dist = p1_dist, opp_dist = p2_dist
    // P2 canonical: my_dist = p2_dist[::-1], opp_dist = p1_dist[::-1]
    let board = Board::from_walls(&state.walls);
    let edge_masks = crate::pathfinding::EdgeMasks::from_board(&board);
    let d1_all = edge_masks.all_cell_distances_to_row(0); // Goal Top (row 0)
    let d2_all = edge_masks.all_cell_distances_to_row(8); // Goal Bottom (row 8)

    let mut p1_dist_grid = [80.0f32; BOARD_DIM * BOARD_DIM];
    let mut p2_dist_grid = [80.0f32; BOARD_DIM * BOARD_DIM];

    for r in 0..9 {
        for c in 0..9 {
            let cell_idx = r * 9 + c;
            let sy = 8 - r; // SigmaQuoridor y: 0 is bottom (DuoOrb row 8), 8 is top (DuoOrb row 0)
            let sx = c;
            p1_dist_grid[sy * BOARD_DIM + sx] = d1_all[cell_idx];
            p2_dist_grid[sy * BOARD_DIM + sx] = d2_all[cell_idx];
        }
    }

    let max_dist = 80.0f32;
    for y in 0..BOARD_DIM {
        for x in 0..BOARD_DIM {
            if !is_p2 {
                planes[idx(6, y, x)] = (p1_dist_grid[y * BOARD_DIM + x] / max_dist).clamp(0.0, 1.0);
                planes[idx(7, y, x)] = (p2_dist_grid[y * BOARD_DIM + x] / max_dist).clamp(0.0, 1.0);
            } else {
                planes[idx(6, y, x)] = (p2_dist_grid[(8 - y) * BOARD_DIM + x] / max_dist).clamp(0.0, 1.0);
                planes[idx(7, y, x)] = (p1_dist_grid[(8 - y) * BOARD_DIM + x] / max_dist).clamp(0.0, 1.0);
            }
        }
    }

    planes
}

/// Map an ONNX policy action index (0..136) back to a DuoOrb GameAction.
///
/// In SigmaQuoridor (game.py lines 743-754):
/// - Actions 0..3: Orthogonal moves (Up, Down, Left, Right).
///   If the adjacent cell is occupied by ANY active opponent, the move is a STRAIGHT JUMP
///   landing two cells ahead (cx + 2*dx, cy + 2*dy).
/// - Actions 4..7: Diagonal moves (Up-Left, Up-Right, Down-Left, Down-Right).
///   Represents a go-around jump when the straight continuation is blocked, landing at (cx + dx, cy + dy).
/// - Actions 8..135: Wall placements (64 H-walls + 64 V-walls).
pub fn map_index_to_action(state: &GameState, action_idx: usize, is_p2: bool) -> Option<GameAction> {
    let mover_idx = state.current_player_index;
    let mover = state.players.get(mover_idx)?;

    if action_idx < 8 {
        // Pawn move
        let (dx, dy) = SIGMA_PAWN_DIRS[action_idx];
        // Translate canonical direction to DuoOrb (row, col) delta:
        // Canonical (dx, dy): dy = 1 is toward mover's goal row (increasing y)
        // For P1: goal is row 0 (top, decreasing row), so d_row = -dy, d_col = dx
        // For P2: goal is row 8 (bottom, increasing row), so d_row = dy, d_col = dx
        let (d_row, d_col) = if !is_p2 {
            (-dy, dx)
        } else {
            (dy, dx)
        };

        let cur_row = mover.position.row;
        let cur_col = mover.position.col;

        let (target_row, target_col) = if action_idx < 4 {
            // Orthogonal direction: check if an opponent occupies the immediately adjacent step
            let step_row = cur_row + d_row;
            let step_col = cur_col + d_col;
            let is_opp_on_step = state.players.iter().any(|p| {
                p.index != mover_idx
                    && p.status == "ACTIVE"
                    && p.position.row == step_row
                    && p.position.col == step_col
            });

            if is_opp_on_step {
                // Straight jump lands two steps ahead
                (cur_row + 2 * d_row, cur_col + 2 * d_col)
            } else {
                (step_row, step_col)
            }
        } else {
            // Diagonal go-around jump lands one step in each component
            (cur_row + d_row, cur_col + d_col)
        };

        if (0..9).contains(&target_row) && (0..9).contains(&target_col) {
            Some(GameAction::Move {
                to: CellCoord {
                    row: target_row,
                    col: target_col,
                },
            })
        } else {
            None
        }
    } else {
        // Wall placement
        let wall_idx = action_idx - 8;
        let is_v = wall_idx >= 64;
        let slot_idx = if is_v { wall_idx - 64 } else { wall_idx };

        let wx = (slot_idx % 8) as i8;
        let wy_canon = (slot_idx / 8) as i8;

        // In canonical perspective, wy_canon = 7 is nearest the mover's goal.
        // For P1: wy_real = wy_canon, DuoOrb row = 7 - wy_real = 7 - wy_canon
        // For P2: wy_real = 7 - wy_canon, DuoOrb row = 7 - wy_real = wy_canon
        let row = if !is_p2 {
            7 - wy_canon
        } else {
            wy_canon
        };
        let col = wx;

        if (0..8).contains(&row) && (0..8).contains(&col) {
            Some(GameAction::PlaceWall {
                wall: WallCoord {
                    row,
                    col,
                    orientation: if is_v { Orientation::V } else { Orientation::H },
                },
            })
        } else {
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{GoalDirection, PlayerState};

    fn initial_state_2p() -> GameState {
        GameState {
            game_id: "test-neural".to_string(),
            mode: "2p".to_string(),
            current_player_index: 0,
            players: vec![
                PlayerState {
                    id: "p1".to_string(),
                    index: 0,
                    display_name: "Player 1".to_string(),
                    position: CellCoord { row: 8, col: 4 },
                    walls_remaining: 10,
                    goal_direction: GoalDirection::Top,
                    status: "ACTIVE".to_string(),
                },
                PlayerState {
                    id: "p2".to_string(),
                    index: 1,
                    display_name: "Player 2".to_string(),
                    position: CellCoord { row: 0, col: 4 },
                    walls_remaining: 10,
                    goal_direction: GoalDirection::Bottom,
                    status: "ACTIVE".to_string(),
                },
            ],
            walls: vec![],
            move_number: 0,
            status: "IN_PROGRESS".to_string(),
        }
    }

    #[test]
    fn tensor_encoding_produces_exact_dimensions() {
        let state = initial_state_2p();
        let tensor = encode_board_tensor(&state);
        assert_eq!(tensor.len(), NUM_CHANNELS * BOARD_DIM * BOARD_DIM);
    }

    #[test]
    fn neural_evaluator_loads_and_evaluates_initial_board() {
        let model_path = if Path::new("models/quoridor_9x9.onnx").exists() {
            Path::new("models/quoridor_9x9.onnx").to_path_buf()
        } else if Path::new("packages/analyzer-rust/models/quoridor_9x9.onnx").exists() {
            Path::new("packages/analyzer-rust/models/quoridor_9x9.onnx").to_path_buf()
        } else {
            panic!("Model file not found at either models/quoridor_9x9.onnx or packages/analyzer-rust/models/quoridor_9x9.onnx");
        };

        let evaluator = NeuralEvaluator::load_from_path(&model_path).expect("Failed to load ONNX model");
        let state = initial_state_2p();

        let prediction = evaluator.evaluate(&state).expect("Evaluation failed");
        assert_eq!(prediction.policy_logits.len(), ACTION_SPACE);
        assert_eq!(prediction.policy_probs.len(), ACTION_SPACE);
        assert!(prediction.value >= -1.0 && prediction.value <= 1.0);

        let ranked = evaluator.get_ranked_legal_actions(&state).expect("Ranking failed");
        assert!(!ranked.is_empty(), "Should generate legal actions");
        eprintln!("SUCCESS! Neural Model Loaded!");
        eprintln!("State value (P1 win prob score): {}", prediction.value);
        eprintln!("Rank 1 Action: {:?}, prior: {:.4}", ranked[0].action, ranked[0].prior);
        eprintln!("Rank 2 Action: {:?}, prior: {:.4}", ranked[1].action, ranked[1].prior);
        eprintln!("Rank 3 Action: {:?}, prior: {:.4}", ranked[2].action, ranked[2].prior);
    }

    #[test]
    fn test_pawn_straight_jump_resolves_and_is_legal() {
        let mut state = initial_state_2p();
        // Pawns face each other: P1 at (4, 4), P2 at (3, 4)
        state.players[0].position = CellCoord { row: 4, col: 4 };
        state.players[1].position = CellCoord { row: 3, col: 4 };
        state.current_player_index = 0;

        // Action 0 is UP (0, 1) in SigmaQuoridor
        let action = map_index_to_action(&state, 0, false).expect("Action 0 should map");
        assert_eq!(
            action,
            GameAction::Move {
                to: CellCoord { row: 2, col: 4 }
            },
            "P1 must jump OVER P2 at (3, 4) landing at (2, 4)"
        );
        assert!(
            crate::rules::is_legal_action(&state, &action),
            "Straight jump over opponent must be recognized as legal"
        );
    }

    #[test]
    fn test_p2_pawn_straight_jump_resolves_and_is_legal() {
        let mut state = initial_state_2p();
        // Pawns face each other: P1 at (4, 4), P2 at (3, 4)
        state.players[0].position = CellCoord { row: 4, col: 4 };
        state.players[1].position = CellCoord { row: 3, col: 4 };
        state.current_player_index = 1; // P2's turn

        // Action 0 is UP (0, 1) in canonical view (towards P2's goal at row 8)
        let action = map_index_to_action(&state, 0, true).expect("Action 0 should map for P2");
        assert_eq!(
            action,
            GameAction::Move {
                to: CellCoord { row: 5, col: 4 }
            },
            "P2 must jump OVER P1 at (4, 4) landing at (5, 4)"
        );
        assert!(
            crate::rules::is_legal_action(&state, &action),
            "P2 straight jump over opponent must be recognized as legal"
        );
    }

    #[test]
    fn test_wall_tensor_encodes_two_cells_and_flips_correctly() {
        let mut state = initial_state_2p();
        state.walls.push(WallCoord {
            row: 3,
            col: 2,
            orientation: Orientation::H,
        });
        state.walls.push(WallCoord {
            row: 5,
            col: 6,
            orientation: Orientation::V,
        });

        let tensor_p1 = encode_board_tensor(&state);
        let idx = |ch: usize, y: usize, x: usize| -> usize {
            ch * (BOARD_DIM * BOARD_DIM) + y * BOARD_DIM + x
        };

        // For P1: DuoOrb row 3 -> SigmaQuoridor y = 7 - 3 = 4
        // Horizontal wall covers (4, 2) and (4, 3) in channel 2
        assert_eq!(tensor_p1[idx(2, 4, 2)], 1.0, "H-wall first segment at (4, 2)");
        assert_eq!(tensor_p1[idx(2, 4, 3)], 1.0, "H-wall second segment at (4, 3)");

        // For P1: DuoOrb row 5 -> SigmaQuoridor y = 7 - 5 = 2
        // Vertical wall covers (2, 6) and (3, 6) in channel 3
        assert_eq!(tensor_p1[idx(3, 2, 6)], 1.0, "V-wall first segment at (2, 6)");
        assert_eq!(tensor_p1[idx(3, 3, 6)], 1.0, "V-wall second segment at (3, 6)");

        // Now test P2 canonical flip:
        state.current_player_index = 1;
        let tensor_p2 = encode_board_tensor(&state);

        // In P2 canonical view:
        // H-wall row 4 -> 7 - 4 = 3. Segments should be at (3, 2) and (3, 3) in channel 2
        assert_eq!(tensor_p2[idx(2, 3, 2)], 1.0, "P2 flipped H-wall segment at (3, 2)");
        assert_eq!(tensor_p2[idx(2, 3, 3)], 1.0, "P2 flipped H-wall segment at (3, 3)");

        // V-wall segments at 2 and 3 -> 8 - 2 = 6, 8 - 3 = 5. Segments at (5, 6) and (6, 6) in channel 3
        assert_eq!(tensor_p2[idx(3, 5, 6)], 1.0, "P2 flipped V-wall segment at (5, 6)");
        assert_eq!(tensor_p2[idx(3, 6, 6)], 1.0, "P2 flipped V-wall segment at (6, 6)");
    }
}
