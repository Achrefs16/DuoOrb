#![deny(clippy::all)]

pub mod adapter;
pub mod alphazero;
pub mod board;
pub mod classifier;
pub mod evaluation;
pub mod hints;
pub mod hybrid;
pub mod mcts;
pub mod neural;
pub mod pathfinding;
pub mod personality;
pub mod review;
pub mod rules;
pub mod solver;
pub mod types;

use crate::types::{GameState, RecordedAction};

#[cfg(not(any(target_arch = "wasm32", target_os = "android", target_os = "ios")))]
use napi_derive::napi;

#[cfg(not(any(target_arch = "wasm32", target_os = "android", target_os = "ios")))]
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

#[cfg(not(any(target_arch = "wasm32", target_os = "android", target_os = "ios")))]
#[napi]
pub async fn analyze_game_async(
    initial_state_json: String,
    history_json: String,
) -> napi::Result<String> {
    analyze_game_sync(initial_state_json, history_json)
}

#[cfg(not(any(target_arch = "wasm32", target_os = "android", target_os = "ios")))]
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

    let hybrid_result = hybrid::find_hybrid_action(&state, sims, thread_count, s);
    serde_json::to_string(&hybrid_result.action)
        .map_err(|e| napi::Error::from_reason(format!("Failed to serialize action: {}", e)))
}

#[cfg(not(any(target_arch = "wasm32", target_os = "android", target_os = "ios")))]
#[napi]
pub async fn get_best_action_async(
    state_json: String,
    simulations: u32,
    threads: Option<u32>,
    seed: Option<i64>,
) -> napi::Result<String> {
    get_best_action_sync(state_json, simulations, threads, seed)
}

/// Return the top root actions with aggregate visits/Q. The mobile hard-bot
/// layer uses this to apply personality choices without throwing away the
/// native search's evaluation of the alternatives.
#[cfg(not(any(target_arch = "wasm32", target_os = "android", target_os = "ios")))]
#[napi]
pub fn get_ranked_actions_sync(
    state_json: String,
    simulations: u32,
    threads: Option<u32>,
    seed: Option<i64>,
    top_k: Option<u32>,
) -> napi::Result<String> {
    let state: GameState = serde_json::from_str(&state_json)
        .map_err(|e| napi::Error::from_reason(format!("Failed to parse state: {}", e)))?;
    let sims = (simulations as usize).max(100);
    let thread_count = threads.unwrap_or(4) as usize;
    let s = seed.map(|x| x as u64).unwrap_or_else(|| mcts::position_seed(&state, 0));
    let limit = top_k.unwrap_or(12).max(1) as usize;

    let ranked = mcts::find_ranked_actions_multithreaded(&state, sims, thread_count, s);
    let output: Vec<serde_json::Value> = ranked
        .into_iter()
        .take(limit)
        .map(|candidate| {
            serde_json::json!({
                "action": candidate.action,
                "visits": candidate.visits,
                "q": candidate.q,
            })
        })
        .collect();

    serde_json::to_string(&output)
        .map_err(|e| napi::Error::from_reason(format!("Failed to serialize ranked actions: {}", e)))
}

#[cfg(not(any(target_arch = "wasm32", target_os = "android", target_os = "ios")))]
#[napi]
pub async fn get_ranked_actions_async(
    state_json: String,
    simulations: u32,
    threads: Option<u32>,
    seed: Option<i64>,
    top_k: Option<u32>,
) -> napi::Result<String> {
    get_ranked_actions_sync(state_json, simulations, threads, seed, top_k)
}

#[cfg(not(any(target_arch = "wasm32", target_os = "android", target_os = "ios")))]
#[napi]
pub fn get_bot_action_sync(
    state_json: String,
    bot_id: Option<String>,
    profile_json: Option<String>,
    seed: Option<i64>,
) -> napi::Result<String> {
    let state: GameState = serde_json::from_str(&state_json)
        .map_err(|e| napi::Error::from_reason(format!("Failed to parse state: {}", e)))?;

    let profile = if let Some(ref pj) = profile_json {
        serde_json::from_str::<personality::BotPersonalityConfig>(pj)
            .unwrap_or_else(|_| personality::get_bot_preset(bot_id.as_deref().unwrap_or("achref")))
    } else {
        personality::get_bot_preset(bot_id.as_deref().unwrap_or("achref"))
    };

    let s = seed.map(|x| x as u64).unwrap_or_else(|| mcts::position_seed(&state, 0));
    let action = personality::select_bot_action(&state, &profile, s);

    serde_json::to_string(&action)
        .map_err(|e| napi::Error::from_reason(format!("Failed to serialize bot action: {}", e)))
}

