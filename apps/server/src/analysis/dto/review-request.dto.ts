import { Allow, IsArray, IsOptional, IsString } from 'class-validator';
import type { GameMode, GameState, RecordedAction } from '@duoorb/game-core';

export class ReviewRequestDto {
  @IsOptional()
  @Allow()
  initialState?: GameState;

  @IsOptional()
  @IsArray()
  history?: RecordedAction[];

  @IsOptional()
  @IsArray()
  moves?: RecordedAction[];

  @IsOptional()
  @IsString()
  gameId?: string;

  @IsOptional()
  @IsString()
  mode?: GameMode;
}
