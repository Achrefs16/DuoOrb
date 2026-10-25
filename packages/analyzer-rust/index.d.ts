import type { GameState, RecordedAction } from '@duoorb/game-core';
import type { GameReview } from '@duoorb/game-core';

export function analyzeGame(
  initialState: GameState | string,
  history: RecordedAction[] | string
): GameReview;

export function analyzeGameAsync(
  initialState: GameState | string,
  history: RecordedAction[] | string
): Promise<GameReview>;

export function analyzeGameSyncRaw(
  initialStateJson: string,
  historyJson: string
): string;

export function analyzeGameAsyncRaw(
  initialStateJson: string,
  historyJson: string
): Promise<string>;

export function getBestAction(
  state: GameState | string,
  simulations?: number,
  threads?: number,
  seed?: number | null
): import('@duoorb/game-core').GameAction | null;

export function getBestActionAsync(
  state: GameState | string,
  simulations?: number,
  threads?: number,
  seed?: number | null
): Promise<import('@duoorb/game-core').GameAction | null>;

export function getBestActionSyncRaw(
  stateJson: string,
  simulations: number,
  threads?: number | null,
  seed?: number | null
): string;

export function getBestActionAsyncRaw(
  stateJson: string,
  simulations: number,
  threads?: number | null,
  seed?: number | null
): Promise<string>;

