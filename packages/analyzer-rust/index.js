const path = require('path');
const fs = require('fs');

let nativeBinding = null;

const candidatePaths = [
  path.join(__dirname, 'duoorb-analyzer.node'),
  path.join(__dirname, 'target', 'release', 'duoorb_analyzer.dll'),
  path.join(__dirname, 'target', 'release', 'libduoorb_analyzer.so'),
  path.join(__dirname, 'target', 'release', 'libduoorb_analyzer.dylib')
];

for (const p of candidatePaths) {
  if (fs.existsSync(p)) {
    try {
      nativeBinding = require(p);
      break;
    } catch (e) {
      // Continue trying next candidate
    }
  }
}

if (!nativeBinding) {
  throw new Error(
    `[analyzer-rust] Failed to load native addon duoorb-analyzer. Checked paths:\n` +
    candidatePaths.join('\n')
  );
}

/**
 * Synchronously analyze a game using the native Rust engine.
 * Accepts either GameState / RecordedAction[] objects or raw JSON strings.
 */
function analyzeGame(initialState, history) {
  const initStr = typeof initialState === 'string' ? initialState : JSON.stringify(initialState);
  const histStr = typeof history === 'string' ? history : JSON.stringify(history);
  const jsonResult = nativeBinding.analyzeGameSync(initStr, histStr);
  return JSON.parse(jsonResult);
}

/**
 * Asynchronously analyze a game on an OS background thread (NAPI worker).
 * Does not block the Node.js event loop or WebSocket tick!
 */
async function analyzeGameAsync(initialState, history) {
  const initStr = typeof initialState === 'string' ? initialState : JSON.stringify(initialState);
  const histStr = typeof history === 'string' ? history : JSON.stringify(history);
  const jsonResult = await nativeBinding.analyzeGameAsync(initStr, histStr);
  return JSON.parse(jsonResult);
}

/**
 * Find the optimal action using parallel multi-threaded MCTS in native Rust.
 */
function getBestAction(state, simulations = 50000, threads = 4, seed = null) {
  const stateStr = typeof state === 'string' ? state : JSON.stringify(state);
  const jsonResult = nativeBinding.getBestActionSync(stateStr, simulations, threads, seed);
  return JSON.parse(jsonResult);
}

/**
 * Asynchronously find the optimal action on an OS background thread (NAPI worker).
 */
async function getBestActionAsync(state, simulations = 50000, threads = 4, seed = null) {
  const stateStr = typeof state === 'string' ? state : JSON.stringify(state);
  const jsonResult = await nativeBinding.getBestActionAsync(stateStr, simulations, threads, seed);
  return JSON.parse(jsonResult);
}

/**
 * Return the top root actions with aggregate visits and Q values.
 */
function getRankedActions(state, simulations = 50000, threads = 4, seed = null, topK = 12) {
  const stateStr = typeof state === 'string' ? state : JSON.stringify(state);
  const jsonResult = nativeBinding.getRankedActionsSync(stateStr, simulations, threads, seed, topK);
  return JSON.parse(jsonResult);
}

async function getRankedActionsAsync(state, simulations = 50000, threads = 4, seed = null, topK = 12) {
  const stateStr = typeof state === 'string' ? state : JSON.stringify(state);
  const jsonResult = await nativeBinding.getRankedActionsAsync(stateStr, simulations, threads, seed, topK);
  return JSON.parse(jsonResult);
}

/**
 * Get an action for a specific bot personality (Martin, Viktor, Achref, etc.)
 * utilizing the calibrated temperature, blunder simulation, and style matrix.
 */
function getBotAction(state, botId = 'achref', profile = null, seed = null) {
  const stateStr = typeof state === 'string' ? state : JSON.stringify(state);
  const profileStr = profile ? (typeof profile === 'string' ? profile : JSON.stringify(profile)) : null;
  const jsonResult = nativeBinding.getBotActionSync(stateStr, botId, profileStr, seed);
  return JSON.parse(jsonResult);
}

async function getBotActionAsync(state, botId = 'achref', profile = null, seed = null) {
  const stateStr = typeof state === 'string' ? state : JSON.stringify(state);
  const profileStr = profile ? (typeof profile === 'string' ? profile : JSON.stringify(profile)) : null;
  const jsonResult = await nativeBinding.getBotActionAsync(stateStr, botId, profileStr, seed);
  return JSON.parse(jsonResult);
}

/**
 * Get Grandmaster Oracle in-game hint: optimal move + win probability + tactical explanation + top-3 alternatives.
 */
function getHint(state) {
  const stateStr = typeof state === 'string' ? state : JSON.stringify(state);
  const jsonResult = nativeBinding.getHintSync(stateStr);
  return JSON.parse(jsonResult);
}

async function getHintAsync(state) {
  const stateStr = typeof state === 'string' ? state : JSON.stringify(state);
  const jsonResult = await nativeBinding.getHintAsync(stateStr);
  return JSON.parse(jsonResult);
}

module.exports = {
  analyzeGame,
  analyzeGameAsync,
  getBestAction,
  getBestActionAsync,
  getRankedActions,
  getRankedActionsAsync,
  getBotAction,
  getBotActionAsync,
  getHint,
  getHintAsync,
  analyzeGameSyncRaw: nativeBinding.analyzeGameSync,
  analyzeGameAsyncRaw: nativeBinding.analyzeGameAsync,
  getBestActionSyncRaw: nativeBinding.getBestActionSync,
  getBestActionAsyncRaw: nativeBinding.getBestActionAsync,
  getRankedActionsSyncRaw: nativeBinding.getRankedActionsSync,
  getRankedActionsAsyncRaw: nativeBinding.getRankedActionsAsync,
  getBotActionSyncRaw: nativeBinding.getBotActionSync,
  getBotActionAsyncRaw: nativeBinding.getBotActionAsync,
  getHintSyncRaw: nativeBinding.getHintSync,
  getHintAsyncRaw: nativeBinding.getHintAsync
};
