import { Platform } from 'react-native';
import { getBestActionAsync, selectNativePersonalityAction, botById } from '@duoorb/game-core';
import * as nativeAi from 'duoorb-ai-native';
import type {
  AIProfile,
  AiProductionBudget,
  GameAction,
  GameState,
  GameReview,
  RecordedAction,
} from '@duoorb/game-core';
import type {
  AiWorkerCommand,
  AiWorkerRequest,
  AiWorkerResponse,
} from './aiWorkerProtocol';

export interface AiMoveOptions {
  /** Blitz ceiling supplied by the match screen. */
  budget?: AiProductionBudget;
  /** Cooperative cancellation for the main-thread fallback. */
  shouldCancel?: () => boolean;
  /** Grandmaster Oracle hint mode: runs at 100,000 native sims across 8 threads. */
  isHint?: boolean;
  /** Bot personality ID (e.g. 'martin', 'achref', 'viktor') for native engine. */
  botId?: string;
}

type BrowserWorker = {
  onmessage: ((event: MessageEvent<AiWorkerResponse>) => void) | null;
  onerror: ((event: unknown) => void) | null;
  postMessage: (message: AiWorkerCommand) => void;
  terminate: () => void;
};

type PendingRequest = {
  resolve: (action: GameAction | null) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

type PendingAnalysisRequest = {
  resolve: (review: GameReview | null) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

let worker: BrowserWorker | null = null;
let workerUnavailable = false;
let nextRequestId = 1;
const pending = new Map<number, PendingRequest>();
const pendingAnalysis = new Map<number, PendingAnalysisRequest>();

const WORKER_TIMEOUT_MS = 60_000;

class AiWorkerCancelledError extends Error {
  constructor() {
    super('AI worker request cancelled');
    this.name = 'AiWorkerCancelledError';
  }
}

function failPending(error: Error): void {
  for (const [id, request] of pending) {
    clearTimeout(request.timer);
    pending.delete(id);
    request.reject(error);
  }
  for (const [id, request] of pendingAnalysis) {
    clearTimeout(request.timer);
    pendingAnalysis.delete(id);
    request.reject(error);
  }
}

function discardWorker(): void {
  if (!worker) return;
  worker.terminate();
  worker = null;
}

function ensureWorker(): BrowserWorker | null {
  if (worker) return worker;
  if (workerUnavailable || Platform.OS !== 'web') return null;
  if (typeof window === 'undefined' || typeof Worker === 'undefined') {
    workerUnavailable = true;
    return null;
  }
  try {
    // Expo Metro turns this literal form into a separate worker bundle.
    // See https://docs.expo.dev/versions/latest/config/metro/#web-workers.
    const created = new Worker(new URL('./aiWorker', window.location.href));
    created.onmessage = ({ data }) => {
      // 1. Check if it is an analysis response
      const analysisReq = pendingAnalysis.get(data.id);
      if (analysisReq) {
        clearTimeout(analysisReq.timer);
        pendingAnalysis.delete(data.id);
        if (data.error) {
          analysisReq.reject(new Error(data.error));
        } else {
          analysisReq.resolve(data.review ?? null);
        }
        return;
      }

      // 2. Search / move response
      const request = pending.get(data.id);
      if (!request) return;
      clearTimeout(request.timer);
      pending.delete(data.id);
      if (data.error) {
        request.reject(new Error(data.error));
      } else {
        if (data.engine === 'wasm-onnx') {
          console.log(
            `%c[ONNX AlphaZero] 🧠 Move played by ONNX:%c`,
            'color: #10B981; font-size: 13px; font-weight: bold; background: #064E3B; padding: 2px 6px; border-radius: 4px;',
            'color: #38BDF8; font-weight: bold; margin-left: 8px;',
            data.action
          );
        }
        request.resolve(data.action ?? null);
      }
    };
    created.onerror = (err) => {
      console.warn('[WebWorker AI] Worker execution warning:', err);
      failPending(new Error('AI worker failed'));
    };
    worker = created as unknown as BrowserWorker;
    return worker;
  } catch {
    workerUnavailable = true;
    return null;
  }
}

// Eagerly preload worker and model on Web startup
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  try {
    ensureWorker();
  } catch {}
}

export function searchInWorker(
  state: GameState,
  profile: AIProfile,
  seed: number,
  budget?: AiProductionBudget,
  botId?: string,
  isHint?: boolean
): Promise<GameAction | null> {
  const target = ensureWorker();
  if (!target) return Promise.reject(new Error('AI worker unavailable'));

  const id = nextRequestId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('AI worker timed out'));
    }, WORKER_TIMEOUT_MS);

    pending.set(id, { resolve, reject, timer });
    const request: AiWorkerRequest = {
      type: 'search',
      id,
      state,
      profile,
      seed,
      budget,
      botId,
      isHint,
    };
    target.postMessage(request);
  });
}

