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

module.exports = {
  analyzeGame,
  analyzeGameAsync,
  analyzeGameSyncRaw: nativeBinding.analyzeGameSync,
  analyzeGameAsyncRaw: nativeBinding.analyzeGameAsync
};
