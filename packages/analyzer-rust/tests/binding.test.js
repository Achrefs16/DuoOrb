const assert = require('assert');
const { createInitialState, applyAction } = require('../../game-core/dist/index.js');
const {
  analyzeGame,
  analyzeGameAsync,
  getBestAction,
  getRankedActions,
  getBotAction,
  getBotActionAsync,
  getHint,
  getHintAsync,
} = require('../index.js');

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

  // 3b. Test non-2p mode returns immediate unsupported summary
  console.log('Testing non-2p mode rejection in analyzeGame...');
  const state4p = createInitialState({ mode: '4p' });
  const review4pSync = analyzeGame(state4p, []);
  assert.strictEqual(review4pSync.mode, '4p');
  assert.strictEqual(review4pSync.totalMoves, 0);
  assert.strictEqual(review4pSync.moveAnalyses.length, 0);
  assert.strictEqual(review4pSync.summary.keyLesson.title, 'Classic 2P Only');

  const review4pAsync = await analyzeGameAsync(state4p, []);
  assert.strictEqual(review4pAsync.mode, '4p');
  assert.strictEqual(review4pAsync.totalMoves, 0);
  assert.strictEqual(review4pAsync.summary.keyLesson.title, 'Classic 2P Only');

  // 4. Test ranked root candidates and the standard action API.
  console.log('Running ranked root candidates...');
  const ranked = getRankedActions(state, 5000, 2, 12345, 12);
  assert.ok(Array.isArray(ranked));
  assert.ok(ranked.length > 0);
  assert.ok(ranked[0].action);
  assert.ok(ranked[0].visits > 0);
  assert.ok(ranked[0].q >= 0 && ranked[0].q <= 1);
  for (let i = 1; i < ranked.length; i++) {
    assert.ok(ranked[i - 1].visits >= ranked[i].visits);
  }

  const best = getBestAction(state, 5000, 2, 12345);
  assert.ok(best);

  // 5. Test Unified Bot Engine (Feature 1)
  console.log('Running unified bot engine tests...');
  const tBot0 = performance.now();
  const achrefMove = getBotAction(state, 'achref', null, 42);
  const tBot1 = performance.now();
  console.log(`Achref (Grandmaster) move selected in ${(tBot1 - tBot0).toFixed(2)}ms:`, JSON.stringify(achrefMove));
  assert.ok(achrefMove);
  assert.ok(achrefMove.type === 'MOVE' || achrefMove.type === 'PLACE_WALL');

  const viktorMove = getBotAction(state, 'viktor', null, 42);
  console.log('Viktor (Master Wall Architect) move:', JSON.stringify(viktorMove));
  assert.ok(viktorMove);

  const martinMove = getBotAction(state, 'martin', null, 9999);
  console.log('Martin (Friendly Dad) move:', JSON.stringify(martinMove));
  assert.ok(martinMove);

  const miloMoveAsync = await getBotActionAsync(state, 'milo', null, 777);
  console.log('Milo (2900 Elo GM async) move:', JSON.stringify(miloMoveAsync));
  assert.ok(miloMoveAsync);

  // 6. Test Grandmaster Oracle Hint Engine (Feature 2)
  console.log('Running Grandmaster Oracle in-game hint tests...');
  const tHint0 = performance.now();
  const hint = getHint(state);
  const tHint1 = performance.now();
  console.log(`Grandmaster hint calculated in ${(tHint1 - tHint0).toFixed(2)}ms:`, JSON.stringify(hint, null, 2));
  assert.ok(hint.bestAction);
  assert.ok(hint.winProbability > 0 && hint.winProbability <= 1);
  assert.ok(hint.tacticalTag);
  assert.ok(hint.explanation);
  assert.ok(Array.isArray(hint.alternatives));

  const hintAsync = await getHintAsync(state);
  assert.ok(hintAsync.bestAction);

  // 7. Test Feature 4: Server Analysis Engine Concurrency Load Test (50 concurrent games)
  console.log('Running 50 concurrent game analysis stress test (AWS t4.micro target)...');
  const tLoad0 = performance.now();
  const concurrencyBatch = [];
  for (let i = 0; i < 50; i++) {
    concurrencyBatch.push(analyzeGameAsync(initialState, history));
  }
  const loadResults = await Promise.all(concurrencyBatch);
  const tLoad1 = performance.now();
  const totalDuration = tLoad1 - tLoad0;
  const avgPerGame = totalDuration / 50;
  console.log(`50 concurrent games analyzed in ${totalDuration.toFixed(2)}ms (throughput: ${avgPerGame.toFixed(2)}ms per game)`);
  assert.strictEqual(loadResults.length, 50);
  for (const res of loadResults) {
    assert.strictEqual(res.totalMoves, 8);
    assert.strictEqual(res.moveAnalyses.length, 8);
  }

  console.log('All tests passed! Native Rust analyzer is 100% operational!');
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
