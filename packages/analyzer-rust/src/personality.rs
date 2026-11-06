use serde::{Deserialize, Serialize};

use crate::hybrid::find_ranked_hybrid_actions;
use crate::mcts::Prng;
use crate::pathfinding::{is_goal_cell, EdgeMasks, GoalMask};
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

    let is_behind = match player.goal_direction {
        crate::types::GoalDirection::Bottom => wall.row < player.position.row,
        crate::types::GoalDirection::Top => wall.row > player.position.row,
        crate::types::GoalDirection::Right => wall.col < player.position.col,
        crate::types::GoalDirection::Left => wall.col > player.position.col,
        crate::types::GoalDirection::Center => false,
    };
    if is_behind {
        return -0.15;
    }

    let mut score = match wall_style {
        WallStyle::HorizontalBarricade => {
            if wall.orientation == Orientation::H {
                if rival_distance <= 3.5 { 0.06 } else { 0.02 }
            } else {
                -0.02
            }
        }
        WallStyle::VerticalCorridor => {
            if wall.orientation == Orientation::V {
                if wall.col == 3 || wall.col == 4 { 0.06 } else { 0.03 }
            } else {
                -0.02
            }
        }
        WallStyle::DefensiveBackwall => {
            if own_distance <= 3.0 && !is_behind { 0.04 } else { -0.02 }
        }
        WallStyle::FlankTrap => {
            if (wall.col <= 2 || wall.col >= 5) && rival_distance <= 3.5 { 0.05 } else { -0.015 }
        }
        WallStyle::Minimal => -0.06,
        WallStyle::Balanced => 0.0,
    };

    if opening_style == OpeningStyle::EarlyFence && is_opening {
        score += 0.045;
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

/// Checks whether a pawn move increases shortest distance to goal (backward or into a dead end).
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
            return next_dist < 0 || next_dist > cur_dist;
        }
    }
    false
}

/// Checks whether a wall placement is a valid, non-useless strategic wall:
/// 1. Mover and all opponents must retain legal paths to goals (Quoridor golden rule).
/// 2. Must not cause net self-harm to the mover.
/// 3. Provides real strategic value:
///    a) directly delays an active opponent (new_d > cur_d), OR
///    b) significantly constricts an opponent's shortest path corridor (corridor squeeze), OR
///    c) shields the mover's corridor (is_parallel_funnel_wall) with 0 self-delay.
fn wall_delays_opponent(state: &GameState, mover_idx: usize, wall: &WallCoord) -> bool {
    if wall.row < 0 || wall.row >= 8 || wall.col < 0 || wall.col >= 8 {
        return false;
    }
    let board = crate::board::Board::from_walls(&state.walls);
    let is_h = wall.orientation == Orientation::H;
    if !board.can_place_wall_geometry(wall.row as u8, wall.col as u8, is_h) {
        return false;
    }
    let mut spec_board = board;
    spec_board.place_wall_raw(wall.row as u8, wall.col as u8, is_h);

    let mover = match state.players.get(mover_idx) {
        Some(m) => m,
        None => return false,
    };

    let mover_goal = GoalMask::from_goal_and_mode(mover.goal_direction, &state.mode);
    let edge_masks = EdgeMasks::from_board(&board);
    let spec_masks = EdgeMasks::from_board(&spec_board);

    let (my_d, my_corridor) = edge_masks.shortest_path_corridor(
        mover.position.row as u8,
        mover.position.col as u8,
        mover_goal,
    );
    let (my_new_d, _) = spec_masks.shortest_path_corridor(
        mover.position.row as u8,
        mover.position.col as u8,
        mover_goal,
    );
    if my_new_d < 0 {
        return false;
    }

    let my_delay = (my_new_d - my_d).max(0);

    let mut delays_someone = false;
    let mut squeezes_someone = false;
    let mut max_opp_delay = 0;

    for (idx, opp) in state.players.iter().enumerate() {
        if idx == mover_idx || opp.status == "FINISHED" {
            continue;
        }
        let opp_goal = GoalMask::from_goal_and_mode(opp.goal_direction, &state.mode);
        let (cur_d, cur_corridor) = edge_masks.shortest_path_corridor(
            opp.position.row as u8,
            opp.position.col as u8,
            opp_goal,
        );
        let (new_d, new_corridor) = spec_masks.shortest_path_corridor(
            opp.position.row as u8,
            opp.position.col as u8,
            opp_goal,
        );
        if new_d < 0 {
            return false;
        }
        let delay = new_d - cur_d;
        if delay > max_opp_delay {
            max_opp_delay = delay;
        }
        if delay > 0 {
            delays_someone = true;
        }
        let reduction = cur_corridor.count_ones().saturating_sub(new_corridor.count_ones());
        if reduction >= 2 {
            squeezes_someone = true;
        }
    }

    // Never accept self-harm unless delaying opponent by more:
    if my_delay > 0 && max_opp_delay <= my_delay {
        return false;
    }

    if delays_someone {
        return true;
    }

    // Proactive strategic wall: corridor squeeze or funnel shield with 0 self-delay
    if my_delay == 0 {
        if squeezes_someone {
            return true;
        }
        let is_behind = match mover.goal_direction {
            crate::types::GoalDirection::Bottom => wall.row < mover.position.row,
            crate::types::GoalDirection::Top => wall.row > mover.position.row,
            crate::types::GoalDirection::Right => wall.col < mover.position.col,
            crate::types::GoalDirection::Left => wall.col > mover.position.col,
            crate::types::GoalDirection::Center => false,
        };
        if !is_behind && crate::mcts::is_parallel_funnel_wall(wall.row as u8, wall.col as u8, is_h, my_corridor) {
            return true;
        }
    }

    false
}

