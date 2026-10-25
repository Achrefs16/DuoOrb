import { GameReview, GameState, RecordedAction, createInitialState } from '@duoorb/game-core';
import { api } from '../network/apiClient';

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

  try {
    const serverReview = await api.requestGameReview(safeInitial, history, gameId);
    if (options?.isCancelled?.()) return null;
    if (serverReview && Array.isArray(serverReview.moveAnalyses)) {
      console.log(
        `[ReviewLoader] ✅ Received SERVER review (${serverReview.engineVersion || 'duoorb-rust-mcts-3.0'}) for ${gameId}`
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
