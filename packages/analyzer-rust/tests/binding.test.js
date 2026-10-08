const assert = require('assert');
const { createInitialState, applyAction } = require('../../game-core/dist/index.js');
const { analyzeGame, analyzeGameAsync } = require('../index.js');

async function run() {
  console.log('Testing @duoorb/analyzer-rust binding...');

  // 1. Create a game state and play a few moves
  let state = createInitialState({ mode: '2p' });
  const history = [];

  const movesToPlay = [
    { type: 'MOVE', to: { row: 7, col: 4 } },
    { type: 'MOVE', to: { row: 1, col: 4 } },
    { type: 'MOVE', to: { row: 6, col: 4 } },
    { type: 'MOVE', to: { row: 2, col: 4 } },
    { type: 'PLACE_WALL', wall: { row: 3, col: 2, orientation: 'H' } },
    { type: 'MOVE', to: { row: 2, col: 3 } },
    { type: 'MOVE', to: { row: 5, col: 4 } },
    { type: 'MOVE', to: { row: 2, col: 2 } },
  ];

  for (let i = 0; i < movesToPlay.length; i++) {
    const act = movesToPlay[i];
    const currentPlayer = state.players[state.currentPlayerIndex];
    const res = applyAction(state, act, { actorId: currentPlayer.id, timestamp: Date.now() });
    if (!res.success) {
      throw new Error(`Failed move ${i}: ${res.error}`);
    }
    state = res.state;
    history.push(res.state.lastMove);
  }

  const initialState = createInitialState({ mode: '2p' });

  // 2. Test synchronous analyzeGame
  console.log('Running analyzeGame (synchronous)...');
  const t0 = performance.now();
  const reviewSync = analyzeGame(initialState, history);
  const t1 = performance.now();
  console.log(`Synchronous review completed in ${(t1 - t0).toFixed(2)}ms`);

  console.log('reviewSync summary:', JSON.stringify(reviewSync.summary, null, 2));

  // 3. Test asynchronous analyzeGameAsync
  console.log('Running analyzeGameAsync (worker thread)...');
  const t2 = performance.now();
  const reviewAsync = await analyzeGameAsync(initialState, history);
  const t3 = performance.now();
  console.log(`Async review completed in ${(t3 - t2).toFixed(2)}ms`);

  assert.strictEqual(reviewAsync.totalMoves, 8);
  assert.strictEqual(reviewAsync.moveAnalyses.length, 8);
  assert.deepStrictEqual(reviewSync.summary.accuracy, reviewAsync.summary.accuracy);

  console.log('All tests passed! Native Rust analyzer is 100% operational!');
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
