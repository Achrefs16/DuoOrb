import type { GameState, RecordedAction } from '@duoorb/game-core';

export class ReviewRequestDto {
  initialState!: GameState;
  history!: RecordedAction[];
}
