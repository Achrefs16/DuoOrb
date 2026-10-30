#[cfg(not(target_arch = "wasm32"))]
use rayon::prelude::*;
use std::collections::HashMap;

use crate::adapter::adapt_prediction;
use crate::board::Board;
use crate::classifier::classify_mcts_move;
use crate::hints::action_notation;
use crate::hybrid::get_global_evaluator;
use crate::mcts::position_seed;
use crate::neural::map_index_to_action;
use crate::pathfinding::shortest_distance;
use crate::rules::{apply_action, get_legal_moves, is_legal_action};
use crate::solver::solve_tactical_position;
use crate::types::{
    GameAction, GameReview, GameState, KeyLesson, MoveAnalysis, MoveAssessment, RecordedAction,
    ReviewSummary,
};

fn distance_or_99(state: &GameState, idx: usize, board: &Board) -> i32 {
    match state.players.get(idx) {
        Some(p) => {
            let d = shortest_distance(p.position, p.goal_direction, board, &state.mode);
            if d < 0 {
                99
            } else {
                d
            }
        }
        None => 99,
    }
}

fn race_snapshot(state: &GameState, board: &Board, mover_idx: usize) -> (i32, i32) {
    let mine = distance_or_99(state, mover_idx, board);
    let opp = state
        .players
        .iter()
        .enumerate()
        .filter(|(idx, p)| *idx != mover_idx && p.status != "FINISHED")
        .map(|(idx, _)| distance_or_99(state, idx, board))
        .min()
        .unwrap_or(mine);
    (mine, opp)
}

fn find_naive_pawn_step(state: &GameState, board: &Board) -> Option<GameAction> {
    let mover_idx = state.current_player_index;
    let mover = state.players.get(mover_idx)?;
    let legal = get_legal_moves(state, &mover.id, board);
    if legal.is_empty() {
        return None;
    }
    let current_dist = shortest_distance(mover.position, mover.goal_direction, board, &state.mode);
    let mut best_step = None;
    let mut min_dist = current_dist;
    for cell in legal {
        let d = shortest_distance(cell, mover.goal_direction, board, &state.mode);
        if d >= 0 && (best_step.is_none() || d < min_dist) {
            min_dist = d;
            best_step = Some(GameAction::Move { to: cell });
        }
    }
    best_step
}

