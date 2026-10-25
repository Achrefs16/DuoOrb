#![deny(clippy::all)]

pub mod board;
pub mod classifier;
pub mod evaluation;
pub mod mcts;
pub mod pathfinding;
pub mod review;
pub mod rules;
pub mod types;

use crate::types::{GameState, RecordedAction};
use napi_derive::napi;

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
pub async fn analyze_game_async(
    initial_state_json: String,
    history_json: String,
) -> napi::Result<String> {
    analyze_game_sync(initial_state_json, history_json)
}

#[napi]
pub fn get_best_action_sync(
    state_json: String,
    simulations: u32,
    threads: Option<u32>,
    seed: Option<i64>,
) -> napi::Result<String> {
    let state: GameState = serde_json::from_str(&state_json)
        .map_err(|e| napi::Error::from_reason(format!("Failed to parse state: {}", e)))?;
    let sims = (simulations as usize).max(100);
    let thread_count = threads.unwrap_or(4) as usize;
    let s = seed.map(|x| x as u64).unwrap_or_else(|| mcts::position_seed(&state, 0));

    match mcts::find_best_action_multithreaded(&state, sims, thread_count, s) {
        Some(action) => serde_json::to_string(&action)
            .map_err(|e| napi::Error::from_reason(format!("Failed to serialize action: {}", e))),
        None => Ok("null".to_string()),
    }
}

#[napi]
pub async fn get_best_action_async(
    state_json: String,
    simulations: u32,
    threads: Option<u32>,
    seed: Option<i64>,
) -> napi::Result<String> {
    get_best_action_sync(state_json, simulations, threads, seed)
}

