import { Platform } from 'react-native';
import { requireNativeModule } from 'expo';
import type { GameAction, GameState } from '@duoorb/game-core';

export interface NativeAiModule {
  /**
   * Find the optimal action using the native multi-threaded MCTS engine.
   * Runs on a background OS thread.
   */
  getBestAction(
    stateJson: string,
    simulations: number,
    threads: number
  ): Promise<string | null>;
}

let native: NativeAiModule | null = null;
let attempted = false;

function getNative(): NativeAiModule | null {
  if (!attempted) {
    attempted = true;
    try {
      native = requireNativeModule<NativeAiModule>('DuoOrbAi');
    } catch {
      native = null;
    }
  }
  return native;
}

/** True only on iOS/Android native builds that include the module. */
export function isNativeAiAvailable(): boolean {
  if (Platform.OS === 'web') return false;
  return getNative() !== null;
}

/**
 * Runs 50,000+ MCTS simulations on background native threads.
 * Resolves to the optimal GameAction, or null if native is unavailable.
 */
export async function getBestActionNative(
  state: GameState,
  simulations = 50000,
  threads = 4
): Promise<GameAction | null> {
  const mod = getNative();
  if (!mod) return null;
  try {
    const stateStr = JSON.stringify(state);
    const resultJson = await mod.getBestAction(stateStr, simulations, threads);
    if (!resultJson || resultJson === 'null') return null;
    return JSON.parse(resultJson) as GameAction;
  } catch (error) {
    console.warn('[duoorb-ai-native] Error during native MCTS search:', error);
    return null;
  }
}