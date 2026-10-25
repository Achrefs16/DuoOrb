import type {
  AIProfile,
  AiProductionBudget,
  GameAction,
  GameState,
} from '@duoorb/game-core';

/** Messages accepted by the web AI worker. Kept tiny: everything is structured-cloneable. */
export type AiWorkerRequest = {
  type: 'search';
  id: number;
  state: GameState;
  profile: AIProfile;
  seed: number;
  budget?: AiProductionBudget;
};

export type AiWorkerCancel = {
  type: 'cancel';
  id: number;
};

export type AiWorkerCommand = AiWorkerRequest | AiWorkerCancel;

export type AiWorkerResponse = {
  type: 'result';
  id: number;
  action: GameAction | null;
  error?: string;
};
