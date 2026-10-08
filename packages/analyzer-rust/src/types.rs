use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct CellCoord {
    pub row: i8,
    pub col: i8,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Orientation {
    #[serde(rename = "H")]
    H,
    #[serde(rename = "V")]
    V,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct WallCoord {
    pub row: i8,
    pub col: i8,
    pub orientation: Orientation,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum GameAction {
    #[serde(rename = "MOVE")]
    Move { to: CellCoord },
    #[serde(rename = "PLACE_WALL")]
    PlaceWall { wall: WallCoord },
    #[serde(rename = "RESIGN")]
    Resign,
    #[serde(rename = "TIMEOUT")]
    Timeout,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordedAction {
    #[serde(alias = "sequence", default)]
    pub ply: i32,
    #[serde(alias = "playerId", default)]
    pub player: String,
    pub action: GameAction,
    #[serde(default)]
    pub timestamp: Option<i64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum GoalDirection {
    #[serde(rename = "TOP")]
    Top,
    #[serde(rename = "BOTTOM")]
    Bottom,
    #[serde(rename = "LEFT")]
    Left,
    #[serde(rename = "RIGHT")]
    Right,
    #[serde(rename = "CENTER")]
    Center,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerState {
    pub id: String,
    #[serde(default)]
    pub index: usize,
    #[serde(rename = "displayName", default)]
    pub display_name: String,
    pub position: CellCoord,
    #[serde(rename = "wallsRemaining", default)]
    pub walls_remaining: i32,
    #[serde(rename = "goalDirection")]
    pub goal_direction: GoalDirection,
    #[serde(default)]
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameState {
    #[serde(rename = "gameId", default)]
    pub game_id: String,
    #[serde(default)]
    pub mode: String,
    #[serde(rename = "currentPlayerIndex", default)]
    pub current_player_index: usize,
    #[serde(default)]
    pub players: Vec<PlayerState>,
    #[serde(default)]
    pub walls: Vec<WallCoord>,
    #[serde(default)]
    pub status: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum MoveAssessment {
    Best,
    Excellent,
    Good,
    Inaccuracy,
    Mistake,
    Blunder,
    Forced,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlternativeAction {
    pub action: GameAction,
    pub evaluation: f64,
    #[serde(rename = "evaluationLoss")]
    pub evaluation_loss: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoveAnalysis {
    pub step: usize,
    #[serde(rename = "playerIndex")]
    pub player_index: usize,
    #[serde(rename = "playerId")]
    pub player_id: String,
    pub action: GameAction,
    pub assessment: MoveAssessment,
    pub evaluation: f64,
    #[serde(rename = "evaluationLoss")]
    pub evaluation_loss: f64,
    #[serde(rename = "winChance")]
    pub win_chance: f64,
    #[serde(rename = "winChanceDelta")]
    pub win_chance_delta: f64,
    pub forced: bool,
    #[serde(rename = "bestAction", skip_serializing_if = "Option::is_none")]
    pub best_action: Option<GameAction>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub explanation: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyLesson {
    pub title: String,
    pub detail: String,
    #[serde(rename = "moveNumber", skip_serializing_if = "Option::is_none")]
    pub move_number: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReviewSummary {
    #[serde(rename = "keyLesson")]
    pub key_lesson: KeyLesson,
    pub confidence: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameReview {
    #[serde(rename = "gameId")]
    pub game_id: String,
    pub mode: String,
    #[serde(rename = "totalMoves")]
    pub total_moves: usize,
    pub accuracies: std::collections::HashMap<String, f64>,
    #[serde(rename = "moveAnalyses")]
    pub move_analyses: Vec<MoveAnalysis>,
    #[serde(rename = "criticalMoments")]
    pub critical_moments: Vec<usize>,
    pub summary: ReviewSummary,
    #[serde(rename = "engineVersion")]
    pub engine_version: String,
    #[serde(rename = "analysisVersion")]
    pub analysis_version: String,
}