#[cfg(not(any(target_arch = "wasm32", target_os = "android", target_os = "ios")))]
#[napi]
pub async fn get_bot_action_async(
    state_json: String,
    bot_id: Option<String>,
    profile_json: Option<String>,
    seed: Option<i64>,
) -> napi::Result<String> {
    get_bot_action_sync(state_json, bot_id, profile_json, seed)
}

#[cfg(not(any(target_arch = "wasm32", target_os = "android", target_os = "ios")))]
#[napi]
pub fn get_hint_sync(state_json: String) -> napi::Result<String> {
    let state: GameState = serde_json::from_str(&state_json)
        .map_err(|e| napi::Error::from_reason(format!("Failed to parse state: {}", e)))?;

    let hint = hints::get_grandmaster_hint(&state);
    serde_json::to_string(&hint)
        .map_err(|e| napi::Error::from_reason(format!("Failed to serialize hint: {}", e)))
}

#[cfg(not(any(target_arch = "wasm32", target_os = "android", target_os = "ios")))]
#[napi]
pub async fn get_hint_async(state_json: String) -> napi::Result<String> {
    get_hint_sync(state_json)
}

/// Standard C ABI export for Android JNI and iOS Swift/Objective-C.
#[no_mangle]
pub unsafe extern "C" fn duoorb_ai_find_best_action(
    state_json_ptr: *const std::os::raw::c_char,
    simulations: u32,
    threads: u32,
    seed: i64,
) -> *mut std::os::raw::c_char {
    std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
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
        let hybrid_result = hybrid::find_hybrid_action(&state, simulations as usize, threads as usize, s);
        let result_json = serde_json::to_string(&hybrid_result.action).unwrap_or_else(|_| "null".to_string());
        std::ffi::CString::new(result_json)
            .map(|cs| cs.into_raw())
            .unwrap_or(std::ptr::null_mut())
    }))
    .unwrap_or(std::ptr::null_mut())
}

/// Standard C ABI export for ranked root actions (Android personality layer).
#[no_mangle]
pub unsafe extern "C" fn duoorb_ai_find_ranked_actions(
    state_json_ptr: *const std::os::raw::c_char,
    simulations: u32,
    threads: u32,
    seed: i64,
    top_k: u32,
) -> *mut std::os::raw::c_char {
    std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
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
        let ranked = mcts::find_ranked_actions_multithreaded(
            &state,
            simulations as usize,
            threads as usize,
            s,
        );
        let limit = (top_k.max(1)) as usize;
        let output: Vec<serde_json::Value> = ranked
            .into_iter()
            .take(limit)
            .map(|candidate| {
                serde_json::json!({
                    "action": candidate.action,
                    "visits": candidate.visits,
                    "q": candidate.q,
                })
            })
            .collect();
        let result_json = serde_json::to_string(&output).unwrap_or_else(|_| "[]".to_string());
        std::ffi::CString::new(result_json)
            .map(|cs| cs.into_raw())
            .unwrap_or(std::ptr::null_mut())
    }))
    .unwrap_or(std::ptr::null_mut())
}

/// Standard C ABI export for bot personality action selection.
#[no_mangle]
pub unsafe extern "C" fn duoorb_ai_get_bot_action(
    state_json_ptr: *const std::os::raw::c_char,
    bot_id_ptr: *const std::os::raw::c_char,
    seed: i64,
) -> *mut std::os::raw::c_char {
    std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
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
        let bot_id = if !bot_id_ptr.is_null() {
            std::ffi::CStr::from_ptr(bot_id_ptr)
                .to_str()
                .unwrap_or("achref")
        } else {
            "achref"
        };
        let profile = personality::get_bot_preset(bot_id);
        let s = if seed != 0 {
            seed as u64
        } else {
            mcts::position_seed(&state, 0)
        };
        let action = personality::select_bot_action(&state, &profile, s);
        let result_json = serde_json::to_string(&action).unwrap_or_else(|_| "null".to_string());
        std::ffi::CString::new(result_json)
            .map(|cs| cs.into_raw())
            .unwrap_or(std::ptr::null_mut())
    }))
    .unwrap_or(std::ptr::null_mut())
}

