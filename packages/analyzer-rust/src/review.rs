use std::collections::HashMap;
use rayon::prelude::*;

use crate::board::Board;
use crate::classifier::{base_assessment, move_accuracy, win_chance_from_eval};
use crate::evaluation::evaluate_state;
use crate::pathfinding::{shortest_path};
use crate::rules::{apply_action, get_legal_moves, is_legal_wall_placement};
use crate::types::{
    GameAction, GameReview, GameState, KeyLesson, MoveAnalysis, MoveAssessment, Orientation,
    RecordedAction, ReviewSummary, WallCoord,
};

pub fn generate_candidate_walls(state: &GameState, player_id: &str, board: &Board) -> Vec<WallCoord> {
    let mover = match state.players.iter().find(|p| p.id == player_id) {
        Some(p) => p,
        None => return vec![],
    };
    if mover.walls_remaining <= 0 {
        return vec![];
    }

    let mut candidates = Vec::with_capacity(24);
    let mut seen = std::collections::HashSet::new();

    // 1. Touch walls around mover
    let (mr, mc) = (mover.position.row, mover.position.col);
    let touches = [
        (mr - 1, mc, Orientation::H),
        (mr, mc, Orientation::H),
        (mr, mc - 1, Orientation::V),
        (mr, mc, Orientation::V),
    ];
    for (r, c, o) in touches {
        if r >= 0 && r < 8 && c >= 0 && c < 8 {
            let w = WallCoord { row: r, col: c, orientation: o };
            if seen.insert(w) && is_legal_wall_placement(state, player_id, &w, board) {
                candidates.push(w);
            }
        }
    }

    // 2. Touch walls and path-crossing walls around active rivals
    for opp in &state.players {
        if opp.id == player_id || opp.status != "ACTIVE" {
            continue;
        }
        let (or, oc) = (opp.position.row, opp.position.col);
        let opp_touches = [
            (or - 1, oc, Orientation::H),
            (or, oc, Orientation::H),
            (or, oc - 1, Orientation::V),
            (or, oc, Orientation::V),
        ];
        for (r, c, o) in opp_touches {
            if r >= 0 && r < 8 && c >= 0 && c < 8 {
                let w = WallCoord { row: r, col: c, orientation: o };
                if seen.insert(w) && is_legal_wall_placement(state, player_id, &w, board) {
                    candidates.push(w);
                }
            }
        }

        // Opponent shortest path crossings
        if let Some(path) = shortest_path(opp.position, opp.goal_direction, board, &state.mode) {
            let steps = path.len().min(4);
            let mut cur = opp.position;
            for next in path.iter().take(steps) {
                if next.row == cur.row + 1 {
                    for col in [cur.col - 1, cur.col] {
                        if cur.row >= 0 && cur.row < 8 && col >= 0 && col < 8 {
                            let w = WallCoord { row: cur.row, col, orientation: Orientation::H };
                            if seen.insert(w) && is_legal_wall_placement(state, player_id, &w, board) {
                                candidates.push(w);
                            }
                        }
                    }
                } else if next.row == cur.row - 1 {
                    for col in [cur.col - 1, cur.col] {
                        if next.row >= 0 && next.row < 8 && col >= 0 && col < 8 {
                            let w = WallCoord { row: next.row, col, orientation: Orientation::H };
                            if seen.insert(w) && is_legal_wall_placement(state, player_id, &w, board) {
                                candidates.push(w);
                            }
                        }
                    }
                } else if next.col == cur.col + 1 {
                    for row in [cur.row - 1, cur.row] {
                        if row >= 0 && row < 8 && cur.col >= 0 && cur.col < 8 {
                            let w = WallCoord { row, col: cur.col, orientation: Orientation::V };
                            if seen.insert(w) && is_legal_wall_placement(state, player_id, &w, board) {
                                candidates.push(w);
                            }
                        }
                    }
                } else if next.col == cur.col - 1 {
                    for row in [cur.row - 1, cur.row] {
                        if row >= 0 && row < 8 && next.col >= 0 && next.col < 8 {
                            let w = WallCoord { row, col: next.col, orientation: Orientation::V };
                            if seen.insert(w) && is_legal_wall_placement(state, player_id, &w, board) {
                                candidates.push(w);
                            }
                        }
                    }
                }
                cur = *next;
            }
        }
    }

    candidates
}

