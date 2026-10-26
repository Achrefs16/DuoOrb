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
/// 1. `BRILLIANT` (`!!`, cyan) - Best move that sets up a decisive tactical detour / game-flipping wall.
/// 2. `GREAT` (`!`, blue) - Best move that is the critical only winning/saving move in a complex position.
/// 3. `BEST` (`★`, green) - Top engine recommendation.
/// 4. `EXCELLENT` (`✓` / `👍`, light green) - Very close to best (loss <= 3.5%).
/// 5. `GOOD` - Solid move (loss 3.5% - 8.0%).
/// 6. `INACCURACY` (`?!`, amber) - Suboptimal choice (backward step, useless wall, loss 8.0% - 16.0%).
/// 7. `MISTAKE` (`?`, orange) - Serious tactical error (loss 16.0% - 25.0%).
/// 8. `BLUNDER` (`??`, red) - Genuine bar flip or critical throw (> 25.0%).
#[inline(always)]
pub fn classify_mcts_move(
    q_best: f64,
    q_played: f64,
    q_second_best: f64,
    q_naive_pawn_step: f64,
    is_engine_best: bool,
    opp_detour: i32,
    my_lead_before: i32,
    is_wall: bool,
    _is_jump: bool,
    forced: bool,
    num_players: u8,
    ply: usize,
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
    let eval_loss = (delta_q * 40.0).max(0.0);

    // 1. Optimal Move Tier
    // Only the engine's #1 move (or a move within 0.012 scaled win equity of it) qualifies for Best, Brilliant, or Great.
    if is_engine_best || delta_q <= 0.012 {
        // BRILLIANT (!!): Decisive match-turning tactical wall
        // - Wall placement that forces a significant opponent detour (>= 3 steps)
        // - Or deep trap wall where tactical gain over simple pawn step is high (>= 0.15) and gap to 2nd is >= 0.08
        // - Played from a contested or trailing position (player wasn't already at a crushing lead)
        // - Non-opening (ply >= 4)
        let is_brilliant_wall = is_wall
            && (opp_detour >= 3 || (tactical_gain_vs_step >= 0.15 && gap_to_second >= 0.08))
            && (my_lead_before <= 2 || q_played <= (0.70 / mode_scale));

        if is_brilliant_wall && ply >= 4 {
            return (MoveAssessment::Brilliant, 0.0, 100.0);
        }

        // GREAT (!): Critical only winning or game-saving move in a complex position
        // - Must have a noticeable gap to the 2nd best move (gap >= 0.08)
        // - In a contested game state (not an obvious blowout 92%+ or already lost < 35%)
        // - Non-opening (ply >= 4)
        if ply >= 4
            && gap_to_second >= 0.08
            && q_played >= (0.35 / mode_scale)
            && q_played <= (0.92 / mode_scale)
        {
            return (MoveAssessment::Great, 0.0, 100.0);
        }

        return (MoveAssessment::Best, 0.0, 100.0);
    }

    // 2. Suboptimal Tiers (Strict adversarial equity comparison)
    let win_threshold = 0.50 / mode_scale;
    let losing_threshold = 0.32 / mode_scale;
    let flipped_bar = (q_best >= win_threshold && q_played <= losing_threshold && delta_q >= 0.14)
        || delta_q >= 0.25;

    let (assessment, accuracy) = if delta_q <= 0.035 {
        // EXCELLENT (✓): Within 3.5% equity of engine #1 (almost as good)
        let acc = (100.0 - (delta_q / 0.035) * 5.0).clamp(95.0, 99.0);
        (MoveAssessment::Excellent, acc)
    } else if delta_q <= 0.080 {
        // GOOD: Solid alternative, but suboptimal by 3.5% to 8.0%
        let acc = (94.0 - ((delta_q - 0.035) / 0.045) * 14.0).clamp(80.0, 94.0);
        (MoveAssessment::Good, acc)
    } else if delta_q <= 0.160 {
        // INACCURACY (?!): Clear suboptimal choice (backward step, useless wall, loss of tempo)
        let acc = (79.0 - ((delta_q - 0.080) / 0.080) * 21.0).clamp(58.0, 79.0);
        (MoveAssessment::Inaccuracy, acc)
    } else if delta_q <= 0.250 && !flipped_bar {
        // MISTAKE (?): Substantial tactical loss (16% to 25% equity dropped)
        let acc = (57.0 - ((delta_q - 0.160) / 0.090) * 27.0).clamp(30.0, 57.0);
        (MoveAssessment::Mistake, acc)
    } else {
        // BLUNDER (??): Game-losing swing or massive equity throw (> 25%)
        let acc = (28.0 - ((delta_q - 0.250).max(0.0) / 0.250) * 28.0).clamp(0.0, 28.0);
        (MoveAssessment::Blunder, acc)
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
            classify_mcts_move(0.9, 0.1, 0.8, 0.5, false, 0, 0, false, false, true, 2, 10),
            (MoveAssessment::Forced, 0.0, 100.0)
        );
    }

    #[test]
    fn brilliant_trap_wall_recognition() {
        let (assessment, loss, accuracy) =
            classify_mcts_move(0.65, 0.65, 0.52, 0.45, true, 4, -2, true, false, false, 2, 8);
        assert_eq!(assessment, MoveAssessment::Brilliant);
        assert_eq!(loss, 0.0);
        assert_eq!(accuracy, 100.0);
    }

    #[test]
    fn opening_move_is_best_not_great() {
        // Ply 1 opening pawn step with a gap to backward step: must be Best, NOT Great!
        let (assessment, _, _) =
            classify_mcts_move(0.55, 0.55, 0.38, 0.38, true, 0, 0, false, false, false, 2, 1);
        assert_eq!(assessment, MoveAssessment::Best);
    }

    #[test]
    fn great_move_is_only_winning_move_in_midgame() {
        let (assessment, loss, accuracy) =
            classify_mcts_move(0.65, 0.65, 0.48, 0.55, true, 0, 0, false, false, false, 2, 10);
        assert_eq!(assessment, MoveAssessment::Great);
        assert_eq!(loss, 0.0);
        assert_eq!(accuracy, 100.0);
    }

    #[test]
    fn normal_best_move_without_huge_gap() {
        let (assessment, loss, accuracy) =
            classify_mcts_move(0.55, 0.55, 0.51, 0.53, true, 0, 0, false, false, false, 2, 10);
        assert_eq!(assessment, MoveAssessment::Best);
        assert_eq!(loss, 0.0);
        assert_eq!(accuracy, 100.0);
    }

    #[test]
    fn small_divergence_is_excellent_or_good() {
        let (assessment, _, accuracy) =
            classify_mcts_move(0.55, 0.53, 0.50, 0.50, false, 0, 0, false, false, false, 2, 10);
        assert_eq!(assessment, MoveAssessment::Excellent);
        assert!(accuracy >= 95.0 && accuracy < 100.0);

        let (assessment2, _, accuracy2) =
            classify_mcts_move(0.55, 0.49, 0.50, 0.49, false, 0, 0, false, false, false, 2, 10);
        assert_eq!(assessment2, MoveAssessment::Good);
        assert!(accuracy2 >= 80.0 && accuracy2 <= 94.0);
    }

    #[test]
    fn backward_step_or_suboptimal_move_is_inaccuracy() {
        let (assessment, _, accuracy) =
            classify_mcts_move(0.55, 0.45, 0.48, 0.45, false, 0, 0, false, false, false, 2, 10);
        assert_eq!(assessment, MoveAssessment::Inaccuracy);
        assert!(accuracy >= 58.0 && accuracy <= 79.0);
    }

    #[test]
    fn serious_loss_is_mistake() {
        let (assessment, _, accuracy) =
            classify_mcts_move(0.55, 0.36, 0.45, 0.36, false, 0, 0, false, false, false, 2, 10);
        assert_eq!(assessment, MoveAssessment::Mistake);
        assert!(accuracy >= 30.0 && accuracy <= 57.0);
    }

    #[test]
    fn genuine_bar_flip_is_a_blunder() {
        let (assessment, _, accuracy) =
            classify_mcts_move(0.72, 0.28, 0.65, 0.40, false, 0, 0, false, false, false, 2, 10);
        assert_eq!(assessment, MoveAssessment::Blunder);
        assert!(accuracy <= 28.0);
    }

    #[test]
    fn four_player_equity_scaling() {
        // In 4P, baseline equity is 0.25. A delta_q of 0.15 is scaled by 2.0x to 0.30 -> Blunder
        let (assessment, _, _) =
            classify_mcts_move(0.35, 0.15, 0.30, 0.20, false, 0, 0, false, false, false, 4, 10);
        assert_eq!(assessment, MoveAssessment::Blunder);
    }
}
