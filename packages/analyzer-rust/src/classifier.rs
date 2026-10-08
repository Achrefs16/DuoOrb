use crate::types::MoveAssessment;

pub const WIN_CHANCE_SCALE: f64 = 20.0;
pub const ACCURACY_SCALE: f64 = 12.0;

#[inline(always)]
pub fn win_chance_from_eval(eval: f64) -> f64 {
    1.0 / (1.0 + (-eval / WIN_CHANCE_SCALE).exp())
}

#[inline(always)]
pub fn classify_mcts_move(
    best_q: f64,
    played_q: f64,
    forced: bool,
) -> (MoveAssessment, f64, f64) {
    if forced {
        return (MoveAssessment::Forced, 0.0, 100.0);
    }

    let delta_q = (best_q - played_q).max(0.0);

    // Converted loss units roughly scaled to Quoridor path steps (1 step ~ 10 loss)
    let loss = delta_q * 40.0;

    // Accuracy formula: 100% when loss is 0, smooth exponential decay
    let accuracy = if delta_q <= 0.01 {
        100.0
    } else {
        (100.0 * (-delta_q * 3.5).exp()).clamp(0.0, 100.0)
    };

    // WIN-RETENTION PROTECTION:
    // If player is clearly winning (best_q >= 0.70) and played move preserves
    // the winning state (played_q >= 0.65), it is NEVER an inaccuracy or blunder!
    if best_q >= 0.70 && played_q >= 0.65 {
        let assessment = if delta_q <= 0.03 {
            MoveAssessment::Best
        } else if delta_q <= 0.07 {
            MoveAssessment::Excellent
        } else {
            MoveAssessment::Good
        };
        return (assessment, loss, accuracy.max(85.0));
    }

    let assessment = if delta_q <= 0.03 {
        MoveAssessment::Best
    } else if delta_q <= 0.07 {
        MoveAssessment::Excellent
    } else if delta_q <= 0.15 {
        MoveAssessment::Good
    } else if delta_q <= 0.28 {
        MoveAssessment::Inaccuracy
    } else if delta_q <= 0.42 {
        MoveAssessment::Mistake
    } else {
        MoveAssessment::Blunder
    };

    (assessment, loss, accuracy)
}