/// Standard C ABI export for Grandmaster Oracle hints.
#[no_mangle]
pub unsafe extern "C" fn duoorb_ai_get_hint(
    state_json_ptr: *const std::os::raw::c_char,
) -> *mut std::os::raw::c_char {
    std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
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
        let hint = hints::get_grandmaster_hint(&state);
        let result_json = serde_json::to_string(&hint).unwrap_or_else(|_| "null".to_string());
        std::ffi::CString::new(result_json)
            .map(|cs| cs.into_raw())
            .unwrap_or(std::ptr::null_mut())
    }))
    .unwrap_or(std::ptr::null_mut())
}

/// Standard C ABI export for offline match analysis.
#[no_mangle]
pub unsafe extern "C" fn duoorb_ai_analyze_game(
    initial_state_json_ptr: *const std::os::raw::c_char,
    history_json_ptr: *const std::os::raw::c_char,
) -> *mut std::os::raw::c_char {
    std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        if initial_state_json_ptr.is_null() || history_json_ptr.is_null() {
            return std::ptr::null_mut();
        }
        let init_str = match std::ffi::CStr::from_ptr(initial_state_json_ptr).to_str() {
            Ok(s) => s,
            Err(_) => return std::ptr::null_mut(),
        };
        let hist_str = match std::ffi::CStr::from_ptr(history_json_ptr).to_str() {
            Ok(s) => s,
            Err(_) => return std::ptr::null_mut(),
        };
        let initial_state: GameState = match serde_json::from_str(init_str) {
            Ok(s) => s,
            Err(_) => return std::ptr::null_mut(),
        };
        let history: Vec<RecordedAction> = match serde_json::from_str(hist_str) {
            Ok(h) => h,
            Err(_) => return std::ptr::null_mut(),
        };
        let review = review::analyze_game_internal(initial_state, history);
        let result_json = serde_json::to_string(&review).unwrap_or_else(|_| "{}".to_string());
        std::ffi::CString::new(result_json)
            .map(|cs| cs.into_raw())
            .unwrap_or(std::ptr::null_mut())
    }))
    .unwrap_or(std::ptr::null_mut())
}

/// Check if the ONNX neural evaluator is loaded and ready (returns 1 if loaded, 0 otherwise).
#[no_mangle]
pub unsafe extern "C" fn duoorb_ai_is_neural_loaded() -> i32 {
    std::panic::catch_unwind(|| {
        if hybrid::get_global_evaluator().is_some() {
            1
        } else {
            0
        }
    })
    .unwrap_or(0)
}

/// Free string allocated by duoorb_ai_find_best_action.
#[no_mangle]
pub unsafe extern "C" fn duoorb_ai_free_string(ptr: *mut std::os::raw::c_char) {
    if !ptr.is_null() {
        let _ = std::ffi::CString::from_raw(ptr);
    }
}

/// Allocate a buffer in WebAssembly linear memory
#[no_mangle]
pub unsafe extern "C" fn duoorb_ai_malloc(size: usize) -> *mut u8 {
    let mut buf = Vec::with_capacity(size);
    let ptr = buf.as_mut_ptr();
    std::mem::forget(buf);
    ptr
}

/// Free a buffer in WebAssembly linear memory
#[no_mangle]
pub unsafe extern "C" fn duoorb_ai_free(ptr: *mut u8, size: usize) {
    if !ptr.is_null() && size > 0 {
        let _ = Vec::from_raw_parts(ptr, 0, size);
    }
}

/// Initialize the global neural ONNX evaluator from in-memory byte slice (Web Worker)
#[no_mangle]
pub unsafe extern "C" fn duoorb_ai_init_model_from_bytes(ptr: *const u8, len: usize) -> i32 {
    if ptr.is_null() || len == 0 {
        return -1;
    }
    let slice = std::slice::from_raw_parts(ptr, len);
    match neural::NeuralEvaluator::load_from_bytes(slice) {
        Ok(evaluator) => {
            hybrid::set_global_evaluator(evaluator);
            0
        }
        Err(_) => -2,
    }
}

