import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState, botById, type AIProfile, type GameAction } from '@duoorb/game-core';

describe('aiWorkerClient routing & native fallback', () => {
  const initialState = createInitialState({ mode: '2p' });
  const achrefProfile: AIProfile = botById('achref')!.profile;
  const martinProfile: AIProfile = botById('martin')!.profile;

  const sampleAction: GameAction = {
    type: 'MOVE',
    to: { row: 6, col: 4 },
  };

  beforeEach(() => {
    vi.resetModules();
  });

  it('routes to native module with 50,000 sims & 8 threads for hard bots on native', async () => {
    const mockGetBestActionNative = vi.fn().mockResolvedValue(sampleAction);
    const mockIsNativeAiAvailable = vi.fn().mockReturnValue(true);

    vi.doMock('react-native', () => ({
      Platform: { OS: 'android' },
    }));

    vi.doMock('duoorb-ai-native', () => ({
      isNativeAiAvailable: mockIsNativeAiAvailable,
      getBestActionNative: mockGetBestActionNative,
    }));

    const { getAiMove } = await import('./aiWorkerClient');
    const action = await getAiMove(initialState, achrefProfile, 12345);

    expect(mockIsNativeAiAvailable).toHaveBeenCalled();
    expect(mockGetBestActionNative).toHaveBeenCalledWith(
      initialState,
      50000,
      8
    );
    expect(action).toEqual(sampleAction);
  });

  it('uses getRankedActionsNative for hard bot personality selection when available', async () => {
    const candidateAction: GameAction = { type: 'MOVE', to: { row: 6, col: 4 } };
    const rankedCandidates = [
      { action: candidateAction, visits: 25000, q: 0.8 },
      { action: { type: 'MOVE', to: { row: 7, col: 5 } } as GameAction, visits: 10000, q: 0.7 },
    ];
    const mockGetRankedActionsNative = vi.fn().mockResolvedValue(rankedCandidates);
    const mockGetBestActionNative = vi.fn().mockResolvedValue(sampleAction);
    const mockIsNativeAiAvailable = vi.fn().mockReturnValue(true);

    vi.doMock('react-native', () => ({
      Platform: { OS: 'android' },
    }));

    vi.doMock('duoorb-ai-native', () => ({
      isNativeAiAvailable: mockIsNativeAiAvailable,
      getRankedActionsNative: mockGetRankedActionsNative,
      getBestActionNative: mockGetBestActionNative,
    }));

    const { getAiMove } = await import('./aiWorkerClient');
    const action = await getAiMove(initialState, achrefProfile, 12345);

    expect(mockIsNativeAiAvailable).toHaveBeenCalled();
    expect(mockGetRankedActionsNative).toHaveBeenCalledWith(
      initialState,
      50000,
      8,
      40
    );
    expect(mockGetBestActionNative).not.toHaveBeenCalled();
    expect(action).toBeDefined();
  });

  it('routes to native module with 100,000 sims & 8 threads when isHint is true', async () => {
    const mockGetBestActionNative = vi.fn().mockResolvedValue(sampleAction);
    const mockIsNativeAiAvailable = vi.fn().mockReturnValue(true);

    vi.doMock('react-native', () => ({
      Platform: { OS: 'ios' },
    }));

    vi.doMock('duoorb-ai-native', () => ({
      isNativeAiAvailable: mockIsNativeAiAvailable,
      getBestActionNative: mockGetBestActionNative,
    }));

    const { getAiMove } = await import('./aiWorkerClient');
    const action = await getAiMove(initialState, achrefProfile, 12345, { isHint: true });

    expect(mockIsNativeAiAvailable).toHaveBeenCalled();
    expect(mockGetBestActionNative).toHaveBeenCalledWith(
      initialState,
      100000,
      8
    );
    expect(action).toEqual(sampleAction);
  });

  it('keeps easy/beginner bot on JS engine with calibrated blunders instead of native grandmaster engine', async () => {
    const mockGetBestActionNative = vi.fn().mockResolvedValue(sampleAction);
    const mockIsNativeAiAvailable = vi.fn().mockReturnValue(true);
    const jsMove: GameAction = { type: 'MOVE', to: { row: 7, col: 4 } };
    const mockGetBestActionAsync = vi.fn().mockResolvedValue(jsMove);

    vi.doMock('react-native', () => ({
      Platform: { OS: 'ios' },
    }));

    vi.doMock('duoorb-ai-native', () => ({
      isNativeAiAvailable: mockIsNativeAiAvailable,
      getBestActionNative: mockGetBestActionNative,
    }));

    vi.doMock('@duoorb/game-core', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@duoorb/game-core')>();
      return {
        ...actual,
        getBestActionAsync: mockGetBestActionAsync,
      };
    });

    const { getAiMove } = await import('./aiWorkerClient');
    const action = await getAiMove(initialState, martinProfile, 12345);

    expect(mockIsNativeAiAvailable).toHaveBeenCalled();
    expect(mockGetBestActionNative).not.toHaveBeenCalled();
    expect(action).toEqual(jsMove);
  });

  it('falls back gracefully to JS getBestActionAsync when native returns null', async () => {
    const mockGetBestActionNative = vi.fn().mockResolvedValue(null);
    const mockIsNativeAiAvailable = vi.fn().mockReturnValue(true);
    const jsFallbackAction: GameAction = { type: 'MOVE', to: { row: 7, col: 3 } };
    const mockGetBestActionAsync = vi.fn().mockResolvedValue(jsFallbackAction);

    vi.doMock('react-native', () => ({
      Platform: { OS: 'android' },
    }));

    vi.doMock('duoorb-ai-native', () => ({
      isNativeAiAvailable: mockIsNativeAiAvailable,
      getBestActionNative: mockGetBestActionNative,
    }));

    vi.doMock('@duoorb/game-core', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@duoorb/game-core')>();
      return {
        ...actual,
        getBestActionAsync: mockGetBestActionAsync,
      };
    });

    const { getAiMove } = await import('./aiWorkerClient');
    const action = await getAiMove(initialState, achrefProfile, 12345);

    expect(mockGetBestActionNative).toHaveBeenCalled();
    expect(mockGetBestActionAsync).toHaveBeenCalled();
    expect(action).toEqual(jsFallbackAction);
  });

  it('falls back gracefully to JS getBestActionAsync when native throws', async () => {
    const mockGetBestActionNative = vi.fn().mockRejectedValue(new Error('Native engine panic'));
    const mockIsNativeAiAvailable = vi.fn().mockReturnValue(true);
    const jsFallbackAction: GameAction = { type: 'MOVE', to: { row: 7, col: 5 } };
    const mockGetBestActionAsync = vi.fn().mockResolvedValue(jsFallbackAction);

    vi.doMock('react-native', () => ({
      Platform: { OS: 'ios' },
    }));

    vi.doMock('duoorb-ai-native', () => ({
      isNativeAiAvailable: mockIsNativeAiAvailable,
      getBestActionNative: mockGetBestActionNative,
    }));

    vi.doMock('@duoorb/game-core', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@duoorb/game-core')>();
      return {
        ...actual,
        getBestActionAsync: mockGetBestActionAsync,
      };
    });

    const { getAiMove } = await import('./aiWorkerClient');
    const action = await getAiMove(initialState, achrefProfile, 12345);

    expect(mockGetBestActionNative).toHaveBeenCalled();
    expect(mockGetBestActionAsync).toHaveBeenCalled();
    expect(action).toEqual(jsFallbackAction);
  });

  it('falls back directly to JS getBestActionAsync when native module is not available (Expo Go)', async () => {
    const mockGetBestActionNative = vi.fn();
    const mockIsNativeAiAvailable = vi.fn().mockReturnValue(false);
    const jsFallbackAction: GameAction = { type: 'MOVE', to: { row: 6, col: 4 } };
    const mockGetBestActionAsync = vi.fn().mockResolvedValue(jsFallbackAction);

    vi.doMock('react-native', () => ({
      Platform: { OS: 'android' },
    }));

    vi.doMock('duoorb-ai-native', () => ({
      isNativeAiAvailable: mockIsNativeAiAvailable,
      getBestActionNative: mockGetBestActionNative,
    }));

    vi.doMock('@duoorb/game-core', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@duoorb/game-core')>();
      return {
        ...actual,
        getBestActionAsync: mockGetBestActionAsync,
      };
    });

    const { getAiMove } = await import('./aiWorkerClient');
    const action = await getAiMove(initialState, achrefProfile, 12345);

    expect(mockIsNativeAiAvailable).toHaveBeenCalled();
    expect(mockGetBestActionNative).not.toHaveBeenCalled();
    expect(mockGetBestActionAsync).toHaveBeenCalled();
    expect(action).toEqual(jsFallbackAction);
  });

  it('returns null immediately when shouldCancel is triggered', async () => {
    vi.doMock('react-native', () => ({
      Platform: { OS: 'android' },
    }));

    vi.doMock('duoorb-ai-native', () => ({
      isNativeAiAvailable: () => false,
      getBestActionNative: vi.fn(),
    }));

    const { getAiMove } = await import('./aiWorkerClient');
    const action = await getAiMove(initialState, achrefProfile, 12345, {
      shouldCancel: () => true,
    });

    expect(action).toBeNull();
  });

  it('cancelAiSearch clears pending requests without crashing', async () => {
    const { cancelAiSearch } = await import('./aiWorkerClient');
    expect(() => cancelAiSearch()).not.toThrow();
  });

  it('routes to getBotActionNative when botId and native module are present', async () => {
    const mockBotAction = { type: 'MOVE', to: { row: 6, col: 4 } } as GameAction;
    const mockGetBotActionNative = vi.fn().mockResolvedValue(mockBotAction);
    const mockIsNativeAiAvailable = vi.fn().mockReturnValue(true);

    vi.doMock('react-native', () => ({
      Platform: { OS: 'android' },
    }));

    vi.doMock('duoorb-ai-native', () => ({
      isNativeAiAvailable: mockIsNativeAiAvailable,
      getBotActionNative: mockGetBotActionNative,
    }));

    const { getAiMove } = await import('./aiWorkerClient');
    const action = await getAiMove(initialState, achrefProfile, 12345, { botId: 'viktor' });

    expect(mockIsNativeAiAvailable).toHaveBeenCalled();
    expect(mockGetBotActionNative).toHaveBeenCalledWith(initialState, 'viktor', 12345);
    expect(action).toEqual(mockBotAction);
  });

  it('routes to getHintNative when isHint is true and getHintNative is available', async () => {
    const mockHintAction = { type: 'MOVE', to: { row: 6, col: 4 } } as GameAction;
    const mockHintResponse = {
      bestAction: mockHintAction,
      winProbability: 0.88,
      tacticalTag: 'RACE_SPRINT',
      explanation: 'Sprint forward to claim the lead',
      notation: 'e6',
      alternatives: [],
    };
    const mockGetHintNative = vi.fn().mockResolvedValue(mockHintResponse);
    const mockIsNativeAiAvailable = vi.fn().mockReturnValue(true);

    vi.doMock('react-native', () => ({
      Platform: { OS: 'ios' },
    }));

    vi.doMock('duoorb-ai-native', () => ({
      isNativeAiAvailable: mockIsNativeAiAvailable,
      getHintNative: mockGetHintNative,
    }));

    const { getAiMove } = await import('./aiWorkerClient');
    const action = await getAiMove(initialState, achrefProfile, 12345, { isHint: true });

    expect(mockIsNativeAiAvailable).toHaveBeenCalled();
    expect(mockGetHintNative).toHaveBeenCalledWith(initialState);
    expect(action).toEqual(mockHintAction);
  });

  it('routes non-2p modes (4p, center2, race4) to game-core heuristic engine even when native module is available', async () => {
    const state4p = createInitialState({ mode: '4p' });
    const mockGetBotActionNative = vi.fn();
    const mockIsNativeAiAvailable = vi.fn().mockReturnValue(true);
    const jsMove: GameAction = { type: 'MOVE', to: { row: 7, col: 4 } };
    const mockGetBestActionAsync = vi.fn().mockResolvedValue(jsMove);

    vi.doMock('react-native', () => ({
      Platform: { OS: 'android' },
    }));

    vi.doMock('duoorb-ai-native', () => ({
      isNativeAiAvailable: mockIsNativeAiAvailable,
      getBotActionNative: mockGetBotActionNative,
    }));

    vi.doMock('@duoorb/game-core', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@duoorb/game-core')>();
      return {
        ...actual,
        getBestActionAsync: mockGetBestActionAsync,
      };
    });

    const { getAiMove } = await import('./aiWorkerClient');
    const action = await getAiMove(state4p, achrefProfile, 12345, { botId: 'viktor' });

    expect(mockGetBotActionNative).not.toHaveBeenCalled();
    expect(mockGetBestActionAsync).toHaveBeenCalled();
    expect(action).toEqual(jsMove);
  });
});
