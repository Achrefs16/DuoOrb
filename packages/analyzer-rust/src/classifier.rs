use crate::types::MoveAssessment;

pub const WIN_CHANCE_SCALE: f64 = 20.0;
pub const ACCURACY_SCALE: f64 = 12.0;

#[inline(always)]
pub fn win_chance_from_eval(eval: f64) -> f64 {
    1.0 / (1.0 + (-eval / WIN_CHANCE_SCALE).exp())
}

/// Grades a move from adversarial MCTS win probabilities.
///
/// Order of move quality (Chess.com standard):
/// 1. `BRILLIANT` (`!!`, cyan) - Best move that turns around a losing/difficult
///    position (root_q <= 0.46) with a huge winning swing (played_q >= 0.58).
/// 2. `GREAT` (`!`, blue) - Best move that has a powerful effect on game direction:
///    either the only good move (gap to 2nd candidate >= 0.11), or a decisive winning swing.
/// 3. `BEST` (`★`, green) - Top engine recommendation.
/// 4. `EXCELLENT` (`✓` / `👍`, light green) - Very close to best (delta_q <= 0.06).
/// 5. `GOOD` - Solid move (delta_q <= 0.12).
/// 6. `INACCURACY` (`?!`, amber) - Minor imprecision (delta_q <= 0.20).
/// 7. `MISTAKE` (`?`, orange) - Suboptimal move without a full bar flip (delta_q <= 0.28).
/// 8. `BLUNDER` (`??`, red) - Genuine bar flip or critical throw.
#[inline(always)]
pub fn classify_mcts_move(
    best_q: f64,
    played_q: f64,
    root_q: f64,
    gap_to_second: f64,
    net_step_delta: i16,
    forced: bool,
) -> (MoveAssessment, f64, f64) {
    if forced {
        return (MoveAssessment::Forced, 0.0, 100.0);
    }

    let delta_q = (best_q - played_q).max(0.0);
    // Loss units roughly scaled to Quoridor path steps (1 step ~ 10 loss).
    let loss = delta_q * 40.0;

    let flipped_bar = (best_q >= 0.46 && played_q <= 0.32)
        || (best_q >= 0.65 && played_q <= 0.44)
        || delta_q >= 0.36;

    let is_best = delta_q <= 0.025 || (net_step_delta >= 0 && delta_q <= 0.045);

    let assessment = if is_best {
        // Brilliant: rare huge flip in match-winning direction from a difficult / losing position
        let is_brilliant = root_q <= 0.46
            && played_q >= 0.58
            && (played_q - root_q >= 0.18 || (root_q <= 0.38 && played_q >= 0.54));

        if is_brilliant {
            MoveAssessment::Brilliant
        } else {
            // Great: powerful effect on game direction (critical only good move, or decisive swing)
            let is_great = gap_to_second >= 0.11
                || (played_q - root_q >= 0.12 && played_q >= 0.62)
                || (net_step_delta >= 3 && played_q >= 0.60);

            if is_great {
                MoveAssessment::Great
            } else {
                MoveAssessment::Best
            }
        }
    } else if delta_q <= 0.06 {
        MoveAssessment::Excellent
    } else if delta_q <= 0.12 {
        MoveAssessment::Good
    } else if delta_q <= 0.20 {
        MoveAssessment::Inaccuracy
    } else if !flipped_bar || delta_q <= 0.28 {
        // 0.21..0.28 is a mistake even if the raw number looks large, unless
        // the bar genuinely crossed sides. Never a false BLUNDER.
        MoveAssessment::Mistake
    } else {
        MoveAssessment::Blunder
    };

    let accuracy = match assessment {
        MoveAssessment::Brilliant
        | MoveAssessment::Great
        | MoveAssessment::Best
        | MoveAssessment::Forced => 100.0,
        MoveAssessment::Excellent => (100.0 - delta_q * 120.0).clamp(90.0, 99.0),
        MoveAssessment::Good => (92.0 - delta_q * 140.0).clamp(76.0, 90.0),
        MoveAssessment::Inaccuracy => (78.0 - delta_q * 150.0).clamp(52.0, 75.0),
        MoveAssessment::Mistake => (55.0 - delta_q * 120.0).clamp(25.0, 50.0),
        MoveAssessment::Blunder => (25.0 - delta_q * 50.0).clamp(0.0, 20.0),
    };

    (assessment, loss, accuracy)
}

#[cfg(test)]
mod tests {
    use super::classify_mcts_move;
    use crate::types::MoveAssessment;

    #[test]
    fn forced_moves_are_never_penalized() {
        assert_eq!(
            classify_mcts_move(0.9, 0.1, 0.5, 0.0, -10, true),
            (MoveAssessment::Forced, 0.0, 100.0)
        );
    }

    #[test]
    fn brilliant_move_flips_losing_position() {
        let (assessment, loss, accuracy) = classify_mcts_move(0.68, 0.68, 0.38, 0.08, 2, false);
        assert_eq!(assessment, MoveAssessment::Brilliant);
        assert_eq!(loss, 0.0);
        assert_eq!(accuracy, 100.0);
    }

    #[test]
    fn great_move_is_only_saving_move() {
        let (assessment, loss, accuracy) = classify_mcts_move(0.65, 0.65, 0.60, 0.15, 1, false);
        assert_eq!(assessment, MoveAssessment::Great);
        assert_eq!(loss, 0.0);
        assert_eq!(accuracy, 100.0);
    }

    #[test]
    fn normal_best_move_without_huge_gap_or_flip() {
        let (assessment, loss, accuracy) = classify_mcts_move(0.55, 0.55, 0.53, 0.04, 0, false);
        assert_eq!(assessment, MoveAssessment::Best);
        assert_eq!(loss, 0.0);
        assert_eq!(accuracy, 100.0);
    }

    #[test]
    fn small_non_flipping_loss_is_not_a_blunder() {
        let (assessment, _, _) = classify_mcts_move(0.55, 0.46, 0.50, 0.05, -1, false);
        assert_eq!(assessment, MoveAssessment::Good);
    }

    #[test]
    fn large_loss_without_a_bar_flip_is_capped_at_mistake() {
        let (assessment, _, _) = classify_mcts_move(0.42, 0.08, 0.40, 0.05, -8, false);
        assert_eq!(assessment, MoveAssessment::Mistake);
    }

    #[test]
    fn genuine_bar_flip_is_a_blunder() {
        let (assessment, _, accuracy) = classify_mcts_move(0.72, 0.28, 0.70, 0.05, -8, false);
        assert_eq!(assessment, MoveAssessment::Blunder);
        assert!(accuracy <= 20.0);
    }

    #[test]
    fn positive_race_delta_keeps_a_small_loss_at_best() {
        let (assessment, _, _) = classify_mcts_move(0.51, 0.47, 0.50, 0.02, 2, false);
        assert_eq!(assessment, MoveAssessment::Best);
    }
}
