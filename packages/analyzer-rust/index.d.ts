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

export interface RankedNativeAction {
  action: import('@duoorb/game-core').GameAction;
  visits: number;
  q: number;
}

export function getRankedActions(
  state: GameState | string,
  simulations?: number,
  threads?: number,
  seed?: number | null,
  topK?: number
): RankedNativeAction[];

export function getRankedActionsAsync(
  state: GameState | string,
  simulations?: number,
  threads?: number,
  seed?: number | null,
  topK?: number
): Promise<RankedNativeAction[]>;

export function getRankedActionsSyncRaw(
  stateJson: string,
  simulations: number,
  threads?: number | null,
  seed?: number | null,
  topK?: number | null
): string;

export function getRankedActionsAsyncRaw(
  stateJson: string,
  simulations: number,
  threads?: number | null,
  seed?: number | null,
  topK?: number | null
): Promise<string>;

export function getBotAction(
  state: GameState | string,
  botId?: string | null,
  profile?: unknown | null,
  seed?: number | null
): import('@duoorb/game-core').GameAction | null;

export function getBotActionAsync(
  state: GameState | string,
  botId?: string | null,
  profile?: unknown | null,
  seed?: number | null
): Promise<import('@duoorb/game-core').GameAction | null>;

export function getBotActionSyncRaw(
  stateJson: string,
  botId?: string | null,
  profileJson?: string | null,
  seed?: number | null
): string;

export function getBotActionAsyncRaw(
  stateJson: string,
  botId?: string | null,
  profileJson?: string | null,
  seed?: number | null
): Promise<string>;

export interface HintCandidate {
  action: import('@duoorb/game-core').GameAction;
  winProbability: number;
  tacticalTag: string;
  explanation: string;
  ownDistanceDelta: number;
  oppDistanceDelta: number;
  notation: string;
}

export interface HintResponse {
  bestAction: import('@duoorb/game-core').GameAction;
  winProbability: number;
  tacticalTag: string;
  explanation: string;
  notation: string;
  alternatives: HintCandidate[];
}

export function getHint(state: GameState | string): HintResponse;
export function getHintAsync(state: GameState | string): Promise<HintResponse>;
export function getHintSyncRaw(stateJson: string): string;
export function getHintAsyncRaw(stateJson: string): Promise<string>;

