use std::collections::HashMap;
use rayon::prelude::*;

use crate::board::Board;
use crate::classifier::classify_mcts_move;
use crate::mcts::{position_seed, run_mcts_analysis};
use crate::rules::{apply_action, get_legal_moves};
use crate::types::{
    GameReview, GameState, KeyLesson, MoveAnalysis, MoveAssessment,
    RecordedAction, ReviewSummary,
};

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

    // Parallel deep MCTS analysis across plies using Rayon
    let analyses_with_acc: Vec<(MoveAnalysis, f64)> = plies_to_analyze
        .par_iter()
        .map(|(step, rec)| {
            let (state_before, board_before) = &states_before[*step];
            let mover_idx = state_before.current_player_index;
            let mover = &state_before.players[mover_idx];
            let mover_id = &mover.id;

            let legal_moves = get_legal_moves(state_before, mover_id, board_before);
            let forced = legal_moves.len() <= 1 && mover.walls_remaining == 0;

            let seed = position_seed(state_before, *step as i32);
            // Deep MCTS search (1,000 simulations per ply)
            let mcts = run_mcts_analysis(state_before, board_before, &rec.action, 1000, seed);

            let best_q = mcts.best_q;
            let played_q = mcts.played_q.unwrap_or(best_q.max(0.1) - 0.05);

            let (assessment, evaluation_loss, move_acc) = classify_mcts_move(best_q, played_q, forced);

            let eval_after = (played_q - 0.5) * 40.0;
            let win_chance_delta = played_q - best_q;

            let best_opt = if assessment == MoveAssessment::Best || assessment == MoveAssessment::Forced {
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
        let entry = player_acc_sums.entry(m.player_id.clone()).or_insert((0.0, 0));
        entry.0 += acc;
        entry.1 += 1;

        if m.assessment == MoveAssessment::Blunder
            || m.assessment == MoveAssessment::Mistake
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
            detail: "Solid strategic play was maintained throughout the match without major blunders.".to_string(),
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
        engine_version: "duoorb-rust-mcts-2.0".to_string(),
        analysis_version: "analysis-2.0".to_string(),
    }
}
