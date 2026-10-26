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
/// 1. `BRILLIANT` (`!!`, cyan) - Best move that sets up a multi-ply trap wall.
/// 2. `GREAT` (`!`, blue) - Best move that is the critical only winning/saving move in a complex position.
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
    let eval_loss = delta_q * 40.0;

    // 1. Optimal Move Tier (within 2.5% scaled win equity of engine #1)
    if delta_q <= 0.025 {
        // BRILLIANT: Only for genuine multi-ply trap walls that look unremarkable at 1-ply
        // (static_1ply_net_gain <= 1) but decisively crush rival progress in deep MCTS.
        // Standard pawn jumps are NEVER brilliant.
        let is_deep_trap_wall = is_wall
            && static_1ply_net_gain <= 1
            && tactical_gain_vs_step >= 0.18
            && gap_to_second >= 0.12
            && q_played >= (0.50 / mode_scale);

        if is_deep_trap_wall && ply >= 4 {
            return (MoveAssessment::Brilliant, eval_loss, 100.0);
        }

        // GREAT: The single critical move that saves the game or maintains the only winning path.
        // Must NOT trigger in the opening (ply < 6) where moving forward is standard play!
        if ply >= 6 && gap_to_second >= 0.15 && q_played >= (0.55 / mode_scale) {
            return (MoveAssessment::Great, eval_loss, 100.0);
        }

        return (MoveAssessment::Best, eval_loss, 100.0);
    }

    // 2. Commanding Win Protection
    // Truly commanding positions (>= 85% win probability) where multiple conversion paths exist.
    let commanding_threshold = 0.85 / mode_scale;
    if q_played >= commanding_threshold && q_best >= commanding_threshold {
        if delta_q <= 0.04 {
            return (MoveAssessment::Best, eval_loss, 100.0);
        } else if delta_q <= 0.08 {
            return (
                MoveAssessment::Excellent,
                eval_loss,
                (100.0 - delta_q * 80.0).clamp(94.0, 99.0),
            );
        } else if delta_q <= 0.15 {
            return (
                MoveAssessment::Good,
                eval_loss,
                (94.0 - delta_q * 60.0).clamp(85.0, 93.0),
            );
        }
    }

    // 3. Forward Pawn Move Protection
    // Advancing your pawn along the shortest path towards the goal is the primary objective of DuoOrb.
    // Moving 1 step closer to your goal (static_1ply_net_gain >= 1) is shielded from Blunder/Mistake unless
    // a critical defensive wall was missed (delta_q > 0.24).
    let is_forward_pawn_advance = !is_wall && !is_jump && static_1ply_net_gain >= 1;
    if is_forward_pawn_advance {
        if delta_q <= 0.06 {
            return (
                MoveAssessment::Excellent,
                eval_loss,
                (100.0 - delta_q * 80.0).clamp(92.0, 99.0),
            );
        } else if delta_q <= 0.14 {
            return (
                MoveAssessment::Good,
                eval_loss,
                (94.0 - delta_q * 70.0).clamp(82.0, 91.0),
            );
        } else if delta_q <= 0.24 {
            return (
                MoveAssessment::Inaccuracy,
                eval_loss,
                (82.0 - delta_q * 60.0).clamp(65.0, 81.0),
            );
        }
    }

    // 4. Suboptimal Tiers (Walls, Retreats, Lateral moves, Missed critical defense)
    let win_threshold = 0.50 / mode_scale;
    let losing_threshold = 0.30 / mode_scale;
    let flipped_bar = (q_best >= win_threshold && q_played <= losing_threshold) || delta_q >= 0.28;

    let assessment = if delta_q <= 0.055 {
        MoveAssessment::Excellent
    } else if delta_q <= 0.12 {
        MoveAssessment::Good
    } else if delta_q <= 0.20 {
        MoveAssessment::Inaccuracy
    } else if delta_q <= 0.28 || !flipped_bar {
        MoveAssessment::Mistake
    } else {
        MoveAssessment::Blunder
    };

    let accuracy = match assessment {
        MoveAssessment::Excellent => (100.0 - delta_q * 80.0).clamp(92.0, 99.0),
        MoveAssessment::Good => (92.0 - delta_q * 90.0).clamp(78.0, 91.0),
        MoveAssessment::Inaccuracy => (78.0 - delta_q * 100.0).clamp(58.0, 77.0),
        MoveAssessment::Mistake => (58.0 - delta_q * 100.0).clamp(30.0, 57.0),
        MoveAssessment::Blunder => (30.0 - delta_q * 60.0).clamp(0.0, 29.0),
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
            classify_mcts_move(0.9, 0.1, 0.8, 0.5, 0, false, false, true, 2, 10),
            (MoveAssessment::Forced, 0.0, 100.0)
        );
    }

    #[test]
    fn brilliant_trap_wall_recognition() {
        let (assessment, loss, accuracy) =
            classify_mcts_move(0.65, 0.65, 0.52, 0.45, 0, true, false, false, 2, 8);
        assert_eq!(assessment, MoveAssessment::Brilliant);
        assert_eq!(loss, 0.0);
        assert_eq!(accuracy, 100.0);
    }

    #[test]
    fn opening_move_is_best_not_great() {
        // Ply 1 opening pawn step with a gap to backward step: must be Best, NOT Great!
        let (assessment, _, _) =
            classify_mcts_move(0.55, 0.55, 0.38, 0.38, 1, false, false, false, 2, 1);
        assert_eq!(assessment, MoveAssessment::Best);
    }

    #[test]
    fn great_move_is_only_winning_move_in_midgame() {
        let (assessment, loss, accuracy) =
            classify_mcts_move(0.65, 0.65, 0.48, 0.55, 1, false, false, false, 2, 10);
        assert_eq!(assessment, MoveAssessment::Great);
        assert_eq!(loss, 0.0);
        assert_eq!(accuracy, 100.0);
    }

    #[test]
    fn normal_best_move_without_huge_gap() {
        let (assessment, loss, accuracy) =
            classify_mcts_move(0.55, 0.55, 0.51, 0.53, 0, false, false, false, 2, 10);
        assert_eq!(assessment, MoveAssessment::Best);
        assert_eq!(loss, 0.0);
        assert_eq!(accuracy, 100.0);
    }

    #[test]
    fn small_non_flipping_loss_is_not_a_blunder() {
        let (assessment, _, _) =
            classify_mcts_move(0.55, 0.46, 0.48, 0.46, 0, false, false, false, 2, 10);
        assert_eq!(assessment, MoveAssessment::Good);
    }

    #[test]
    fn large_loss_without_a_bar_flip_is_capped_at_mistake() {
        let (assessment, _, _) =
            classify_mcts_move(0.42, 0.20, 0.35, 0.20, 0, false, false, false, 2, 10);
        assert_eq!(assessment, MoveAssessment::Mistake);
    }

    #[test]
    fn genuine_bar_flip_is_a_blunder() {
        let (assessment, _, accuracy) =
            classify_mcts_move(0.72, 0.28, 0.65, 0.40, 0, false, false, false, 2, 10);
        assert_eq!(assessment, MoveAssessment::Blunder);
        assert!(accuracy <= 25.0);
    }

    #[test]
    fn four_player_equity_scaling() {
        // In 4P, baseline equity is 0.25. A delta_q of 0.15 is scaled by 2.0x to 0.30 -> Blunder
        let (assessment, _, _) =
            classify_mcts_move(0.35, 0.15, 0.30, 0.20, 0, false, false, false, 4, 10);
        assert_eq!(assessment, MoveAssessment::Blunder);
    }
}
