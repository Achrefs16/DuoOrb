use rayon::prelude::*;
use std::collections::HashMap;

use crate::board::Board;
use crate::classifier::classify_mcts_move;
use crate::mcts::{position_seed, run_mcts_analysis};
use crate::pathfinding::shortest_distance;
use crate::rules::{apply_action, get_legal_moves};
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

/// Net race tempo of one action: (my improvement) - (opponent improvement).
fn race_gain(state: &GameState, board: &Board, action: &GameAction, mover_idx: usize) -> i32 {
    let (my_before, opp_before) = race_snapshot(state, board, mover_idx);
    let mut after_board = *board;
    if let Some(after) = apply_action(state, action, &mut after_board) {
        let (my_after, opp_after) = race_snapshot(&after, &after_board, mover_idx);
        (my_before - my_after) - (opp_before - opp_after)
    } else {
        0
    }
}

pub fn analyze_game_internal(initial_state: GameState, history: Vec<RecordedAction>) -> GameReview {
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

    // Parallel deep MCTS analysis across plies using Rayon
    let analyses_with_acc: Vec<(MoveAnalysis, f64)> = plies_to_analyze
        .par_iter()
        .map(|(step, rec)| {
            let (state_before, board_before) = &states_before[*step];
            let mover_idx = state_before.current_player_index;
            let mover = &state_before.players[mover_idx];
            let mover_id = &mover.id;

            let legal_moves = get_legal_moves(state_before, mover_id, board_before);
            let non_board_action = matches!(rec.action, GameAction::Resign | GameAction::Timeout);
            let forced = non_board_action || (legal_moves.len() <= 1 && mover.walls_remaining == 0);

            let seed = position_seed(state_before, *step as i32);
            // Deep MCTS search (1,000 adversarial simulations per ply).
            let mcts = run_mcts_analysis(state_before, board_before, &rec.action, 1000, seed);

            let best_q = mcts.best_q;
            // If a legacy history entry cannot be replayed, never invent a
            // blunder: treating it as the best available keeps the review
            // honest instead of fabricating a 0.9 swing.
            let played_q = mcts.played_q.unwrap_or(best_q);
            let best_gain = race_gain(state_before, board_before, &mcts.best_action, mover_idx);
            let played_gain = race_gain(state_before, board_before, &rec.action, mover_idx);
            let net_step_delta = (played_gain - best_gain).clamp(-32000, 32000) as i16;

            let (assessment, evaluation_loss, move_acc) = classify_mcts_move(
                best_q,
                played_q,
                mcts.root_q,
                mcts.gap_to_second,
                net_step_delta,
                forced,
            );

            let eval_after = (played_q - 0.5) * 40.0;
            let win_chance_delta = played_q - best_q;

            let best_opt = if matches!(
                assessment,
                MoveAssessment::Brilliant
                    | MoveAssessment::Great
                    | MoveAssessment::Best
                    | MoveAssessment::Forced
            ) {
                None
            } else {
                Some(mcts.best_action)
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
                    explanation: None,
                },
                move_acc,
            )
        })
        .collect();

    let mut move_analyses = Vec::with_capacity(analyses_with_acc.len());
    let mut player_acc_sums: HashMap<String, (f64, usize)> = HashMap::new();
    let mut critical_moments = Vec::new();
    let mut worst_blunder_step = None;
    let mut worst_blunder_loss = 0.0;

    for (m, acc) in analyses_with_acc {
        let entry = player_acc_sums
            .entry(m.player_id.clone())
            .or_insert((0.0, 0));
        entry.0 += acc;
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
        engine_version: "duoorb-rust-mcts-2.1".to_string(),
        analysis_version: "analysis-2.1".to_string(),
    }
}