fn evaluate_ply_hybrid(
    state_before: &GameState,
    board_before: &Board,
    state_after: &GameState,
    rec_action: &GameAction,
    _seed: u64,
) -> (GameAction, f64, f64, f64, f64, bool) {
    // 1. TACTICAL SOLVER: Check for forced win or emergency conversion
    if let Some(solver_action) = solve_tactical_position(state_before, 8) {
        if is_legal_action(state_before, &solver_action) {
            let is_engine_best = solver_action == *rec_action;
            let played_q = if is_engine_best {
                0.99
            } else {
                let mut scratch = *board_before;
                if let Some(next_state) = apply_action(state_before, rec_action, &mut scratch) {
                    let mover_idx = state_before.current_player_index;
                    let (my_d, opp_d) = race_snapshot(&next_state, &scratch, mover_idx);
                    let opp_has_win = solve_tactical_position(&next_state, 8).is_some();
                    if opp_has_win {
                        0.05
                    } else if my_d <= 3 && opp_d >= my_d + 2 {
                        0.95
                    } else if my_d < opp_d {
                        0.85
                    } else {
                        0.35
                    }
                } else {
                    0.15
                }
            };
            return (solver_action, 0.99, played_q, 0.25, 0.25, is_engine_best);
        }
    }

    // 2. NEURAL EVALUATOR + MODE ADAPTER (Ultra-fast ~0.15ms per pass)
    if let Some(evaluator) = get_global_evaluator() {
        if let Ok(pred_before) = evaluator.evaluate(state_before) {
            let adapted_before = adapt_prediction(state_before, &pred_before);
            let mover_idx = state_before.current_player_index;
            let is_p2 = mover_idx == 1;

            let mut candidates: Vec<(GameAction, f32)> = Vec::with_capacity(32);
            for (action_idx, &prob) in adapted_before.policy_probs.iter().enumerate() {
                if prob > 0.0001 {
                    if let Some(action) = map_index_to_action(state_before, action_idx, is_p2) {
                        if is_legal_action(state_before, &action) {
                            candidates.push((action, prob));
                        }
                    }
                }
            }
            candidates.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

            let best_action = if let Some(first) = candidates.first() {
                first.0.clone()
            } else {
                rec_action.clone()
            };
            let is_engine_best = *rec_action == best_action;

            let num_players = state_before.players.len().max(2);
            let num_opps = (num_players - 1) as f64;

            // Compute played_q from state_after
            let played_q = if state_after.status == "FINISHED" {
                if let Some(m) = state_after.players.get(mover_idx) {
                    if m.status != "FINISHED" { 0.99 } else { 0.01 }
                } else {
                    0.50
                }
            } else if matches!(rec_action, GameAction::Resign | GameAction::Timeout) {
                0.01
            } else if let Ok(pred_after) = evaluator.evaluate(state_after) {
                let adapted_after = adapt_prediction(state_after, &pred_after);
                let opp_v = adapted_after.value.clamp(-1.0, 1.0) as f64;
                let opp_q = (opp_v + 1.0) * 0.5;
                (1.0 - (opp_q / num_opps)).clamp(0.02, 0.98)
            } else {
                0.50
            };

            // Compute best_q
            let best_q = if is_engine_best {
                played_q
            } else {
                let mut scratch_board = *board_before;
                if let Some(best_state_after) = apply_action(state_before, &best_action, &mut scratch_board) {
                    if best_state_after.status == "FINISHED" {
                        0.99
                    } else if let Ok(pred_best) = evaluator.evaluate(&best_state_after) {
                        let adapted_best = adapt_prediction(&best_state_after, &pred_best);
                        let opp_v = adapted_best.value.clamp(-1.0, 1.0) as f64;
                        let opp_q = (opp_v + 1.0) * 0.5;
                        (1.0 - (opp_q / num_opps)).clamp(0.02, 0.98).max(played_q)
                    } else {
                        played_q.max(0.55)
                    }
                } else {
                    played_q.max(0.55)
                }
            };

            let p1 = candidates.first().map(|c| c.1).unwrap_or(0.5);
            let p2 = candidates.get(1).map(|c| c.1).unwrap_or(p1 * 0.5);
            let ratio_2 = (p2 / p1.max(0.001)).clamp(0.0, 1.0) as f64;
            let q_second_best = (best_q - (1.0 - ratio_2) * 0.12).max(0.01).min(best_q);

            let naive_move = find_naive_pawn_step(state_before, board_before);
            let p_naive = candidates
                .iter()
                .find(|c| Some(&c.0) == naive_move.as_ref())
                .map(|c| c.1)
                .unwrap_or(p1 * 0.6);
            let ratio_naive = (p_naive / p1.max(0.001)).clamp(0.0, 1.0) as f64;
            let q_naive_pawn_step = (best_q - (1.0 - ratio_naive) * 0.18).max(0.01).min(best_q);

            return (
                best_action,
                best_q,
                played_q,
                q_second_best,
                q_naive_pawn_step,
                is_engine_best,
            );
        }
    }

    // 3. FAST DETERMINISTIC HEURISTIC FALLBACK (Zero MCTS Playouts, <0.1ms)
    let naive_step = find_naive_pawn_step(state_before, board_before).unwrap_or_else(|| rec_action.clone());
    let is_engine_best = *rec_action == naive_step;
    let (my_d, opp_d) = race_snapshot(state_before, board_before, state_before.current_player_index);
    let lead = (opp_d - my_d) as f64;
    let played_q = (0.50 + lead * 0.08).clamp(0.05, 0.95);
    let best_q = if is_engine_best { played_q } else { (played_q + 0.12).min(0.95) };
    let q_second_best = (best_q - 0.06).max(0.05);
    let q_naive = (best_q - 0.08).max(0.05);
    (naive_step, best_q, played_q, q_second_best, q_naive, is_engine_best)
}

