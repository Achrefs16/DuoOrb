use crate::types::MoveAssessment;

pub const WIN_CHANCE_SCALE: f64 = 20.0;
pub const ACCURACY_SCALE: f64 = 12.0;

#[inline(always)]
pub fn win_chance_from_eval(eval: f64) -> f64 {
    1.0 / (1.0 + (-eval / WIN_CHANCE_SCALE).exp())
}

#[inline(always)]
pub fn base_assessment(loss: f64, forced: bool, win_swing: f64) -> MoveAssessment {
    if forced {
        return MoveAssessment::Forced;
    }
    // Severe win chance drop forces at least Mistake or Blunder
    if win_swing <= -0.20 || loss > 25.0 {
        return MoveAssessment::Blunder;
    }
    if loss <= 1.0 {
        MoveAssessment::Best
    } else if loss <= 3.0 {
        MoveAssessment::Excellent
    } else if loss <= 6.0 {
        MoveAssessment::Good
    } else if loss <= 14.0 {
        MoveAssessment::Inaccuracy
    } else if loss <= 25.0 {
        MoveAssessment::Mistake
    } else {
        MoveAssessment::Blunder
    }
}

#[inline(always)]
pub fn move_accuracy(loss: f64, forced: bool) -> f64 {
    if forced {
        100.0
    } else {
        (100.0 * (-loss / ACCURACY_SCALE).exp()).clamp(0.0, 100.0)
    }
}
