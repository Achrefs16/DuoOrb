import { Platform } from 'react-native';
import { getBestActionAsync } from '@duoorb/game-core';
import type {
  AIProfile,
  AiProductionBudget,
  GameAction,
  GameState,
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

let worker: BrowserWorker | null = null;
let workerUnavailable = false;
let nextRequestId = 1;
const pending = new Map<number, PendingRequest>();

const WORKER_TIMEOUT_MS = 12_000;

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
      const request = pending.get(data.id);
      if (!request) return;
      clearTimeout(request.timer);
      pending.delete(data.id);
      if (data.error) request.reject(new Error(data.error));
      else request.resolve(data.action);
    };
    created.onerror = () => {
      workerUnavailable = true;
      discardWorker();
      failPending(new Error('AI worker failed'));
    };
    worker = created as unknown as BrowserWorker;
    return worker;
  } catch {
    workerUnavailable = true;
    return null;
  }
}

function searchInWorker(
  state: GameState,
  profile: AIProfile,
  seed: number,
  budget?: AiProductionBudget
): Promise<GameAction | null> {
  const target = ensureWorker();
  if (!target) return Promise.reject(new Error('AI worker unavailable'));

  const id = nextRequestId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      workerUnavailable = true;
      discardWorker();
      failPending(new Error('AI worker timed out'));
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

  if (Platform.OS === 'web' && !workerUnavailable) {
    try {
      return await searchInWorker(state, profile, liveSeed, options.budget);
    } catch (error) {
      if (error instanceof AiWorkerCancelledError || options.shouldCancel?.()) {
        return null;
      }
      // Worker loading/runtime errors are not fatal: fall through to the
      // sliced main-thread search so the match can finish.
    }
  }

  if (options.shouldCancel?.()) return null;
  return getBestActionAsync(state, profile, liveSeed, {
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
