use serde::{Deserialize, Serialize};

use crate::hybrid::find_ranked_hybrid_actions;
use crate::mcts::Prng;
use crate::pathfinding::is_goal_cell;
use crate::rules::is_legal_action;
use crate::types::{CellCoord, GameAction, GameState, Orientation, PlayerState, WallCoord};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WallStyle {
    Balanced,
    HorizontalBarricade,
    VerticalCorridor,
    DefensiveBackwall,
    FlankTrap,
    Minimal,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OpeningStyle {
    Mixed,
    EarlyFence,
    CenterMarch,
    WingDrift,
    BackGate,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BotPersonalityConfig {
    pub id: String,
    pub name: String,
    pub elo: u32,
    pub temperature: f32,
    pub blunder_rate: f32,
    pub blunder_rank_min: usize,
    pub blunder_rank_max: usize,
    pub wall_prob_bias: f32,
    pub wall_style: WallStyle,
    pub opening_style: OpeningStyle,
    pub variety_window: f32,
    pub simulations: usize,
}

impl Default for BotPersonalityConfig {
    fn default() -> Self {
        Self {
            id: "balanced_bot".to_string(),
            name: "Balanced Bot".to_string(),
            elo: 1500,
            temperature: 0.5,
            blunder_rate: 0.05,
            blunder_rank_min: 1,
            blunder_rank_max: 3,
            wall_prob_bias: 0.0,
            wall_style: WallStyle::Balanced,
            opening_style: OpeningStyle::Mixed,
            variety_window: 0.05,
            simulations: 3000,
        }
    }
}

/// Retrieve exact calibrated preset for any of the 39 official bots.
pub fn get_bot_preset(id: &str) -> BotPersonalityConfig {
    let lower = id.to_lowercase();
    match lower.as_str() {
        // Beginners (Elo 450 - 1050)
        "barnaby" => BotPersonalityConfig {
            id: "barnaby".into(),
            name: "Barnaby".into(),
            elo: 450,
            temperature: 1.00,
            blunder_rate: 0.55,
            blunder_rank_min: 4,
            blunder_rank_max: 9,
            wall_prob_bias: -0.15,
            wall_style: WallStyle::Balanced,
            opening_style: OpeningStyle::Mixed,
            variety_window: 0.25,
            simulations: 50,
        },
        "finn" => BotPersonalityConfig {
            id: "finn".into(),
            name: "Finn".into(),
            elo: 580,
            temperature: 0.90,
            blunder_rate: 0.50,
            blunder_rank_min: 3,
            blunder_rank_max: 8,
            wall_prob_bias: -0.20,
            wall_style: WallStyle::Balanced,
            opening_style: OpeningStyle::Mixed,
            variety_window: 0.20,
            simulations: 60,
        },
        "clara" => BotPersonalityConfig {
            id: "clara".into(),
            name: "Clara".into(),
            elo: 650,
            temperature: 0.85,
            blunder_rate: 0.45,
            blunder_rank_min: 3,
            blunder_rank_max: 7,
            wall_prob_bias: -0.10,
            wall_style: WallStyle::Balanced,
            opening_style: OpeningStyle::CenterMarch,
            variety_window: 0.18,
            simulations: 80,
        },
        "leo" => BotPersonalityConfig {
            id: "leo".into(),
            name: "Leo".into(),
            elo: 780,
            temperature: 0.80,
            blunder_rate: 0.42,
            blunder_rank_min: 3,
            blunder_rank_max: 7,
            wall_prob_bias: -0.25,
            wall_style: WallStyle::Balanced,
            opening_style: OpeningStyle::Mixed,
            variety_window: 0.16,
            simulations: 100,
        },
        "martin" => BotPersonalityConfig {
            id: "martin".into(),
            name: "Martin".into(),
            elo: 800,
            temperature: 0.75,
            blunder_rate: 0.40,
            blunder_rank_min: 3,
            blunder_rank_max: 7,
            wall_prob_bias: -0.12,
            wall_style: WallStyle::Balanced,
            opening_style: OpeningStyle::Mixed,
            variety_window: 0.15,
            simulations: 100,
        },
        "tariq" => BotPersonalityConfig {
            id: "tariq".into(),
            name: "Tariq".into(),
            elo: 920,
            temperature: 0.70,
            blunder_rate: 0.32,
            blunder_rank_min: 2,
            blunder_rank_max: 6,
            wall_prob_bias: -0.05,
            wall_style: WallStyle::DefensiveBackwall,
            opening_style: OpeningStyle::Mixed,
            variety_window: 0.14,
            simulations: 150,
        },
        "pip" => BotPersonalityConfig {
            id: "pip".into(),
            name: "Pip".into(),
            elo: 950,
            temperature: 0.65,
            blunder_rate: 0.30,
            blunder_rank_min: 2,
            blunder_rank_max: 6,
            wall_prob_bias: -0.20,
            wall_style: WallStyle::Balanced,
            opening_style: OpeningStyle::Mixed,
            variety_window: 0.14,
            simulations: 150,
        },
        "ren" => BotPersonalityConfig {
            id: "ren".into(),
            name: "Ren".into(),
            elo: 1050,
            temperature: 0.60,
            blunder_rate: 0.25,
            blunder_rank_min: 2,
            blunder_rank_max: 5,
            wall_prob_bias: -0.03,
            wall_style: WallStyle::Balanced,
            opening_style: OpeningStyle::Mixed,
            variety_window: 0.10,
            simulations: 200,
        },

        // Intermediates (Elo 1100 - 1650)
        "elias" => BotPersonalityConfig {
            id: "elias".into(),
            name: "Elias".into(),
            elo: 1100,
            temperature: 0.55,
            blunder_rate: 0.35,
            blunder_rank_min: 3,
            blunder_rank_max: 7,
            wall_prob_bias: 0.03,
            wall_style: WallStyle::Balanced,
            opening_style: OpeningStyle::Mixed,
            variety_window: 0.08,
            simulations: 150,
        },
        "mateo" => BotPersonalityConfig {
            id: "mateo".into(),
            name: "Mateo".into(),
            elo: 1250,
            temperature: 0.50,
            blunder_rate: 0.30,
            blunder_rank_min: 3,
            blunder_rank_max: 7,
            wall_prob_bias: 0.05,
            wall_style: WallStyle::FlankTrap,
            opening_style: OpeningStyle::Mixed,
            variety_window: 0.06,
            simulations: 200,
        },
        "bram" => BotPersonalityConfig {
            id: "bram".into(),
            name: "Bram".into(),
            elo: 1300,
            temperature: 0.48,
            blunder_rate: 0.26,
            blunder_rank_min: 3,
            blunder_rank_max: 6,
            wall_prob_bias: 0.23,
            wall_style: WallStyle::HorizontalBarricade,
            opening_style: OpeningStyle::EarlyFence,
            variety_window: 0.06,
            simulations: 250,
        },
        "zara" => BotPersonalityConfig {
            id: "zara".into(),
            name: "Zara".into(),
            elo: 1320,
            temperature: 0.45,
            blunder_rate: 0.24,
            blunder_rank_min: 3,
            blunder_rank_max: 6,
            wall_prob_bias: 0.15,
            wall_style: WallStyle::HorizontalBarricade,
            opening_style: OpeningStyle::Mixed,
            variety_window: 0.05,
            simulations: 300,
        },
        "archimedes" => BotPersonalityConfig {
            id: "archimedes".into(),
            name: "Archimedes".into(),
            elo: 1380,
            temperature: 0.42,
            blunder_rate: 0.22,
            blunder_rank_min: 3,
            blunder_rank_max: 6,
            wall_prob_bias: 0.10,
            wall_style: WallStyle::VerticalCorridor,
            opening_style: OpeningStyle::Mixed,
            variety_window: 0.05,
            simulations: 350,
        },
        "fiona" => BotPersonalityConfig {
            id: "fiona".into(),
            name: "Fiona".into(),
            elo: 1440,
            temperature: 0.40,
            blunder_rate: 0.20,
            blunder_rank_min: 2,
            blunder_rank_max: 5,
            wall_prob_bias: 0.07,
            wall_style: WallStyle::Balanced,
            opening_style: OpeningStyle::Mixed,
            variety_window: 0.05,
            simulations: 400,
        },
        "nelson" => BotPersonalityConfig {
            id: "nelson".into(),
            name: "Nelson".into(),
            elo: 1450,
            temperature: 0.38,
            blunder_rate: 0.18,
            blunder_rank_min: 2,
            blunder_rank_max: 5,
            wall_prob_bias: 0.10,
            wall_style: WallStyle::Balanced,
            opening_style: OpeningStyle::CenterMarch,
            variety_window: 0.05,
            simulations: 450,
        },
        "dmitri" => BotPersonalityConfig {
            id: "dmitri".into(),
            name: "Dmitri".into(),
            elo: 1480,
            temperature: 0.36,
            blunder_rate: 0.16,
            blunder_rank_min: 2,
            blunder_rank_max: 5,
            wall_prob_bias: 0.23,
            wall_style: WallStyle::HorizontalBarricade,
            opening_style: OpeningStyle::Mixed,
            variety_window: 0.05,
            simulations: 500,
        },
        "layla" => BotPersonalityConfig {
            id: "layla".into(),
            name: "Layla".into(),
            elo: 1520,
            temperature: 0.34,
            blunder_rate: 0.15,
            blunder_rank_min: 2,
            blunder_rank_max: 4,
            wall_prob_bias: 0.09,
            wall_style: WallStyle::Balanced,
            opening_style: OpeningStyle::Mixed,
            variety_window: 0.05,
            simulations: 550,
        },
        "vex" => BotPersonalityConfig {
            id: "vex".into(),
            name: "Vex".into(),
            elo: 1550,
            temperature: 0.32,
            blunder_rate: 0.14,
            blunder_rank_min: 2,
            blunder_rank_max: 4,
            wall_prob_bias: 0.07,
            wall_style: WallStyle::FlankTrap,
            opening_style: OpeningStyle::Mixed,
            variety_window: 0.05,
            simulations: 600,
        },
        "dante" => BotPersonalityConfig {
            id: "dante".into(),
            name: "Dante".into(),
            elo: 1560,
            temperature: 0.30,
            blunder_rate: 0.13,
            blunder_rank_min: 2,
            blunder_rank_max: 4,
            wall_prob_bias: 0.10,
            wall_style: WallStyle::FlankTrap,
            opening_style: OpeningStyle::Mixed,
            variety_window: 0.05,
            simulations: 600,
        },
        "meiling" | "mei-ling" => BotPersonalityConfig {
            id: "meiling".into(),
            name: "Mei-Ling".into(),
            elo: 1600,
            temperature: 0.28,
            blunder_rate: 0.12,
            blunder_rank_min: 2,
            blunder_rank_max: 4,
            wall_prob_bias: 0.07,
            wall_style: WallStyle::VerticalCorridor,
            opening_style: OpeningStyle::Mixed,
            variety_window: 0.05,
            simulations: 800,
        },
        "amara" => BotPersonalityConfig {
            id: "amara".into(),
            name: "Amara".into(),
            elo: 1640,
            temperature: 0.26,
            blunder_rate: 0.11,
            blunder_rank_min: 2,
            blunder_rank_max: 4,
            wall_prob_bias: 0.05,
            wall_style: WallStyle::Balanced,
            opening_style: OpeningStyle::Mixed,
            variety_window: 0.05,
            simulations: 900,
        },
        "jamal" => BotPersonalityConfig {
            id: "jamal".into(),
            name: "Jamal".into(),
            elo: 1650,
            temperature: 0.25,
            blunder_rate: 0.10,
            blunder_rank_min: 2,
            blunder_rank_max: 4,
            wall_prob_bias: -0.10,
            wall_style: WallStyle::Minimal,
            opening_style: OpeningStyle::Mixed,
            variety_window: 0.04,
            simulations: 1000,
        },

        // Masters (Elo 1750 - 2380)
        "gideon" => BotPersonalityConfig {
            id: "gideon".into(),
            name: "Gideon".into(),
            elo: 1750,
            temperature: 0.22,
            blunder_rate: 0.09,
            blunder_rank_min: 1,
            blunder_rank_max: 3,
            wall_prob_bias: 0.03,
            wall_style: WallStyle::Balanced,
            opening_style: OpeningStyle::Mixed,
            variety_window: 0.05,
            simulations: 1200,
        },
        "sora" => BotPersonalityConfig {
            id: "sora".into(),
            name: "Sora".into(),
            elo: 1840,
            temperature: 0.20,
            blunder_rate: 0.08,
            blunder_rank_min: 1,
            blunder_rank_max: 3,
            wall_prob_bias: 0.01,
            wall_style: WallStyle::VerticalCorridor,
            opening_style: OpeningStyle::Mixed,
            variety_window: 0.05,
            simulations: 1400,
        },
        "marcus" => BotPersonalityConfig {
            id: "marcus".into(),
            name: "Marcus".into(),
            elo: 1900,
            temperature: 0.18,
            blunder_rate: 0.07,
            blunder_rank_min: 1,
            blunder_rank_max: 3,
            wall_prob_bias: 0.05,
            wall_style: WallStyle::FlankTrap,
            opening_style: OpeningStyle::Mixed,
            variety_window: 0.025,
            simulations: 1600,
        },
        "samira" => BotPersonalityConfig {
            id: "samira".into(),
            name: "Samira".into(),
            elo: 1920,
            temperature: 0.16,
            blunder_rate: 0.06,
            blunder_rank_min: 1,
            blunder_rank_max: 3,
            wall_prob_bias: 0.09,
            wall_style: WallStyle::HorizontalBarricade,
            opening_style: OpeningStyle::Mixed,
            variety_window: 0.04,
            simulations: 1800,
        },
        "torstein" => BotPersonalityConfig {
            id: "torstein".into(),
            name: "Torstein".into(),
            elo: 2020,
            temperature: 0.14,
            blunder_rate: 0.03,
            blunder_rank_min: 1,
            blunder_rank_max: 2,
            wall_prob_bias: 0.07,
            wall_style: WallStyle::Balanced,
            opening_style: OpeningStyle::Mixed,
            variety_window: 0.03,
            simulations: 2200,
        },
        "viktor" => BotPersonalityConfig {
            id: "viktor".into(),
            name: "Viktor".into(),
            elo: 2100,
            temperature: 0.12,
            blunder_rate: 0.025,
            blunder_rank_min: 1,
            blunder_rank_max: 2,
            wall_prob_bias: 0.22,
            wall_style: WallStyle::HorizontalBarricade,
            opening_style: OpeningStyle::EarlyFence,
            variety_window: 0.04,
            simulations: 3000,
        },
        "kofi" => BotPersonalityConfig {
            id: "kofi".into(),
            name: "Kofi".into(),
            elo: 2120,
            temperature: 0.12,
            blunder_rate: 0.02,
            blunder_rank_min: 1,
            blunder_rank_max: 2,
            wall_prob_bias: 0.06,
            wall_style: WallStyle::Balanced,
            opening_style: OpeningStyle::Mixed,
            variety_window: 0.03,
            simulations: 3200,
        },
        "diego" => BotPersonalityConfig {
            id: "diego".into(),
            name: "Captain Diego".into(),
            elo: 2220,
            temperature: 0.11,
            blunder_rate: 0.015,
            blunder_rank_min: 1,
            blunder_rank_max: 2,
            wall_prob_bias: 0.08,
            wall_style: WallStyle::FlankTrap,
            opening_style: OpeningStyle::Mixed,
            variety_window: 0.03,
            simulations: 3500,
        },
        "hassan" => BotPersonalityConfig {
            id: "hassan".into(),
            name: "Hassan".into(),
            elo: 2300,
            temperature: 0.10,
            blunder_rate: 0.012,
            blunder_rank_min: 1,
            blunder_rank_max: 2,
            wall_prob_bias: 0.07,
            wall_style: WallStyle::Balanced,
            opening_style: OpeningStyle::Mixed,
            variety_window: 0.02,
            simulations: 4000,
        },
        "jin" => BotPersonalityConfig {
            id: "jin".into(),
            name: "Master Jin".into(),
            elo: 2380,
            temperature: 0.09,
            blunder_rate: 0.01,
            blunder_rank_min: 1,
            blunder_rank_max: 2,
            wall_prob_bias: 0.08,
            wall_style: WallStyle::Balanced,
            opening_style: OpeningStyle::Mixed,
            variety_window: 0.02,
            simulations: 4500,
        },

        // Grandmasters (Elo 2400 - 2900)
        "achref" => BotPersonalityConfig {
            id: "achref".into(),
            name: "Achref".into(),
            elo: 2400,
            temperature: 0.08,
            blunder_rate: 0.01,
            blunder_rank_min: 1,
            blunder_rank_max: 2,
            wall_prob_bias: 0.08,
            wall_style: WallStyle::Balanced,
            opening_style: OpeningStyle::Mixed,
            variety_window: 0.035,
            simulations: 6000,
        },
        "sterling" => BotPersonalityConfig {
            id: "sterling".into(),
            name: "Sterling".into(),
            elo: 2480,
            temperature: 0.07,
            blunder_rate: 0.01,
            blunder_rank_min: 1,
            blunder_rank_max: 2,
            wall_prob_bias: 0.06,
            wall_style: WallStyle::Balanced,
            opening_style: OpeningStyle::Mixed,
            variety_window: 0.01,
            simulations: 7000,
        },
        "kenzo" => BotPersonalityConfig {
            id: "kenzo".into(),
            name: "Sensei Kenzo".into(),
            elo: 2580,
            temperature: 0.06,
            blunder_rate: 0.01,
            blunder_rank_min: 1,
            blunder_rank_max: 2,
            wall_prob_bias: 0.07,
            wall_style: WallStyle::Balanced,
            opening_style: OpeningStyle::Mixed,
            variety_window: 0.01,
            simulations: 8000,
        },
        "valeria" => BotPersonalityConfig {
            id: "valeria".into(),
            name: "Dr. Valeria Vance".into(),
            elo: 2680,
            temperature: 0.05,
            blunder_rate: 0.01,
            blunder_rank_min: 1,
            blunder_rank_max: 2,
            wall_prob_bias: 0.07,
            wall_style: WallStyle::Balanced,
            opening_style: OpeningStyle::Mixed,
            variety_window: 0.01,
            simulations: 10000,
        },
        "nexus9" | "nexus-9" => BotPersonalityConfig {
            id: "nexus9".into(),
            name: "NEXUS-9".into(),
            elo: 2750,
            temperature: 0.04,
            blunder_rate: 0.01,
            blunder_rank_min: 1,
            blunder_rank_max: 2,
            wall_prob_bias: 0.06,
            wall_style: WallStyle::Balanced,
            opening_style: OpeningStyle::Mixed,
            variety_window: 0.01,
            simulations: 12000,
        },
        "boba" => BotPersonalityConfig {
            id: "boba".into(),
            name: "Boba".into(),
            elo: 2820,
            temperature: 0.03,
            blunder_rate: 0.01,
            blunder_rank_min: 1,
            blunder_rank_max: 2,
            wall_prob_bias: 0.06,
            wall_style: WallStyle::Balanced,
            opening_style: OpeningStyle::Mixed,
            variety_window: 0.005,
            simulations: 14000,
        },
        "milo" => BotPersonalityConfig {
            id: "milo".into(),
            name: "Milo".into(),
            elo: 2900,
            temperature: 0.06,
            blunder_rate: 0.0,
            blunder_rank_min: 0,
            blunder_rank_max: 0,
            wall_prob_bias: 0.0,
            wall_style: WallStyle::Balanced,
            opening_style: OpeningStyle::Mixed,
            variety_window: 0.0,
            simulations: 100,
        },

        // Fallback for generic or unknown bot names
        _ => BotPersonalityConfig::default(),
    }
}

fn manhattan(a: CellCoord, b_row: f32, b_col: f32) -> f32 {
    (a.row as f32 - b_row).abs() + (a.col as f32 - b_col).abs()
}

fn nearest_opponent_distance(state: &GameState, mover_id: &str, target_r: f32, target_c: f32) -> f32 {
    let mut min_d = f32::INFINITY;
    for p in &state.players {
        if p.id != mover_id && p.status == "ACTIVE" {
            let d = manhattan(p.position, target_r, target_c);
            if d < min_d {
                min_d = d;
            }
        }
    }
    min_d
}

fn wall_style_bias(
    state: &GameState,
    player: &PlayerState,
    wall: &WallCoord,
    is_opening: bool,
    wall_style: WallStyle,
    opening_style: OpeningStyle,
    wall_prob_bias: f32,
) -> f32 {
    let center_r = wall.row as f32 + 0.5;
    let center_c = wall.col as f32 + 0.5;
    let own_distance = manhattan(player.position, center_r, center_c);
    let rival_distance = nearest_opponent_distance(state, &player.id, center_r, center_c);

    let mut score = match wall_style {
        WallStyle::HorizontalBarricade => {
            if wall.orientation == Orientation::H { 0.04 } else { -0.02 }
        }
        WallStyle::VerticalCorridor => {
            if wall.orientation == Orientation::V { 0.04 } else { -0.02 }
        }
        WallStyle::DefensiveBackwall => {
            if own_distance <= 3.0 { 0.035 } else { -0.015 }
        }
        WallStyle::FlankTrap => {
            if rival_distance <= 3.0 { 0.035 } else { -0.015 }
        }
        WallStyle::Minimal => -0.06,
        WallStyle::Balanced => 0.0,
    };

    if opening_style == OpeningStyle::EarlyFence && is_opening {
        score += 0.045;
    }

    if (state.mode.starts_with("race") || state.mode.starts_with("center")) && rival_distance <= 3.0 {
        score += 0.04;
    }

    score += wall_prob_bias * 0.05;
    score
}

fn opening_move_bias(
    to: CellCoord,
    is_opening: bool,
    opening_style: OpeningStyle,
    player: &PlayerState,
) -> f32 {
    if !is_opening {
        return 0.0;
    }
    match opening_style {
        OpeningStyle::CenterMarch => {
            let center_dist = (to.row as i32 - 4).abs() + (to.col as i32 - 4).abs();
            (4 - center_dist) as f32 * 0.012
        }
        OpeningStyle::WingDrift => {
            let edge_dist = to.row.min(8 - to.row).min(to.col).min(8 - to.col);
            edge_dist as f32 * 0.01
        }
        OpeningStyle::EarlyFence => -0.025,
        OpeningStyle::BackGate => {
            match player.goal_direction {
                crate::types::GoalDirection::Bottom => (to.row as f32 - 4.0).max(0.0) * 0.008,
                crate::types::GoalDirection::Top => (4.0 - to.row as f32).max(0.0) * 0.008,
                crate::types::GoalDirection::Right => (to.col as f32 - 4.0).max(0.0) * 0.008,
                crate::types::GoalDirection::Left => (4.0 - to.col as f32).max(0.0) * 0.008,
                crate::types::GoalDirection::Center => 0.0,
            }
        }
        OpeningStyle::Mixed => 0.0,
    }
}

fn is_immediate_win(state: &GameState, mover_idx: usize, action: &GameAction) -> bool {
    if let GameAction::Move { to } = action {
        if let Some(player) = state.players.get(mover_idx) {
            return is_goal_cell(*to, player.goal_direction, &state.mode);
        }
    }
    false
}

fn is_backward_pawn_move(state: &GameState, mover_idx: usize, action: &GameAction) -> bool {
    if let GameAction::Move { to } = action {
        if let Some(player) = state.players.get(mover_idx) {
            let board = crate::board::Board::from_walls(&state.walls);
            let cur_dist = crate::pathfinding::shortest_distance(
                player.position,
                player.goal_direction,
                &board,
                &state.mode,
            );
            let next_dist = crate::pathfinding::shortest_distance(
                *to,
                player.goal_direction,
                &board,
                &state.mode,
            );
            return next_dist > cur_dist;
        }
    }
    false
}

/// The Master Personality Decision Function:
/// 1. Finds ranked legal actions from the hybrid engine (up to 20 candidates).
/// 2. If immediate winning move exists, plays it.
/// 3. Filters out backward pawn moves when forward/lateral options or walls exist.
/// 4. Dominance Gate: If Move #1 is dominant (gap >= 0.06 or prob >= 0.65), plays Move #1.
/// 5. Calibrated In-Character Blunders: Beginners sample from Ranks 2..6 of the Top-20 pool.
/// 6. Dynamic Near-Optimal Selection: Bots sample among close moves (within variety_window)
///    shaped by personality styles (wall bias, sprint bias, opening styles).
pub fn select_bot_action(
    state: &GameState,
    profile: &BotPersonalityConfig,
    seed: u64,
) -> GameAction {
    let mover_idx = state.current_player_index;
    let mover = match state.players.get(mover_idx) {
        Some(p) => p,
        None => return GameAction::Resign,
    };

    let mut rng = Prng::new(seed ^ 0x9E3779B97F4A7C15);

    // MILO: Pure AlphaZero ONNX Engine (100% Sigma Quoridor trained neural policy)
    // Runs pure AlphaZero MCTS with neural value lookahead simulations.
    if profile.id == "milo" {
        if let Some(evaluator) = crate::hybrid::get_global_evaluator() {
            let sims = profile.simulations.max(1);
            if sims <= 1 {
                if let Ok(ranked) = evaluator.get_ranked_legal_actions(state) {
                    if let Some(top) = ranked.first() {
                        return top.action.clone();
                    }
                }
            } else {
                return crate::alphazero::run_alphazero_mcts(evaluator, state, sims, 2.0);
            }
        }
    }

    // 1. Collect ranked candidates from hybrid engine (AlphaZero priors + MCTS).
    // The tactical 8-ply minimax solver is ONLY enabled for 2000+ Elo bots (Torstein, Viktor, Diego, Achref, Milo).
    // Beginners and lower intermediates rely on their own search so they can naturally miss non-trivial blocks!
    let use_solver = profile.elo >= 2000;
    let ranked = find_ranked_hybrid_actions(
        state,
        profile.simulations,
        4,
        seed,
        20,
        use_solver,
    );

    if ranked.is_empty() {
        return GameAction::Resign;
    }

    // 2. Check immediate win conversion
    for c in &ranked {
        if is_immediate_win(state, mover_idx, &c.action) {
            // High-Elo bots (>=1200) NEVER drop an immediate win
            if profile.elo >= 1200 {
                return c.action.clone();
            }
            // Beginners (e.g. dad Martin) take the win unless blunder roll succeeds
            if rng.next_f64() >= (profile.blunder_rate as f64) {
                return c.action.clone();
            }
        }
    }

    // 3. Shuffling filter for beginner bots on open boards:
    // Only beginners (Elo < 1200) on wide open boards (walls <= 1) have backward pawn retreats pruned
    // to prevent repetitive back-and-forth shuffling. Masters and Grandmasters retain full freedom to retreat tactically.
    let filter_backward = profile.elo < 1200 && state.walls.len() <= 1;
    let has_non_backward = ranked
        .iter()
        .any(|c| !is_backward_pawn_move(state, mover_idx, &c.action));

    let valid_pool: Vec<crate::hybrid::HybridRankedAction> = if filter_backward && has_non_backward {
        ranked
            .into_iter()
            .filter(|c| !is_backward_pawn_move(state, mover_idx, &c.action))
            .collect()
    } else {
        ranked
    };

    if valid_pool.is_empty() {
        return GameAction::Resign;
    }

    // 4. Dominance Gate:
    // When Move #1 has a decisive lead over Move #2, it is a tactical necessity
    // (e.g. forced defensive block or race conversion).
    let top_q = valid_pool[0].q;
    let top_prob = valid_pool[0].prob;
    let second_q = if valid_pool.len() > 1 { valid_pool[1].q } else { 0.0 };
    let q_gap = top_q - second_q;

    let is_dominant = q_gap >= 0.06 || top_prob >= 0.65;
    if is_dominant && profile.elo >= 2000 {
        return valid_pool[0].action.clone();
    }

    // 5. Calibrated Blunder Sampling (for lower-tier bots):
    // Blunders are selected from Rank min..max of the Top-20 candidate pool.
    // This produces realistic human inaccuracies rather than suicidal wall placements!
    let is_blundering = profile.blunder_rate > 0.0 && rng.next_f64() < (profile.blunder_rate as f64);
    if is_blundering && valid_pool.len() > 1 {
        let min_idx = profile.blunder_rank_min.min(valid_pool.len() - 1);
        let max_idx = profile.blunder_rank_max.min(valid_pool.len() - 1);
        if min_idx <= max_idx && min_idx > 0 {
            let span = max_idx - min_idx + 1;
            let blunder_pick = min_idx + ((rng.next_u64() as usize) % span);
            let action = valid_pool[blunder_pick].action.clone();
            if is_legal_action(state, &action) {
                return action;
            }
        }
    }

    // 6. Dynamic Candidate Pool Selection (Personality-Shaped):
    // For high-Elo bots (Elo >= 1400), filter strictly to candidates within the variety window of Move #1.
    // For lower-tier bots (Elo < 1400), expand pool to top 5 candidates so they aren't frozen to Move #1!
    let candidates_for_sampling: Vec<&crate::hybrid::HybridRankedAction> = if profile.elo >= 1400 {
        let variety_threshold = profile.variety_window.max(0.025);
        let pool: Vec<_> = valid_pool
            .iter()
            .filter(|c| (top_q - c.q) <= variety_threshold)
            .collect();
        if pool.len() == 1 {
            return pool[0].action.clone();
        }
        pool
    } else {
        valid_pool.iter().take(5).collect()
    };

    // Scale down MCTS visit logit gap for beginners so Candidate #0 doesn't have a 99% monopoly:
    let elo_logit_scale = (profile.elo as f32 / 2000.0).clamp(0.20, 1.0);

    // Apply personality style biases (wall preferences, sprint biases, opening styles)
    let is_opening = state.move_number <= (state.players.len() as u32 * 2).max(4);

    let mut scored_candidates: Vec<(GameAction, f32)> = candidates_for_sampling
        .into_iter()
        .map(|c| {
            let mut score = c.logit * elo_logit_scale;
            match &c.action {
                GameAction::PlaceWall { wall } => {
                    let bias = wall_style_bias(
                        state,
                        mover,
                        wall,
                        is_opening,
                        profile.wall_style,
                        profile.opening_style,
                        profile.wall_prob_bias,
                    );
                    score += bias * 25.0;
                    score += profile.wall_prob_bias * 6.0;
                }
                GameAction::Move { to } => {
                    let bias = opening_move_bias(*to, is_opening, profile.opening_style, mover);
                    score += bias * 25.0;
                    // Negative wall_prob_bias means pawn preference (sprint)
                    score -= profile.wall_prob_bias * 6.0;
                }
                _ => {}
            }
            (c.action.clone(), score)
        })
        .collect();

    scored_candidates.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

    // Softmax temperature sampling over personality-scored near-optimal moves:
    let max_score = scored_candidates
        .iter()
        .map(|c| c.1)
        .fold(f32::NEG_INFINITY, f32::max);

    let t = profile.temperature.clamp(0.05, 2.0);
    let weights: Vec<f32> = scored_candidates
        .iter()
        .map(|c| ((c.1 - max_score) / t).exp())
        .collect();
    let total_weight: f32 = weights.iter().sum();

    if total_weight > 0.0 && total_weight.is_finite() {
        let mut roll = (rng.next_f64() as f32) * total_weight;
        for (i, &w) in weights.iter().enumerate() {
            roll -= w;
            if roll <= 0.0 {
                let chosen = scored_candidates[i].0.clone();
                if is_legal_action(state, &chosen) {
                    return chosen;
                }
                break;
            }
        }
    }

    // Fallback: top legal action
    for (cand, _) in &scored_candidates {
        if is_legal_action(state, cand) {
            return cand.clone();
        }
    }

    valid_pool[0].action.clone()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{CellCoord, GoalDirection, PlayerState};

    fn make_test_state() -> GameState {
        GameState {
            game_id: "test-bot".to_string(),
            mode: "2p".to_string(),
            current_player_index: 0,
            players: vec![
                PlayerState {
                    id: "p1".to_string(),
                    index: 0,
                    display_name: "P1".to_string(),
                    position: CellCoord { row: 0, col: 4 },
                    walls_remaining: 10,
                    goal_direction: GoalDirection::Bottom,
                    status: "ACTIVE".to_string(),
                },
                PlayerState {
                    id: "p2".to_string(),
                    index: 1,
                    display_name: "P2".to_string(),
                    position: CellCoord { row: 8, col: 4 },
                    walls_remaining: 10,
                    goal_direction: GoalDirection::Top,
                    status: "ACTIVE".to_string(),
                },
            ],
            walls: vec![],
            move_number: 1,
            status: "IN_PROGRESS".to_string(),
        }
    }

    #[test]
    fn test_all_39_bots_have_valid_presets() {
        let bot_ids = [
            "martin", "pip", "elias", "bram", "nelson", "vex", "jamal", "marcus", "viktor", "achref",
            "barnaby", "finn", "clara", "leo", "tariq", "ren", "mateo", "zara", "archimedes", "fiona",
            "dmitri", "layla", "dante", "meiling", "amara", "gideon", "sora", "samira", "torstein",
            "kofi", "diego", "hassan", "jin", "sterling", "kenzo", "valeria", "nexus9", "boba", "milo",
        ];

        for id in bot_ids {
            let preset = get_bot_preset(id);
            assert!(preset.elo > 0, "Bot {} should have valid Elo", id);
            assert!(preset.temperature > 0.0, "Bot {} should have positive temperature", id);
        }
    }

    #[test]
    fn test_grandmaster_plays_legal_action_immediately() {
        let state = make_test_state();
        let achref = get_bot_preset("achref");
        let action = select_bot_action(&state, &achref, 42);
        assert!(is_legal_action(&state, &action));
    }

    #[test]
    fn test_beginner_dad_martin_plays_legal_action() {
        let state = make_test_state();
        let martin = get_bot_preset("martin");
        let action = select_bot_action(&state, &martin, 12345);
        assert!(is_legal_action(&state, &action));
    }

    #[test]
    fn test_immediate_win_taken_by_high_elo() {
        let mut state = make_test_state();
        state.players[0].position = CellCoord { row: 7, col: 4 }; // 1 step from row 8!
        let achref = get_bot_preset("achref");
        let action = select_bot_action(&state, &achref, 999);
        assert!(matches!(action, GameAction::Move { to } if to.row == 8), "Expected move to winning row 8, got {:?}", action);
    }

    #[test]
    fn test_bots_exhibit_move_diversity() {
        let state = make_test_state();
        let achref = get_bot_preset("achref");
        let martin = get_bot_preset("martin");
        let viktor = get_bot_preset("viktor");

        let a_act = select_bot_action(&state, &achref, 100);
        let m_act = select_bot_action(&state, &martin, 200);
        let v_act = select_bot_action(&state, &viktor, 300);

        assert!(is_legal_action(&state, &a_act));
        assert!(is_legal_action(&state, &m_act));
        assert!(is_legal_action(&state, &v_act));
    }

    #[test]
    fn test_bot_never_retreats_when_forward_is_open() {
        let mut state = make_test_state();
        // P1 at (4, 4), goal is Bottom (row 8)
        state.players[0].position = CellCoord { row: 4, col: 4 };
        state.players[0].walls_remaining = 0; // force pawn moves only
        state.walls.clear();

        // Test with beginner Martin across 20 distinct seeds
        let martin = get_bot_preset("martin");
        for seed in 1..=20 {
            let act = select_bot_action(&state, &martin, seed);
            if let GameAction::Move { to } = act {
                assert!(
                    to.row >= 4,
                    "Martin must advance toward row 8, never retreat backwards to row < 4! Got row {}",
                    to.row
                );
            }
        }
    }

    #[test]
    fn test_milo_and_viktor_have_distinct_style_preferences() {
        let state = make_test_state();
        let milo = get_bot_preset("milo");
        let viktor = get_bot_preset("viktor");

        assert_eq!(milo.elo, 2900);
        assert_eq!(viktor.wall_style, WallStyle::HorizontalBarricade);
        assert!(viktor.wall_prob_bias > 0.0, "Viktor must prefer wall placements");

        let milo_act = select_bot_action(&state, &milo, 42);
        let viktor_act = select_bot_action(&state, &viktor, 42);
        assert!(is_legal_action(&state, &milo_act));
        assert!(is_legal_action(&state, &viktor_act));
    }

    #[test]
    fn test_grandmaster_achref_counters_trap_with_wall_instead_of_zombie_walking() {
        let mut state = make_test_state();
        // Achref is player 0 (heading to row 8)
        // Opponent has set up flanking vertical walls creating a corridor trap at col 4
        state.players[0].position = CellCoord { row: 3, col: 4 };
        state.players[0].walls_remaining = 8;
        state.players[1].position = CellCoord { row: 6, col: 4 };
        state.players[1].walls_remaining = 8;
        state.walls = vec![
            WallCoord { row: 3, col: 3, orientation: Orientation::V },
            WallCoord { row: 3, col: 4, orientation: Orientation::V },
        ];

        let achref = get_bot_preset("achref");
        let act = select_bot_action(&state, &achref, 42);

        // Achref must NOT walk blindly into the corridor trap at (4, 4)!
        if let GameAction::Move { to } = act {
            assert_ne!(
                to,
                CellCoord { row: 4, col: 4 },
                "Achref must NOT zombie walk into the corridor trap at (4,4)!"
            );
        }
    }
}
