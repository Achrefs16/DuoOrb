import { Platform } from 'react-native';
import { GameReview, GameState, RecordedAction, createInitialState } from '@duoorb/game-core';
import { api } from '../network/apiClient';
import { analyzeInWorker } from '../ai/aiWorkerClient';

const REVIEW_CACHE = new Map<string, GameReview>();
const REVIEW_CACHE_LIMIT = 10;

export function reviewCacheKey(gameId: string, historyLength: number): string {
  return `${gameId}:${historyLength}`;
}

export function cacheReview(key: string, review: GameReview): void {
  REVIEW_CACHE.set(key, review);
  while (REVIEW_CACHE.size > REVIEW_CACHE_LIMIT) {
    const oldest = REVIEW_CACHE.keys().next();
    if (oldest.done) break;
    REVIEW_CACHE.delete(oldest.value);
  }
}

export function getCachedReview(key: string): GameReview | undefined {
  return REVIEW_CACHE.get(key);
}

export async function fetchOrComputeReview(
  initialState: GameState,
  history: RecordedAction[],
  gameId: string,
  options?: {
    isCancelled?: () => boolean;
  }
): Promise<GameReview | null> {
  const key = reviewCacheKey(gameId, history.length);
  const cached = getCachedReview(key);
  if (cached) return cached;

  const safeInitial =
    initialState && Array.isArray(initialState.players) && initialState.players.length > 0
      ? initialState
      : createInitialState({
          gameId,
          mode: '2p',
        });

  // Game Review is strictly scoped to Classic 2-Player (2p)
  if (safeInitial.mode !== '2p') {
    return null;
  }

  // 1. Try on-device local native analysis first (< 60ms offline review on iOS/Android)
  if (Platform.OS !== 'web') {
    try {
      let analyzeGameNativeFn: any = undefined;
      try {
        const nativeAi = require('duoorb-ai-native');
        analyzeGameNativeFn = nativeAi?.analyzeGameNative;
      } catch {}

      if (typeof analyzeGameNativeFn === 'function') {
        const nativeReview = await analyzeGameNativeFn(safeInitial, history);
        if (options?.isCancelled?.()) return null;
        if (nativeReview && Array.isArray(nativeReview.moveAnalyses)) {
          console.log(
            `[ReviewLoader] ✅ Computed LOCAL NATIVE review (${nativeReview.engineVersion || 'hybrid'}) for ${gameId}`
          );
          cacheReview(key, nativeReview);
          return nativeReview;
        }
      }
    } catch (nativeErr) {
      console.warn(`[ReviewLoader] Local native analysis skipped/failed:`, nativeErr);
    }
  }

  // 2. On Web: Use WebAssembly AlphaZero ONNX review in worker (< 400ms offline review)
  if (Platform.OS === 'web') {
    try {
      const wasmReview = await analyzeInWorker(safeInitial, history);
      if (options?.isCancelled?.()) return null;
      if (wasmReview && Array.isArray(wasmReview.moveAnalyses)) {
        console.log(
          `[ReviewLoader] ✅ Computed WEB WASM review (${wasmReview.engineVersion || 'wasm-rust'}) for ${gameId}`
        );
        cacheReview(key, wasmReview);
        return wasmReview;
      }
    } catch (wasmErr) {
      console.warn(`[ReviewLoader] Web WASM review skipped/failed:`, wasmErr);
    }
  }

  // 3. Fall back to Server Review API (AWS cloud)
  try {
    const serverReview = await api.requestGameReview(safeInitial, history, gameId);
    if (options?.isCancelled?.()) return null;
    if (serverReview && Array.isArray(serverReview.moveAnalyses) && serverReview.moveAnalyses.length > 0) {
      console.log(
        `[ReviewLoader] ✅ Received SERVER review (${serverReview.engineVersion || 'duoorb-rust-hybrid-4.0'}) for ${gameId}`
      );
      cacheReview(key, serverReview);
      return serverReview;
    }
  } catch (err) {
    console.warn(
      `[ReviewLoader] ❌ Server analysis failed (${(err as any)?.message || err}).`
    );
  }

  return null;
}
