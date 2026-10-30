import type {
  AIProfile,
  AiProductionBudget,
  GameAction,
  GameState,
  RecordedAction,
} from '@duoorb/game-core';

export interface HintCandidate {
  action: GameAction;
  winProbability: number;
  tacticalTag: string;
  explanation: string;
  ownDistanceDelta: number;
  oppDistanceDelta: number;
  notation: string;
}

export interface HintResponse {
  bestAction: GameAction;
  winProbability: number;
  tacticalTag: string;
  explanation: string;
  notation: string;
  alternatives: HintCandidate[];
}

/** Messages accepted by the web AI worker. Kept tiny: everything is structured-cloneable. */
export type AiWorkerRequest =
  | {
      type: 'search';
      id: number;
      state: GameState;
      profile: AIProfile;
      seed: number;
      budget?: AiProductionBudget;
      botId?: string;
      isHint?: boolean;
    }
  | {
      type: 'analyze';
      id: number;
      initialState: GameState;
      history: RecordedAction[];
    };

export type AiWorkerCancel = {
  type: 'cancel';
  id: number;
};

export type AiWorkerCommand = AiWorkerRequest | AiWorkerCancel;

export type AiWorkerResponse = {
  type: 'result';
  id: number;
  action?: GameAction | null;
  hint?: HintResponse | null;
  review?: any | null;
  error?: string;
  engine?: 'wasm-onnx' | 'js-gamecore';
};