pub fn analyze_game_internal(
    initial_state: GameState,
    history: Vec<RecordedAction>,
) -> GameReview {
    let mut states_before = Vec::with_capacity(history.len() + 1);
    let mut current_state = initial_state.clone();
    let mut current_board = Board::from_walls(&initial_state.walls);

    states_before.push((current_state.clone(), current_board));

    for rec in &history {
        if let Some(next_state) = apply_action(&current_state, &rec.action, &mut current_board) {
            current_state = next_state;
            states_before.push((current_state.clone(), current_board));
        } else {
            break;
        }
    }

    let plies_to_analyze: Vec<_> = history
        .iter()
        .enumerate()
        .filter(|(idx, _)| *idx < states_before.len() - 1)
        .collect();

    // Parallel analysis across plies using Rayon
    let move_analyses: Vec<MoveAnalysis> = plies_to_analyze
        .par_iter()
        .map(|(step, rec)| {
            let (state_before, board_before) = &states_before[*step];
            let (state_after, board_after) = &states_before[*step + 1];
            let mover_idx = state_before.current_player_index;
            let mover = &state_before.players[mover_idx];
            let mover_id = &mover.id;

            let eval_before = evaluate_state(state_before, mover_id, board_before);
            let eval_after = evaluate_state(state_after, mover_id, board_after);

            let win_chance_before = win_chance_from_eval(eval_before);
            let win_chance_after = win_chance_from_eval(eval_after);
            let win_chance_delta = win_chance_after - win_chance_before;

            // Generate candidates
            let legal_moves = get_legal_moves(state_before, mover_id, board_before);
            let candidate_walls = generate_candidate_walls(state_before, mover_id, board_before);

            let total_legal_candidates = legal_moves.len() + candidate_walls.len();
            let forced = total_legal_candidates <= 1;

            let mut best_action = rec.action.clone();
            let mut best_score = eval_after;
            let mut played_score = eval_after;

            for to in &legal_moves {
                let candidate = GameAction::Move { to: *to };
                let mut sim_board = *board_before;
                if let Some(sim_state) = apply_action(state_before, &candidate, &mut sim_board) {
                    let score = evaluate_state(&sim_state, mover_id, &sim_board);
                    if candidate == rec.action {
                        played_score = score;
                    }
                    if score > best_score {
                        best_score = score;
                        best_action = candidate;
                    }
                }
            }

            for wall in &candidate_walls {
                let candidate = GameAction::PlaceWall { wall: *wall };
                let mut sim_board = *board_before;
                if let Some(sim_state) = apply_action(state_before, &candidate, &mut sim_board) {
                    let score = evaluate_state(&sim_state, mover_id, &sim_board);
                    if candidate == rec.action {
                        played_score = score;
                    }
                    if score > best_score {
                        best_score = score;
                        best_action = candidate;
                    }
                }
            }

            let evaluation_loss = (best_score - played_score).max(0.0);
            let assessment = base_assessment(evaluation_loss, forced, win_chance_delta);

            let best_opt = if assessment == MoveAssessment::Best || assessment == MoveAssessment::Forced {
                None
            } else {
                Some(best_action)
            };

            MoveAnalysis {
                step: *step + 1,
                player_index: mover_idx,
                player_id: mover_id.clone(),
                action: rec.action.clone(),
                assessment,
                evaluation: eval_after,
                evaluation_loss,
                win_chance: win_chance_after,
                win_chance_delta,
                forced,
                best_action: best_opt,
                explanation: None,
            }
        })
        .collect();

    // Accuracies per player
    let mut player_acc_sums: HashMap<String, (f64, usize)> = HashMap::new();
    let mut critical_moments = Vec::new();
    let mut worst_blunder_step = None;
    let mut worst_blunder_loss = 0.0;

    for m in &move_analyses {
        let entry = player_acc_sums.entry(m.player_id.clone()).or_insert((0.0, 0));
        entry.0 += move_accuracy(m.evaluation_loss, m.forced);
        entry.1 += 1;

        if m.assessment == MoveAssessment::Blunder
            || m.assessment == MoveAssessment::Mistake
            || m.win_chance_delta.abs() >= 0.15
        {
            critical_moments.push(m.step);
        }

        if m.assessment == MoveAssessment::Blunder && m.evaluation_loss > worst_blunder_loss {
            worst_blunder_loss = m.evaluation_loss;
            worst_blunder_step = Some(m.step);
        }
    }

    let mut accuracies = HashMap::new();
    for (pid, (sum, count)) in player_acc_sums {
        let acc = if count > 0 { sum / count as f64 } else { 100.0 };
        accuracies.insert(pid, (acc * 10.0).round() / 10.0);
    }

    let key_lesson = if let Some(step) = worst_blunder_step {
        KeyLesson {
            title: "Critical Turning Point".to_string(),
            detail: format!("Move {} dramatically shifted the win probability. Review the recommended alternative.", step),
            move_number: Some(step),
        }
    } else {
        KeyLesson {
            title: "Consistent Play".to_string(),
            detail: "Both sides maintained solid accuracy throughout the match with no major blunders.".to_string(),
            move_number: None,
        }
    };

    GameReview {
        game_id: initial_state.game_id,
        mode: initial_state.mode,
        total_moves: move_analyses.len(),
        accuracies,
        move_analyses,
        critical_moments,
        summary: ReviewSummary {
            key_lesson,
            confidence: "high".to_string(),
        },
        engine_version: "duoorb-rust-1.0".to_string(),
        analysis_version: "analysis-1.0".to_string(),
    }
}