#[cfg(target_arch = "wasm32")]
fn custom_getrandom(buf: &mut [u8]) -> Result<(), getrandom::Error> {
    let mut state: u64 = 0x853c49e6748fea9b;
    for chunk in buf.chunks_mut(8) {
        state ^= state >> 12;
        state ^= state << 25;
        state ^= state >> 27;
        let bytes = (state.wrapping_mul(0x2545F4914F6CDD1D)).to_le_bytes();
        let len = chunk.len();
        chunk.copy_from_slice(&bytes[..len]);
    }
    Ok(())
}

#[cfg(target_arch = "wasm32")]
getrandom::register_custom_getrandom!(custom_getrandom);

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

    #[test]
    fn c_abi_get_bot_action_returns_valid_move() {
        let state_json = r#"{
            "gameId": "test_bot_game",
            "mode": "2p",
            "currentPlayerIndex": 0,
            "players": [
                {
                    "id": "p1",
                    "index": 0,
                    "displayName": "P1",
                    "position": {"row": 0, "col": 4},
                    "wallsRemaining": 10,
                    "goalDirection": "BOTTOM",
                    "status": "ACTIVE"
                },
                {
                    "id": "p2",
                    "index": 1,
                    "displayName": "P2",
                    "position": {"row": 8, "col": 4},
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
            let c_bot = CString::new("viktor").unwrap();
            let res_ptr = duoorb_ai_get_bot_action(c_json.as_ptr(), c_bot.as_ptr(), 42);
            assert!(!res_ptr.is_null());
            let res_str = CStr::from_ptr(res_ptr).to_str().unwrap();
            assert!(res_str.contains("MOVE") || res_str.contains("PLACE_WALL"));
            duoorb_ai_free_string(res_ptr);
        }
    }

    #[test]
    fn c_abi_get_hint_returns_grandmaster_explanation() {
        let state_json = r#"{
            "gameId": "test_hint_game",
            "mode": "2p",
            "currentPlayerIndex": 0,
            "players": [
                {
                    "id": "p1",
                    "index": 0,
                    "displayName": "P1",
                    "position": {"row": 0, "col": 4},
                    "wallsRemaining": 10,
                    "goalDirection": "BOTTOM",
                    "status": "ACTIVE"
                },
                {
                    "id": "p2",
                    "index": 1,
                    "displayName": "P2",
                    "position": {"row": 8, "col": 4},
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
            let res_ptr = duoorb_ai_get_hint(c_json.as_ptr());
            assert!(!res_ptr.is_null());
            let res_str = CStr::from_ptr(res_ptr).to_str().unwrap();
            assert!(res_str.contains("bestAction"));
            assert!(res_str.contains("winProbability"));
            assert!(res_str.contains("explanation"));
            duoorb_ai_free_string(res_ptr);
        }
    }

    #[test]
    fn c_abi_analyze_game_returns_full_review() {
        let state_json = r#"{
            "gameId": "test_review_game",
            "mode": "2p",
            "currentPlayerIndex": 0,
            "players": [
                {
                    "id": "p1",
                    "index": 0,
                    "displayName": "P1",
                    "position": {"row": 0, "col": 4},
                    "wallsRemaining": 10,
                    "goalDirection": "BOTTOM",
                    "status": "ACTIVE"
                },
                {
                    "id": "p2",
                    "index": 1,
                    "displayName": "P2",
                    "position": {"row": 8, "col": 4},
                    "wallsRemaining": 10,
                    "goalDirection": "TOP",
                    "status": "ACTIVE"
                }
            ],
            "walls": [],
            "status": "IN_PROGRESS"
        }"#;

        let history_json = r#"[
            {"player": "p1", "action": {"type": "MOVE", "to": {"row": 1, "col": 4}}},
            {"player": "p2", "action": {"type": "MOVE", "to": {"row": 7, "col": 4}}}
        ]"#;

        unsafe {
            let c_init = CString::new(state_json).unwrap();
            let c_hist = CString::new(history_json).unwrap();
            let res_ptr = duoorb_ai_analyze_game(c_init.as_ptr(), c_hist.as_ptr());
            assert!(!res_ptr.is_null());
            let res_str = CStr::from_ptr(res_ptr).to_str().unwrap();
            assert!(res_str.contains("moveAnalyses"));
            assert!(res_str.contains("accuracies"));
            assert!(res_str.contains("explanation"));
            duoorb_ai_free_string(res_ptr);
        }
    }
}


