import { createInitialState, applyAction } from '@duoorb/game-core';
import analyzer from '@duoorb/analyzer-rust';
import * as fs from 'fs';
import * as path from 'path';

const BOT_PRESETS = [
  'achref', 'milo', 'torstein', 'drac', 'selene', 'orion', 'lyra', 'kassandra',
  'elena', 'magnus', 'solomon', 'zephyr', 'aurora', 'valkyrie', 'fenrir', 'titan'
];

export interface EngineSimulatedGame {
  seed: number;
  bot1: string;
  bot2: string;
  winnerPlayerIndex: number;
  wallsPlaced: number;
  plyCount: number;
  moves: {
    playerIndex: number;
    actionType: 'MOVE' | 'PLACE_WALL';
    payload: any;
  }[];
}

async function simulateOneGame(index: number, seed: number): Promise<EngineSimulatedGame | null> {
  const bot1 = BOT_PRESETS[index % BOT_PRESETS.length];
  const bot2 = BOT_PRESETS[(index * 3 + 5) % BOT_PRESETS.length];

  let state = createInitialState({
    mode: '2p',
    players: [
      { id: 'p1', name: 'P1', type: 'ai' },
      { id: 'p2', name: 'P2', type: 'ai' }
    ],
    rulesetVersion: 'classic-2p-v1'
  });

  const moves: { playerIndex: number; actionType: 'MOVE' | 'PLACE_WALL'; payload: any }[] = [];
  let plies = 0;

  while (state.status === 'IN_PROGRESS' && plies < 140) {
    const isP1 = state.currentPlayerIndex === 0;
    const botId = isP1 ? bot1 : bot2;
    const temp = 0.20 + (seed % 6) * 0.05;

    const act = await analyzer.getBotActionAsync(
      state,
      botId,
      JSON.stringify({
        simulations: 35,
        temperature: temp,
        variety_window: 0.07,
      }),
      seed + plies * 37
    );

    if (!act) break;
    const res = applyAction(state, act);
    if (!res.success) break;

    moves.push({
      playerIndex: isP1 ? 0 : 1,
      actionType: act.type as any,
      payload: act,
    });
    state = res.state;
    plies++;
  }

  if (state.status === 'COMPLETED' && moves.length >= 40) {
    const winnerPlayerIndex = state.winnerId === 'p1' ? 0 : 1;
    return {
      seed,
      bot1,
      bot2,
      winnerPlayerIndex,
      wallsPlaced: state.walls.length,
      plyCount: moves.length,
      moves,
    };
  }

  return null;
}

async function main() {
  const targetCount = parseInt(process.env.COUNT || '40', 10);
  console.log(`Simulating ${targetCount} authentic engine-played Quoridor games with @duoorb/analyzer-rust...`);
  const t0 = Date.now();

  const games: EngineSimulatedGame[] = [];
  const concurrency = 8;
  let batch = 0;

  while (games.length < targetCount && batch < 30) {
    const promises: Promise<EngineSimulatedGame | null>[] = [];
    const countToSpawn = Math.min(concurrency, targetCount - games.length);
    for (let c = 0; c < countToSpawn; c++) {
      const idx = batch * concurrency + c;
      const seed = 50000 + idx * 8191;
      promises.push(simulateOneGame(idx, seed));
    }

    const batchResults = await Promise.all(promises);
    for (const res of batchResults) {
      if (res) {
        games.push(res);
        console.log(`[Game ${games.length}/${targetCount}] Plies: ${res.plyCount}, Walls: ${res.wallsPlaced}, Winner: P${res.winnerPlayerIndex + 1} (${res.bot1} vs ${res.bot2})`);
      }
    }
    batch++;
  }

  console.log(`All ${games.length} games successfully simulated in ${(Date.now() - t0) / 1000}s.`);
  const outputPath = path.resolve(__dirname, '../src/bots/simulated-games.data.ts');
  const code = `// AUTO-GENERATED AUTHENTIC ENGINE-SIMULATED GAMES
// Every game is a 100% legal, 40-90+ ply competitive match played by the AlphaZero/MCTS engine.
import type { EngineSimulatedGame } from '../../scripts/generate-engine-history.js';

export const SIMULATED_ENGINE_GAMES: EngineSimulatedGame[] = ${JSON.stringify(games, null, 2)};
`;

  fs.writeFileSync(outputPath, code, 'utf-8');
  console.log(`Saved ${games.length} engine games to ${outputPath}`);
}

main().catch(console.error);