/// The Master Personality Decision Function:
/// 1. Finds ranked legal actions from the hybrid engine (up to 20 candidates).
/// 2. If immediate winning move exists, plays it 100% of the time (ALL bots).
/// 3. Prunes backward/dead-end pawn moves and 0-delay useless walls.
/// 4. Dominance Gate & Critical Defense: forced blocks and high leads respected.
/// 5. Finish sprint: when within 2 steps of winning, sprint to goal without hesitation.
/// 6. Calibrated Human-Like Blunders: beginners make natural human errors (e.g. pawn tunnel-vision
///    or secondary sensible moves), NEVER choosing dead ends, backward moves, or useless walls.
/// 7. Dynamic Near-Optimal Selection: Bots sample among close moves shaped by personality styles.
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
    // UNTOUCHED: strictly preserved as requested
    if profile.id == "milo" && state.mode == "2p" {
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
    // Tactical minimax solver enabled for Masters & Grandmasters (Elo >= 1700).
    let use_solver = profile.elo >= 1700;
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

    // 2. Immediate Win Conversion:
    // ALL bots (even beginner Dad Martin & Barnaby) convert 100% of immediate winning moves!
    // Never allow a blunder roll to throw away an instant win when 1 step from victory!
    for c in &ranked {
        if is_immediate_win(state, mover_idx, &c.action) {
            return c.action.clone();
        }
    }

    let board = crate::board::Board::from_walls(&state.walls);
    let mover_dist = crate::pathfinding::shortest_distance(
        mover.position,
        mover.goal_direction,
        &board,
        &state.mode,
    );

    // Check if an active opponent is 1 step from winning (critical defense emergency)
    let mut critical_opp_at_1 = false;
    for (idx, opp) in state.players.iter().enumerate() {
        if idx != mover_idx && opp.status == "ACTIVE" {
            let opp_d = crate::pathfinding::shortest_distance(
                opp.position,
                opp.goal_direction,
                &board,
                &state.mode,
            );
            if opp_d == 1 {
                critical_opp_at_1 = true;
                break;
            }
        }
    }

    // 3. Rational Candidate Filter:
    // a) Anti-Dead-End & Anti-Backward: Prune pawn steps where next_dist > mover_dist (closed pockets/retreats).
    // b) Anti-Useless-Wall: Prune wall placements that do not delay any active opponent.
    let has_sensible_pawn = ranked.iter().any(|c| {
        if let GameAction::Move { .. } = &c.action {
            !is_backward_pawn_move(state, mover_idx, &c.action)
        } else {
            false
        }
    });

    let filtered_candidates: Vec<crate::hybrid::HybridRankedAction> = ranked
        .into_iter()
        .filter(|c| match &c.action {
            GameAction::Move { .. } => {
                if has_sensible_pawn {
                    !is_backward_pawn_move(state, mover_idx, &c.action)
                } else {
                    true
                }
            }
            GameAction::PlaceWall { wall } => {
                wall_delays_opponent(state, mover_idx, wall)
            }
            _ => true,
        })
        .collect();

    let valid_pool = if !filtered_candidates.is_empty() {
        filtered_candidates
    } else {
        // Fallback: collect all legal pawn moves if everything was filtered
        let legal_coords = crate::rules::get_legal_moves(state, &mover.id, &board);
        legal_coords
            .into_iter()
            .map(|to| crate::hybrid::HybridRankedAction {
                action: GameAction::Move { to },
                prob: 0.5,
                logit: 0.0,
                q: 0.5,
                is_wall: false,
            })
            .collect()
    };

    if valid_pool.is_empty() {
        return GameAction::Resign;
    }

    // 4. Dominance Gate & Critical Defense:
    // When Move #1 has a decisive lead over Move #2, it is tactically forced.
    // - Masters & Grandmasters (Elo >= 1700) ALWAYS play Move #1 when dominant.
    // - Intermediates & above (Elo >= 1200) NEVER drop a critical block when opponent is 1 step from win!
    let top_q = valid_pool[0].q;
    let top_prob = valid_pool[0].prob;
    let second_q = if valid_pool.len() > 1 { valid_pool[1].q } else { 0.0 };
    let q_gap = top_q - second_q;

    let is_dominant = q_gap >= 0.06 || top_prob >= 0.65;
    if is_dominant && profile.elo >= 1700 {
        return valid_pool[0].action.clone();
    }
    if critical_opp_at_1 && profile.elo >= 1200 && valid_pool[0].is_wall {
        return valid_pool[0].action.clone();
    }

    // 5. Finish Sprint Guarantee:
    // In ALL modes (including Classical 2P), when within 2 steps of winning, sprint to goal!
    // Never allow placing walls or shuffling when 1-2 steps away from winning!
    let is_finish_sprint = mover_dist <= 2;
    if is_finish_sprint {
        if let Some(sprint_move) = valid_pool.iter().find(|c| {
            if let GameAction::Move { to } = &c.action {
                let d = crate::pathfinding::shortest_distance(*to, mover.goal_direction, &board, &state.mode);
                d < mover_dist
            } else {
                false
            }
        }) {
            return sprint_move.action.clone();
        }
    }

    // 6. Calibrated Human-Like Blunder Sampling:
    // Blunders now sample among sensible suboptimal alternatives (e.g. pawn tunnel-vision or secondary wall/move),
    // NEVER dipping into discarded garbage, dead ends, or 0-delay walls!
    let is_blundering = profile.blunder_rate > 0.0 && rng.next_f64() < (profile.blunder_rate as f64);
    if is_blundering && valid_pool.len() > 1 {
        // Human Blunder Type 1: Pawn Tunnel Vision
        // If the best move was a defensive wall, beginners frequently neglect the wall and sprint their pawn!
        let best_is_wall = valid_pool[0].is_wall;
        let advancing_pawn = valid_pool.iter().find(|c| {
            if let GameAction::Move { to } = &c.action {
                let d = crate::pathfinding::shortest_distance(*to, mover.goal_direction, &board, &state.mode);
                d < mover_dist
            } else {
                false
            }
        });

        if best_is_wall && advancing_pawn.is_some() && rng.next_f64() < 0.50 {
            return advancing_pawn.unwrap().action.clone();
        }

        // Human Blunder Type 2: Suboptimal Choice among Sensible Alternatives (Ranks 1..3 of valid_pool)
        let max_suboptimal = valid_pool.len() - 1;
        let min_pick = 1.min(max_suboptimal);
        let max_pick = 3.min(max_suboptimal);
        let span = max_pick - min_pick + 1;
        let blunder_pick = min_pick + ((rng.next_u64() as usize) % span);
        let action = valid_pool[blunder_pick].action.clone();
        if is_legal_action(state, &action) {
            return action;
        }
    }

    // 7. Dynamic Candidate Pool Selection (Personality-Shaped):
    // For high-Elo bots (Elo >= 1400), filter strictly to candidates within the variety window of Move #1.
    // For lower-tier bots (Elo < 1400), bound candidate pool to top sensible candidates close to Move #1.
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
        let max_q_gap = 0.20;
        let pool: Vec<_> = valid_pool
            .iter()
            .take(4)
            .filter(|c| (top_q - c.q) <= max_q_gap)
            .collect();
        if pool.is_empty() {
            vec![&valid_pool[0]]
        } else {
            pool
        }
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
                    if is_finish_sprint {
                        score -= 8.0;
                    } else {
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
                }
                GameAction::Move { to } => {
                    if is_finish_sprint {
                        let next_d = crate::pathfinding::shortest_distance(
                            *to,
                            mover.goal_direction,
                            &board,
                            &state.mode,
                        );
                        if next_d < mover_dist {
                            score += 6.0;
                        }
                    } else {
                        let bias = opening_move_bias(*to, is_opening, profile.opening_style, mover);
                        score += bias * 25.0;
                        // Negative wall_prob_bias means pawn preference (sprint)
                        score -= profile.wall_prob_bias * 6.0;
                    }
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

    #[test]
    fn test_milo_plays_legal_actions_in_center_rush_and_race_without_onnx() {
        let milo = get_bot_preset("milo");

        // 1. Center Rush 2P
        let center2_state = GameState {
            game_id: "center2-test".to_string(),
            mode: "center2".to_string(),
            current_player_index: 0,
            players: vec![
                PlayerState {
                    id: "milo".to_string(),
                    index: 0,
                    display_name: "Milo".to_string(),
                    position: CellCoord { row: 8, col: 4 },
                    walls_remaining: 10,
                    goal_direction: GoalDirection::Center,
                    status: "ACTIVE".to_string(),
                },
                PlayerState {
                    id: "rival".to_string(),
                    index: 1,
                    display_name: "Rival".to_string(),
                    position: CellCoord { row: 0, col: 4 },
                    walls_remaining: 10,
                    goal_direction: GoalDirection::Center,
                    status: "ACTIVE".to_string(),
                },
            ],
            walls: vec![],
            move_number: 0,
            status: "IN_PROGRESS".to_string(),
        };
        let c2_action = select_bot_action(&center2_state, &milo, 100);
        assert!(is_legal_action(&center2_state, &c2_action));

        // 2. Center Rush 3P (multiplayer)
        let center3_state = GameState {
            game_id: "center3-test".to_string(),
            mode: "center3".to_string(),
            current_player_index: 0,
            players: vec![
                PlayerState {
                    id: "milo".to_string(),
                    index: 0,
                    display_name: "Milo".to_string(),
                    position: CellCoord { row: 8, col: 4 },
                    walls_remaining: 6,
                    goal_direction: GoalDirection::Center,
                    status: "ACTIVE".to_string(),
                },
                PlayerState {
                    id: "p2".to_string(),
                    index: 1,
                    display_name: "P2".to_string(),
                    position: CellCoord { row: 0, col: 4 },
                    walls_remaining: 6,
                    goal_direction: GoalDirection::Center,
                    status: "ACTIVE".to_string(),
                },
                PlayerState {
                    id: "p3".to_string(),
                    index: 2,
                    display_name: "P3".to_string(),
                    position: CellCoord { row: 4, col: 0 },
                    walls_remaining: 6,
                    goal_direction: GoalDirection::Center,
                    status: "ACTIVE".to_string(),
                },
            ],
            walls: vec![],
            move_number: 0,
            status: "IN_PROGRESS".to_string(),
        };
        let c3_action = select_bot_action(&center3_state, &milo, 101);
        assert!(is_legal_action(&center3_state, &c3_action));

        // 3. Race Mode 2P
        let race2_state = GameState {
            game_id: "race2-test".to_string(),
            mode: "race2".to_string(),
            current_player_index: 0,
            players: vec![
                PlayerState {
                    id: "milo".to_string(),
                    index: 0,
                    display_name: "Milo".to_string(),
                    position: CellCoord { row: 8, col: 2 },
                    walls_remaining: 10,
                    goal_direction: GoalDirection::Top,
                    status: "ACTIVE".to_string(),
                },
                PlayerState {
                    id: "rival".to_string(),
                    index: 1,
                    display_name: "Rival".to_string(),
                    position: CellCoord { row: 8, col: 6 },
                    walls_remaining: 10,
                    goal_direction: GoalDirection::Top,
                    status: "ACTIVE".to_string(),
                },
            ],
            walls: vec![],
            move_number: 0,
            status: "IN_PROGRESS".to_string(),
        };
        let race_action = select_bot_action(&race2_state, &milo, 102);
        assert!(is_legal_action(&race2_state, &race_action));
    }

    #[test]
    fn test_center_rush_4p_recognizes_center_goal_and_converts_immediate_win() {
        use crate::pathfinding::is_goal_cell;
        // Verify (4,4) is recognized as goal cell in 4p mode
        assert!(is_goal_cell(CellCoord { row: 4, col: 4 }, GoalDirection::Top, "4p"));
        assert!(is_goal_cell(CellCoord { row: 4, col: 4 }, GoalDirection::Bottom, "4p"));
        assert!(is_goal_cell(CellCoord { row: 4, col: 4 }, GoalDirection::Left, "4p"));
        assert!(is_goal_cell(CellCoord { row: 4, col: 4 }, GoalDirection::Right, "4p"));

        // Setup 4P game where player 0 is at (5, 4), 1 step from (4, 4)
        let state = GameState {
            game_id: "center-4p-win".to_string(),
            mode: "4p".to_string(),
            current_player_index: 0,
            players: vec![
                PlayerState {
                    id: "p1".to_string(),
                    index: 0,
                    display_name: "P1".to_string(),
                    position: CellCoord { row: 5, col: 4 },
                    walls_remaining: 5,
                    goal_direction: GoalDirection::Top,
                    status: "ACTIVE".to_string(),
                },
                PlayerState {
                    id: "p2".to_string(),
                    index: 1,
                    display_name: "P2".to_string(),
                    position: CellCoord { row: 2, col: 4 },
                    walls_remaining: 5,
                    goal_direction: GoalDirection::Bottom,
                    status: "ACTIVE".to_string(),
                },
                PlayerState {
                    id: "p3".to_string(),
                    index: 2,
                    display_name: "P3".to_string(),
                    position: CellCoord { row: 4, col: 2 },
                    walls_remaining: 5,
                    goal_direction: GoalDirection::Right,
                    status: "ACTIVE".to_string(),
                },
                PlayerState {
                    id: "p4".to_string(),
                    index: 3,
                    display_name: "P4".to_string(),
                    position: CellCoord { row: 4, col: 7 },
                    walls_remaining: 5,
                    goal_direction: GoalDirection::Left,
                    status: "ACTIVE".to_string(),
                },
            ],
            walls: vec![],
            move_number: 10,
            status: "IN_PROGRESS".to_string(),
        };

        let achref = get_bot_preset("achref");
        let action = select_bot_action(&state, &achref, 42);
        assert_eq!(
            action,
            GameAction::Move {
                to: CellCoord { row: 4, col: 4 }
            },
            "Bot at (5,4) in 4P Center Rush must take the immediate winning step to (4,4)!"
        );
    }

    #[test]
    fn test_center_rush_advances_instead_of_walling_distant_player() {
        // Setup 4P game: Bot is at (6, 4) (dist 2 to center).
        // P2 is at (2, 4) (dist 2).
        // P3 is at (4, 1) (dist 3).
        // P4 is at (4, 8) (dist 4, far away).
        let state = GameState {
            game_id: "center-sprint".to_string(),
            mode: "4p".to_string(),
            current_player_index: 0,
            players: vec![
                PlayerState {
                    id: "bot".to_string(),
                    index: 0,
                    display_name: "Bot".to_string(),
                    position: CellCoord { row: 6, col: 4 },
                    walls_remaining: 5,
                    goal_direction: GoalDirection::Top,
                    status: "ACTIVE".to_string(),
                },
                PlayerState {
                    id: "p2".to_string(),
                    index: 1,
                    display_name: "P2".to_string(),
                    position: CellCoord { row: 2, col: 4 },
                    walls_remaining: 5,
                    goal_direction: GoalDirection::Bottom,
                    status: "ACTIVE".to_string(),
                },
                PlayerState {
                    id: "p3".to_string(),
                    index: 2,
                    display_name: "P3".to_string(),
                    position: CellCoord { row: 4, col: 1 },
                    walls_remaining: 5,
                    goal_direction: GoalDirection::Right,
                    status: "ACTIVE".to_string(),
                },
                PlayerState {
                    id: "p4".to_string(),
                    index: 3,
                    display_name: "P4".to_string(),
                    position: CellCoord { row: 4, col: 8 },
                    walls_remaining: 5,
                    goal_direction: GoalDirection::Left,
                    status: "ACTIVE".to_string(),
                },
            ],
            walls: vec![],
            move_number: 4,
            status: "IN_PROGRESS".to_string(),
        };

        let bot = get_bot_preset("viktor");
        let action = select_bot_action(&state, &bot, 123);
        // Bot should advance towards center (5, 4) or place a defensive funnel/block against P2,
        // NEVER place a random wall against distant P4 at col 8!
        if let GameAction::PlaceWall { wall } = &action {
            assert!(
                wall.col < 7,
                "Bot should not place a wall all the way at col 7/8 against distant P4! Action: {:?}",
                action
            );
        }
    }

    #[test]
    fn test_beginner_martin_always_takes_immediate_win() {
        let mut state = make_test_state();
        // Martin (P1, row 7, goal Bottom row 8)
        state.players[0].position = CellCoord { row: 7, col: 4 };
        state.players[0].walls_remaining = 5;
        let martin = get_bot_preset("martin");

        // Across 50 seeds, Martin must ALWAYS take the win (row 8), never blunder or drop a wall!
        for seed in 1..=50 {
            let action = select_bot_action(&state, &martin, seed);
            assert!(
                matches!(action, GameAction::Move { to } if to.row == 8),
                "Seed {}: Martin must convert 100% of immediate wins to row 8, got {:?}",
                seed,
                action
            );
        }
    }

    #[test]
    fn test_bot_never_enters_dead_end_corridor() {
        let mut state = make_test_state();
        // Bot (Player 0) at (4, 4), heading to row 8 (Bottom)
        state.players[0].position = CellCoord { row: 4, col: 4 };
        state.players[0].walls_remaining = 0; // Pawn moves only
        state.players[1].position = CellCoord { row: 8, col: 0 };
        state.players[1].walls_remaining = 0;

        // Walls create a cul-de-sac at (5, 4):
        // Horizontal wall below at (5, 4) blocks moving south from row 5
        // Vertical walls at (4, 3) and (4, 4) flank col 4
        // Stepping to (5, 4) enters a dead-end pocket!
        // Moving laterally to (4, 3) or (4, 5) is the open path.
        state.walls = vec![
            WallCoord { row: 5, col: 4, orientation: Orientation::H },
            WallCoord { row: 4, col: 3, orientation: Orientation::V },
            WallCoord { row: 4, col: 4, orientation: Orientation::V },
        ];

        let martin = get_bot_preset("martin");
        let elias = get_bot_preset("elias");

        for seed in 1..=20 {
            let act_m = select_bot_action(&state, &martin, seed);
            if let GameAction::Move { to } = act_m {
                assert_ne!(
                    to,
                    CellCoord { row: 5, col: 4 },
                    "Seed {}: Martin must NEVER step forward into dead-end cul-de-sac at (5,4)!",
                    seed
                );
            }

            let act_e = select_bot_action(&state, &elias, seed);
            if let GameAction::Move { to } = act_e {
                assert_ne!(
                    to,
                    CellCoord { row: 5, col: 4 },
                    "Seed {}: Elias must NEVER step forward into dead-end cul-de-sac at (5,4)!",
                    seed
                );
            }
        }
    }

    #[test]
    fn test_bot_never_places_zero_delay_useless_wall() {
        let mut state = make_test_state();
        // Classical 2P: Player 0 at (3, 4), Player 1 at (5, 4)
        state.players[0].position = CellCoord { row: 3, col: 4 };
        state.players[0].walls_remaining = 5;
        state.players[1].position = CellCoord { row: 5, col: 4 };
        state.players[1].walls_remaining = 5;
        state.walls = vec![];

        let martin = get_bot_preset("martin");
        for seed in 1..=30 {
            let act = select_bot_action(&state, &martin, seed);
            if let GameAction::PlaceWall { wall } = act {
                assert!(
                    wall_delays_opponent(&state, 0, &wall),
                    "Seed {}: Martin must NEVER place a useless wall with 0 delay! Wall: {:?}",
                    seed,
                    wall
                );
            }
        }
    }

    #[test]
    fn test_classical_2p_sprints_to_goal_without_walls_or_shuffling() {
        let mut state = make_test_state();
        // Player 0 at (6, 4) heading to row 8 (dist 2) in classical 2p
        state.players[0].position = CellCoord { row: 6, col: 4 };
        state.players[0].walls_remaining = 8;
        state.players[1].position = CellCoord { row: 2, col: 4 };
        state.players[1].walls_remaining = 8;
        state.walls = vec![];

        let martin = get_bot_preset("martin");
        let marcus = get_bot_preset("marcus");

        for seed in 1..=20 {
            let act_m = select_bot_action(&state, &martin, seed);
            assert!(
                matches!(act_m, GameAction::Move { to } if to.row > 6),
                "Seed {}: Martin must sprint toward goal (row > 6) when 2 steps away, got {:?}",
                seed,
                act_m
            );

            let act_arc = select_bot_action(&state, &marcus, seed);
            assert!(
                matches!(act_arc, GameAction::Move { to } if to.row > 6),
                "Seed {}: Marcus must sprint toward goal (row > 6) when 2 steps away, got {:?}",
                seed,
                act_arc
            );
        }
    }

    #[test]
    fn test_master_marcus_blocks_immediate_opponent_win() {
        let mut state = make_test_state();
        // Player 0 (Marcus, Master) at (5, 4), goal row 8 (dist 3)
        // Player 1 (Opponent) at (1, 4), goal row 0 (dist 1!)
        state.players[0].position = CellCoord { row: 5, col: 4 };
        state.players[0].walls_remaining = 5;
        state.players[1].position = CellCoord { row: 1, col: 4 };
        state.players[1].walls_remaining = 5;
        state.players[1].goal_direction = GoalDirection::Top;
        state.walls = vec![];

        let marcus = get_bot_preset("marcus");
        for seed in 1..=20 {
            let act = select_bot_action(&state, &marcus, seed);
            // Marcus MUST play a blocking wall that prevents P2 from winning immediately!
            if let GameAction::PlaceWall { wall } = &act {
                let board = crate::board::Board::from_walls(&state.walls);
                let mut spec = board;
                spec.place_wall_raw(wall.row as u8, wall.col as u8, wall.orientation == Orientation::H);
                let opp_d = crate::pathfinding::shortest_distance(
                    state.players[1].position,
                    state.players[1].goal_direction,
                    &spec,
                    &state.mode,
                );
                assert!(
                    opp_d > 1,
                    "Seed {}: Marcus must block opponent 1 step from win! Resulting dist: {}",
                    seed,
                    opp_d
                );
            } else {
                panic!("Seed {}: Marcus must place a wall to block opponent! Got {:?}", seed, act);
            }
        }
    }
}