pub fn analyze_game_internal(initial_state: GameState, history: Vec<RecordedAction>) -> GameReview {
    // Game Review is exclusively supported for Classic 2-Player duels
    if initial_state.mode != "2p" {
        return GameReview {
            game_id: initial_state.game_id,
            mode: initial_state.mode,
            total_moves: history.len(),
            accuracies: HashMap::new(),
            move_analyses: Vec::new(),
            critical_moments: Vec::new(),
            summary: ReviewSummary {
                key_lesson: KeyLesson {
                    title: "Classic 2P Only".to_string(),
                    detail: "Game Review with accuracy scores and move assessments is available exclusively for Classic 2-Player matches.".to_string(),
                    move_number: None,
                },
                confidence: "high".to_string(),
            },
            engine_version: "duoorb-rust-hybrid-4.0".to_string(),
            analysis_version: "analysis-3.3".to_string(),
        };
    }

    let mut states_before = Vec::with_capacity(history.len() + 1);
    let mut current_state = initial_state.clone();
    let mut current_board = Board::from_walls(&initial_state.walls);

    states_before.push((current_state.clone(), current_board));

    for rec in &history {
        // Match acting player if provided by the client history
        let mover_idx = if !rec.player.is_empty() {
            current_state
                .players
                .iter()
                .position(|p| p.id == rec.player)
                .unwrap_or(current_state.current_player_index)
        } else {
            current_state.current_player_index
        };
        current_state.current_player_index = mover_idx;

        if let Some(next_state) = apply_action(&current_state, &rec.action, &mut current_board) {
            current_state = next_state;
            states_before.push((current_state.clone(), current_board));
        } else {
            // Replay fallback: force apply recorded move so we never drop remaining plies
            let mut fallback_state = current_state.clone();
            match &rec.action {
                GameAction::Move { to } => {
                    if mover_idx < fallback_state.players.len() {
                        fallback_state.players[mover_idx].position = *to;
                    }
                }
                GameAction::PlaceWall { wall } => {
                    current_board.place_wall(wall);
                    fallback_state.walls.push(*wall);
                    if mover_idx < fallback_state.players.len()
                        && fallback_state.players[mover_idx].walls_remaining > 0
                    {
                        fallback_state.players[mover_idx].walls_remaining -= 1;
                    }
                }
                GameAction::Resign | GameAction::Timeout => {
                    if mover_idx < fallback_state.players.len() {
                        fallback_state.players[mover_idx].status = "FINISHED".to_string();
                    }
                }
            }
            let total_players = fallback_state.players.len();
            if total_players > 0 {
                let mut next_idx = (mover_idx + 1) % total_players;
                let mut iterations = 0;
                while fallback_state.players[next_idx].status == "FINISHED"
                    && iterations < total_players
                {
                    next_idx = (next_idx + 1) % total_players;
                    iterations += 1;
                }
                fallback_state.current_player_index = next_idx;
            }
            current_state = fallback_state;
            states_before.push((current_state.clone(), current_board));
        }
    }

    let plies_to_analyze: Vec<_> = history
        .iter()
        .enumerate()
        .filter(|(idx, _)| *idx < states_before.len() - 1)
        .collect();

    // Deep neural / hybrid analysis across plies
    #[cfg(not(target_arch = "wasm32"))]
    let analyses_iter = plies_to_analyze.par_iter();

    #[cfg(target_arch = "wasm32")]
    let analyses_iter = plies_to_analyze.iter();

    let analyses_with_acc: Vec<(MoveAnalysis, f64)> = analyses_iter
        .map(|(step, rec)| {
            let (state_before, board_before) = &states_before[*step];
            let (state_after, _) = &states_before[*step + 1];
            let mover_idx = state_before.current_player_index;
            let mover = &state_before.players[mover_idx];
            let mover_id = &mover.id;

            let legal_moves = get_legal_moves(state_before, mover_id, board_before);
            let non_board_action = matches!(rec.action, GameAction::Resign | GameAction::Timeout);
            let forced = non_board_action || (legal_moves.len() <= 1 && mover.walls_remaining == 0);

            let seed = position_seed(state_before, *step as i32);
            let (
                best_action,
                best_q,
                played_q,
                q_second_best,
                q_naive_pawn_step,
                is_engine_best,
            ) = evaluate_ply_hybrid(state_before, board_before, state_after, &rec.action, seed);

            let (my_before, opp_before) = race_snapshot(state_before, board_before, mover_idx);
            let mut after_board = *board_before;
            let (_my_after, opp_after) = if let Some(after_state) = apply_action(state_before, &rec.action, &mut after_board) {
                race_snapshot(&after_state, &after_board, mover_idx)
            } else {
                (my_before, opp_before)
            };
            let opp_detour = (opp_after - opp_before).max(0);
            let my_lead_before = opp_before - my_before;

            let is_wall = matches!(rec.action, GameAction::PlaceWall { .. });
            let is_jump = match rec.action {
                GameAction::Move { to } => {
                    (to.row - mover.position.row).abs() + (to.col - mover.position.col).abs() > 1
                }
                _ => false,
            };
            let num_players = state_before.players.len().max(2).min(4) as u8;

            let (assessment, evaluation_loss, move_acc) = classify_mcts_move(
                best_q,
                played_q,
                q_second_best,
                q_naive_pawn_step,
                is_engine_best,
                opp_detour,
                my_lead_before,
                is_wall,
                is_jump,
                forced,
                num_players,
                *step,
            );

            let eval_after = (played_q - 0.5) * 40.0;
            let win_chance_delta = played_q - best_q;

            let notation = action_notation(&rec.action);
            let explanation = match assessment {
                MoveAssessment::Brilliant => {
                    Some(format!("Brilliant! {} creates a decisive advantage and shifts the game.", notation))
                }
                MoveAssessment::Great => {
                    Some(format!("Great tactical move! {} maintains sharp positional pressure.", notation))
                }
                MoveAssessment::Best => {
                    Some(format!("Best move. {} is the optimal engine choice.", notation))
                }
                MoveAssessment::Excellent => {
                    Some(format!("Strong move. {} keeps solid control.", notation))
                }
                MoveAssessment::Good => {
                    Some(format!("Solid move. {} is completely playable.", notation))
                }
                MoveAssessment::Inaccuracy => {
                    let best_not = action_notation(&best_action);
                    Some(format!("Suboptimal. {} was stronger, maintaining better tempo.", best_not))
                }
                MoveAssessment::Mistake => {
                    let best_not = action_notation(&best_action);
                    Some(format!("Mistake. {} lost momentum. Better was {}.", notation, best_not))
                }
                MoveAssessment::Blunder => {
                    let best_not = action_notation(&best_action);
                    Some(format!("Blunder. {} gave away significant equity. {} was required.", notation, best_not))
                }
                MoveAssessment::Forced => {
                    Some("Forced move. Only legal option available.".to_string())
                }
            };

            let best_opt = if matches!(
                assessment,
                MoveAssessment::Brilliant
                    | MoveAssessment::Great
                    | MoveAssessment::Best
                    | MoveAssessment::Forced
            ) {
                None
            } else {
                Some(best_action)
            };

            (
                MoveAnalysis {
                    step: *step + 1,
                    player_index: mover_idx,
                    player_id: mover_id.clone(),
                    action: rec.action.clone(),
                    assessment,
                    evaluation: eval_after,
                    evaluation_loss,
                    win_chance: played_q,
                    win_chance_delta,
                    forced,
                    best_action: best_opt,
                    explanation,
                },
                move_acc,
            )
        })
        .collect();

    let mut move_analyses = Vec::with_capacity(analyses_with_acc.len());
    let mut player_loss_stats: HashMap<String, (f64, usize)> = HashMap::new();
    let mut critical_moments = Vec::new();
    let mut worst_blunder_step = None;
    let mut worst_blunder_loss = 0.0;

    for (m, _acc) in analyses_with_acc {
        let tier_loss: f64 = match m.assessment {
            MoveAssessment::Brilliant
            | MoveAssessment::Great
            | MoveAssessment::Best
            | MoveAssessment::Forced => 0.0,
            MoveAssessment::Excellent => 28.0,
            MoveAssessment::Good => 46.0,
            MoveAssessment::Inaccuracy => 72.0,
            MoveAssessment::Mistake => 125.0,
            MoveAssessment::Blunder => 215.0,
        };

        let entry = player_loss_stats
            .entry(m.player_id.clone())
            .or_insert((0.0, 0));
        entry.0 += tier_loss.powf(1.40);
        entry.1 += 1;

        if m.assessment == MoveAssessment::Blunder
            || m.assessment == MoveAssessment::Mistake
            || m.assessment == MoveAssessment::Brilliant
            || m.assessment == MoveAssessment::Great
            || m.win_chance_delta.abs() >= 0.20
        {
            critical_moments.push(m.step);
        }

        if m.assessment == MoveAssessment::Blunder && m.evaluation_loss > worst_blunder_loss {
            worst_blunder_loss = m.evaluation_loss;
            worst_blunder_step = Some(m.step);
        }

        move_analyses.push(m);
    }

    let mut accuracies = HashMap::new();
    for (pid, (sum_loss_pow, count)) in player_loss_stats {
        let acc = if count > 0 {
            let avg_loss = (sum_loss_pow / count as f64).powf(1.0 / 1.40);
            (100.0 - avg_loss).clamp(0.0, 100.0)
        } else {
            100.0
        };
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
            detail:
                "Solid strategic play was maintained throughout the match without major blunders."
                    .to_string(),
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
        engine_version: "duoorb-rust-hybrid-4.0".to_string(),
        analysis_version: "analysis-3.3".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn non_2p_mode_returns_clean_unsupported_summary() {
        let state = GameState {
            game_id: "test-4p".to_string(),
            mode: "4p".to_string(),
            current_player_index: 0,
            players: vec![],
            walls: vec![],
            move_number: 1,
            status: "IN_PROGRESS".to_string(),
        };
        let review = analyze_game_internal(state, vec![]);
        assert_eq!(review.mode, "4p");
        assert_eq!(review.move_analyses.len(), 0);
        assert_eq!(review.summary.key_lesson.title, "Classic 2P Only");
    }
}
