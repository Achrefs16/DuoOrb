use crate::board::Board;
use crate::pathfinding::shortest_distance;
use crate::types::GameState;

pub const WIN_SCORE: f64 = 10000.0;
pub const PATH_DIFF_WEIGHT: f64 = 10.0;
pub const WALL_ADVANTAGE_WEIGHT: f64 = 1.5;

pub fn evaluate_state(state: &GameState, active_player_id: &str, board: &Board) -> f64 {
    if state.status == "COMPLETED" {
        let is_winner = state.players.iter().any(|p| p.id == active_player_id && p.status == "FINISHED");
        return if is_winner { WIN_SCORE } else { -WIN_SCORE };
    }

    let me = match state.players.iter().find(|p| p.id == active_player_id) {
        Some(p) => p,
        None => return 0.0,
    };

    let own_dist = shortest_distance(me.position, me.goal_direction, board, &state.mode);
    if own_dist < 0 {
        return -WIN_SCORE;
    }
    if own_dist == 0 {
        return WIN_SCORE;
    }

    let opponents: Vec<_> = state.players.iter().filter(|p| p.id != active_player_id).collect();
    if opponents.is_empty() {
        return 0.0;
    }

    let mut min_opp_dist = i32::MAX;
    let mut total_opp_walls = 0;

    for opp in &opponents {
        let d = shortest_distance(opp.position, opp.goal_direction, board, &state.mode);
        if d >= 0 && d < min_opp_dist {
            min_opp_dist = d;
        }
        total_opp_walls += opp.walls_remaining;
    }

    if min_opp_dist == i32::MAX {
        min_opp_dist = own_dist;
    }

    let avg_opp_walls = total_opp_walls as f64 / opponents.len() as f64;

    // 1. Progress: closer is better
    let progress = -(own_dist as f64) * PATH_DIFF_WEIGHT;

    // 2. Race lead
    let lead_steps = (min_opp_dist - own_dist) as f64;
    let lead = lead_steps * PATH_DIFF_WEIGHT;

    // 3. Wall advantage
    let walls = (me.walls_remaining as f64 - avg_opp_walls) * WALL_ADVANTAGE_WEIGHT;

    progress + lead + walls
}
