import type { GameMode, GameState, RecordedAction } from '@duoorb/game-core';

export class ReviewRequestDto {
  initialState?: GameState;
  history?: RecordedAction[];
  gameId?: string;
  mode?: GameMode;
}
