#![deny(clippy::all)]

pub mod board;
pub mod classifier;
pub mod evaluation;
pub mod mcts;
pub mod pathfinding;
pub mod review;
pub mod rules;
pub mod types;

use napi_derive::napi;
use crate::types::{GameState, RecordedAction};

#[napi]
pub fn analyze_game_sync(initial_state_json: String, history_json: String) -> napi::Result<String> {
    let initial_state: GameState = serde_json::from_str(&initial_state_json)
        .map_err(|e| napi::Error::from_reason(format!("Failed to parse initialState: {}", e)))?;
    let history: Vec<RecordedAction> = serde_json::from_str(&history_json)
        .map_err(|e| napi::Error::from_reason(format!("Failed to parse history: {}", e)))?;

    let review = review::analyze_game_internal(initial_state, history);
    serde_json::to_string(&review)
        .map_err(|e| napi::Error::from_reason(format!("Failed to serialize review: {}", e)))
}

#[napi]
pub async fn analyze_game_async(initial_state_json: String, history_json: String) -> napi::Result<String> {
    analyze_game_sync(initial_state_json, history_json)
}
