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

/// Standard C ABI export for Android JNI and iOS Swift/Objective-C.
#[no_mangle]
pub unsafe extern "C" fn duoorb_ai_find_best_action(
    state_json_ptr: *const std::os::raw::c_char,
    simulations: u32,
    threads: u32,
    seed: i64,
) -> *mut std::os::raw::c_char {
    if state_json_ptr.is_null() {
        return std::ptr::null_mut();
    }
    let c_str = std::ffi::CStr::from_ptr(state_json_ptr);
    let str_slice = match c_str.to_str() {
        Ok(s) => s,
        Err(_) => return std::ptr::null_mut(),
    };
    let state: GameState = match serde_json::from_str(str_slice) {
        Ok(s) => s,
        Err(_) => return std::ptr::null_mut(),
    };
    let s = if seed != 0 {
        seed as u64
    } else {
        mcts::position_seed(&state, 0)
    };
    let action_opt =
        mcts::find_best_action_multithreaded(&state, simulations as usize, threads as usize, s);
    let result_json = match action_opt {
        Some(a) => serde_json::to_string(&a).unwrap_or_else(|_| "null".to_string()),
        None => "null".to_string(),
    };
    std::ffi::CString::new(result_json)
        .map(|cs| cs.into_raw())
        .unwrap_or(std::ptr::null_mut())
}

/// Free string allocated by duoorb_ai_find_best_action.
#[no_mangle]
pub unsafe extern "C" fn duoorb_ai_free_string(ptr: *mut std::os::raw::c_char) {
    if !ptr.is_null() {
        let _ = std::ffi::CString::from_raw(ptr);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::ffi::{CStr, CString};

    #[test]
    fn c_abi_handles_null_pointer_gracefully() {
        unsafe {
            let res = duoorb_ai_find_best_action(std::ptr::null(), 1000, 2, 0);
            assert!(res.is_null());
            duoorb_ai_free_string(std::ptr::null_mut());
        }
    }

    #[test]
    fn c_abi_handles_invalid_json_gracefully() {
        unsafe {
            let invalid = CString::new("this is not valid json").unwrap();
            let res = duoorb_ai_find_best_action(invalid.as_ptr(), 1000, 2, 0);
            assert!(res.is_null());
        }
    }

    #[test]
    fn c_abi_executes_valid_game_state_and_frees_safely() {
        let state_json = r#"{
            "gameId": "test_game",
            "mode": "2p",
            "currentPlayerIndex": 0,
            "players": [
                {
                    "id": "p1",
                    "index": 0,
                    "displayName": "P1",
                    "position": {"row": 7, "col": 4},
                    "wallsRemaining": 10,
                    "goalDirection": "BOTTOM",
                    "status": "ACTIVE"
                },
                {
                    "id": "p2",
                    "index": 1,
                    "displayName": "P2",
                    "position": {"row": 1, "col": 4},
                    "wallsRemaining": 10,
                    "goalDirection": "TOP",
                    "status": "ACTIVE"
                }
            ],
            "walls": [],
            "status": "IN_PROGRESS"
        }"#;

        unsafe {
            let c_json = CString::new(state_json).unwrap();
            let res_ptr = duoorb_ai_find_best_action(c_json.as_ptr(), 2000, 4, 12345);
            assert!(!res_ptr.is_null());
            let res_str = CStr::from_ptr(res_ptr).to_str().unwrap();
            assert!(res_str.contains("MOVE") || res_str.contains("PLACE_WALL"));
            duoorb_ai_free_string(res_ptr);
        }
    }
}