export function analyzeInWorker(
  initialState: GameState,
  history: RecordedAction[]
): Promise<GameReview | null> {
  const target = ensureWorker();
  if (!target) return Promise.reject(new Error('AI worker unavailable'));

  const id = nextRequestId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingAnalysis.delete(id);
      reject(new Error('AI analysis timed out in worker'));
    }, WORKER_TIMEOUT_MS);

    pendingAnalysis.set(id, { resolve, reject, timer });
    const request: AiWorkerRequest = {
      type: 'analyze',
      id,
      initialState,
      history,
    };
    target.postMessage(request);
  });
}

/**
 * Live AI move selection.
 *
 * Web uses the worker (off the main thread). Native, or any environment where
 * the worker cannot start, falls back to game-core's sliced async search so
 * the UI still cannot be blocked by a long think.
 */
export async function getAiMove(
  state: GameState,
  profile: AIProfile,
  seed?: number,
  options: AiMoveOptions = {}
): Promise<GameAction | null> {
  const liveSeed =
    seed ?? ((Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0);

  const isClassic2P = state.mode === '2p';

  // 1. Classic 2P on Web is strictly powered by WASM AlphaZero ONNX Web Worker.
  // NEVER silently fall back to JavaScript engine.
  if (Platform.OS === 'web' && isClassic2P) {
    try {
      return await searchInWorker(
        state,
        profile,
        liveSeed,
        options.budget,
        options.botId,
        options.isHint
      );
    } catch (error) {
      if (error instanceof AiWorkerCancelledError || options.shouldCancel?.()) {
        return null;
      }
      console.error('[aiWorkerClient] Web AlphaZero ONNX engine error for Classic 2P:', error);
      return null;
    }
  }

  // 2. Non-2P mode on Web (4p, race, etc.) uses worker with game-core heuristic
  if (Platform.OS === 'web' && !isClassic2P && !workerUnavailable) {
    try {
      return await searchInWorker(
        state,
        profile,
        liveSeed,
        options.budget,
        options.botId,
        options.isHint
      );
    } catch (error) {
      if (error instanceof AiWorkerCancelledError || options.shouldCancel?.()) {
        return null;
      }
    }
  }

  const isAvailable =
    typeof nativeAi.isNativeAiAvailable === 'function' &&
    nativeAi.isNativeAiAvailable();

  if (Platform.OS !== 'web' && isAvailable && isClassic2P) {
    try {
      const isHint = Boolean(options.isHint);
      const isHard = profile.difficulty === 'hard';

      // Feature 1: Unified Native Bots Engine (calibrated Rust personality with AlphaZero ONNX)
      let getBot: unknown;
      try {
        getBot = (nativeAi as Record<string, unknown>).getBotActionNative;
      } catch {
        getBot = undefined;
      }
      const botPreset = options.botId || (profile?.difficulty === 'easy' ? 'martin' : 'achref');
      if (!isHint && typeof getBot === 'function') {
        const nativeAction = await (getBot as (s: GameState, b: string, seed: number) => Promise<GameAction | null>)(state, botPreset, liveSeed);
        if (nativeAction) return nativeAction;
      }

      if (isHint) {
        let getHint: unknown;
        try {
          getHint = (nativeAi as Record<string, unknown>).getHintNative;
        } catch {
          getHint = undefined;
        }
        if (typeof getHint === 'function') {
          const hintResp = await (getHint as (s: GameState) => Promise<nativeAi.HintResponse | null>)(state);
          if (hintResp && hintResp.bestAction) {
            return hintResp.bestAction;
          }
        }
        if (typeof nativeAi.getBestActionNative === 'function') {
          const nativeAction = await nativeAi.getBestActionNative(state, 100000, 8);
          if (nativeAction) return nativeAction;
        }
      } else if (isHard) {
        const nativeSims = 50000;
        const threads = 8;
        let getRanked: unknown;
        try {
          getRanked = (nativeAi as Record<string, unknown>).getRankedActionsNative;
        } catch {
          getRanked = undefined;
        }

        if (!isHint && typeof getRanked === 'function') {
          try {
            const ranked = await (getRanked as (
              state: GameState,
              simulations?: number,
              threads?: number,
              topK?: number
            ) => Promise<unknown[] | null>)(state, nativeSims, threads, 40);
            if (ranked && ranked.length > 0) {
              const selected = selectNativePersonalityAction(
                state,
                profile,
                ranked as Parameters<typeof selectNativePersonalityAction>[2],
                liveSeed
              );
              if (selected) return selected;
            }
          } catch {
            // Ignore ranked error and fall back to direct best action
          }
        }

        if (typeof nativeAi.getBestActionNative === 'function') {
          const nativeAction = await nativeAi.getBestActionNative(state, nativeSims, threads);
          if (nativeAction) return nativeAction;
        }
      }
    } catch {
      // Fall through to JS engine
    }
  }

  // If native search was cancelled or aborted, return null
  if (options.shouldCancel?.()) return null;

  // Emergency / dev fallback (e.g. Expo Go, test runners, or native crash recovery)
  const effectiveProfile =
    profile ??
    (options.botId ? botById(options.botId)?.profile : undefined) ??
    botById('achref')?.profile;
  if (!effectiveProfile) return null;

  return getBestActionAsync(state, effectiveProfile, liveSeed, {
    shouldCancel: options.shouldCancel,
    budget: options.budget,
  });
}

/**
 * Abort any in-flight worker search. Used when the board moves on (undo, new
 * game, unmount) so stale thinking cannot delay the next AI turn. An idle
 * worker is kept alive for reuse.
 */
export function cancelAiSearch(): void {
  if (pending.size === 0) return;
  for (const id of pending.keys()) {
    if (worker) worker.postMessage({ type: 'cancel', id });
  }
  discardWorker();
  failPending(new AiWorkerCancelledError());
}

/**
 * Request a full Grandmaster Oracle hint (best move, win probability, tactical explanation, alternatives).
 */
export async function getGrandmasterHint(
  state: GameState
): Promise<nativeAi.HintResponse | null> {
  const isAvailable =
    typeof nativeAi.isNativeAiAvailable === 'function' &&
    nativeAi.isNativeAiAvailable();

  const isClassic2P = state.mode === '2p';

  if (Platform.OS !== 'web' && isAvailable && isClassic2P) {
    if (typeof (nativeAi as Record<string, unknown>).getHintNative === 'function') {
      try {
        return await (nativeAi as any).getHintNative(state);
      } catch {
        return null;
      }
    }
  }

  // On Web / PWA, query the Web Worker (WASM for 2P, heuristic engine for variants)
  if (Platform.OS === 'web' && !workerUnavailable) {
    try {
      const hintAction = await searchInWorker(
        state,
        { difficulty: 'hard' } as any,
        Date.now(),
        undefined,
        undefined,
        true
      );
      if (hintAction) {
        return {
          bestAction: hintAction,
          winProbability: 0.95,
          tacticalTag: isClassic2P ? 'BEST_MOVE' : 'TACTICAL_CHOICE',
          explanation: isClassic2P ? 'WASM Grandmaster recommended move' : 'Tactical line calculated by game engine',
          notation: '',
          alternatives: [],
        };
      }
    } catch {}
  }

  // Fallback for native non-2P modes or unavailable worker: use game-core heuristic
  try {
    const hintAction = await getBestActionAsync(
      state,
      botById('achref')?.profile ?? ({ difficulty: 'hard' } as any),
      Date.now()
    );
    if (hintAction) {
      return {
        bestAction: hintAction,
        winProbability: 0.5,
        tacticalTag: 'TACTICAL_CHOICE',
        explanation: 'Tactical line calculated by game engine',
        notation: '',
        alternatives: [],
      };
    }
  } catch {}

  return null;
}
