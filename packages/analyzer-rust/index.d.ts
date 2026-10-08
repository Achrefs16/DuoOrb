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
