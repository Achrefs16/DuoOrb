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
/// 1. `BRILLIANT` (`!!`, cyan) - Best move that sets up a multi-ply trap wall or winning jump tactic.
/// 2. `GREAT` (`!`, blue) - Best move that is the critical only winning/saving move or decisive tactical swing.
/// 3. `BEST` (`★`, green) - Top engine recommendation.
/// 4. `EXCELLENT` (`✓` / `👍`, light green) - Very close to best.
/// 5. `GOOD` - Solid move.
/// 6. `INACCURACY` (`?!`, amber) - Minor imprecision.
/// 7. `MISTAKE` (`?`, orange) - Suboptimal move without a full bar flip.
/// 8. `BLUNDER` (`??`, red) - Genuine bar flip or critical throw.
#[inline(always)]
pub fn classify_mcts_move(
    q_best: f64,
    q_played: f64,
    q_second_best: f64,
    q_naive_pawn_step: f64,
    static_1ply_net_gain: i32,
    is_wall: bool,
    is_jump: bool,
    forced: bool,
    num_players: u8,
) -> (MoveAssessment, f64, f64) {
    if forced {
        return (MoveAssessment::Forced, 0.0, 100.0);
    }

    // Scale equity delta for 3P (1.5x) and 4P (2.0x) so accuracy matches 2P sensitivity
    let mode_scale = (num_players.max(2) as f64) / 2.0;
    let raw_delta_q = (q_best - q_played).max(0.0);
    let delta_q = raw_delta_q * mode_scale;
    let gap_to_second = (q_best - q_second_best).max(0.0) * mode_scale;
    let tactical_gain_vs_step = (q_played - q_naive_pawn_step) * mode_scale;
    let eval_loss = delta_q * 40.0;

    // 1. Optimal Move Tier (within 2.5% scaled win equity of engine #1)
    if delta_q <= 0.025 {
        // BRILLIANT: A multi-ply trap wall or deflection jump that looks unremarkable at 1-ply
        // (static_1ply_net_gain <= 1) but crushes a standard pawn step in deep MCTS
        let is_deep_trap_wall = is_wall
            && static_1ply_net_gain <= 1
            && tactical_gain_vs_step >= 0.16
            && gap_to_second >= 0.10;

        let is_winning_jump_tactic = is_jump
            && gap_to_second >= 0.14
            && q_played >= (0.55 / mode_scale);

        if (is_deep_trap_wall || is_winning_jump_tactic) && q_played >= (0.48 / mode_scale) {
            return (MoveAssessment::Brilliant, eval_loss, 100.0);
        }

        // GREAT: The single critical move that saves the game or seizes a winning advantage
        if gap_to_second >= 0.11
            || (tactical_gain_vs_step >= 0.14 && q_played >= (0.55 / mode_scale))
        {
            return (MoveAssessment::Great, eval_loss, 100.0);
        }

        return (MoveAssessment::Best, eval_loss, 100.0);
    }

    // 2. Suboptimal Tiers
    let win_threshold = 0.50 / mode_scale;
    let losing_threshold = 0.34 / mode_scale;
    let flipped_bar = (q_best >= win_threshold && q_played <= losing_threshold) || delta_q >= 0.30;

    let assessment = if delta_q <= 0.055 {
        MoveAssessment::Excellent
    } else if delta_q <= 0.11 {
        MoveAssessment::Good
    } else if delta_q <= 0.18 {
        MoveAssessment::Inaccuracy
    } else if delta_q <= 0.26 || !flipped_bar {
        MoveAssessment::Mistake
    } else {
        MoveAssessment::Blunder
    };

    let accuracy = match assessment {
        MoveAssessment::Excellent => (100.0 - delta_q * 120.0).clamp(90.0, 99.0),
        MoveAssessment::Good => (92.0 - delta_q * 140.0).clamp(76.0, 90.0),
        MoveAssessment::Inaccuracy => (78.0 - delta_q * 150.0).clamp(52.0, 75.0),
        MoveAssessment::Mistake => (55.0 - delta_q * 120.0).clamp(25.0, 50.0),
        MoveAssessment::Blunder => (25.0 - delta_q * 50.0).clamp(0.0, 20.0),
        _ => 100.0,
    };

    (assessment, eval_loss, accuracy)
}

#[cfg(test)]
mod tests {
    use super::classify_mcts_move;
    use crate::types::MoveAssessment;

    #[test]
    fn forced_moves_are_never_penalized() {
        assert_eq!(
            classify_mcts_move(0.9, 0.1, 0.8, 0.5, 0, false, false, true, 2),
            (MoveAssessment::Forced, 0.0, 100.0)
        );
    }

    #[test]
    fn brilliant_trap_wall_recognition() {
        let (assessment, loss, accuracy) =
            classify_mcts_move(0.65, 0.65, 0.52, 0.45, 0, true, false, false, 2);
        assert_eq!(assessment, MoveAssessment::Brilliant);
        assert_eq!(loss, 0.0);
        assert_eq!(accuracy, 100.0);
    }

    #[test]
    fn great_move_is_only_winning_move() {
        let (assessment, loss, accuracy) =
            classify_mcts_move(0.65, 0.65, 0.50, 0.55, 1, false, false, false, 2);
        assert_eq!(assessment, MoveAssessment::Great);
        assert_eq!(loss, 0.0);
        assert_eq!(accuracy, 100.0);
    }

    #[test]
    fn normal_best_move_without_huge_gap() {
        let (assessment, loss, accuracy) =
            classify_mcts_move(0.55, 0.55, 0.51, 0.53, 0, false, false, false, 2);
        assert_eq!(assessment, MoveAssessment::Best);
        assert_eq!(loss, 0.0);
        assert_eq!(accuracy, 100.0);
    }

    #[test]
    fn small_non_flipping_loss_is_not_a_blunder() {
        let (assessment, _, _) =
            classify_mcts_move(0.55, 0.46, 0.48, 0.46, 0, false, false, false, 2);
        assert_eq!(assessment, MoveAssessment::Good);
    }

    #[test]
    fn large_loss_without_a_bar_flip_is_capped_at_mistake() {
        let (assessment, _, _) =
            classify_mcts_move(0.42, 0.20, 0.35, 0.20, 0, false, false, false, 2);
        assert_eq!(assessment, MoveAssessment::Mistake);
    }

    #[test]
    fn genuine_bar_flip_is_a_blunder() {
        let (assessment, _, accuracy) =
            classify_mcts_move(0.72, 0.28, 0.65, 0.40, 0, false, false, false, 2);
        assert_eq!(assessment, MoveAssessment::Blunder);
        assert!(accuracy <= 20.0);
    }

    #[test]
    fn four_player_equity_scaling() {
        // In 4P, baseline equity is 0.25. A delta_q of 0.15 is scaled by 2.0x to 0.30 -> Blunder
        let (assessment, _, _) =
            classify_mcts_move(0.35, 0.15, 0.30, 0.20, 0, false, false, false, 4);
        assert_eq!(assessment, MoveAssessment::Blunder);
    }
}
