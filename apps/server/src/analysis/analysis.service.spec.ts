import { describe, it, expect, vi } from 'vitest';
import { AnalysisService } from './analysis.service.js';
import { createInitialState, applyAction } from '@duoorb/game-core';

describe('AnalysisService', () => {
  it('analyzes a game using the native Rust engine', async () => {
    const mockPrisma: any = {
      isConnected: false,
      gameAnalysis: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
    };

    const service = new AnalysisService(mockPrisma);

    let state = createInitialState({ mode: '2p' });
    const movesToPlay = [
      { type: 'MOVE' as const, to: { row: 7, col: 4 } },
      { type: 'MOVE' as const, to: { row: 1, col: 4 } },
      { type: 'MOVE' as const, to: { row: 6, col: 4 } },
      { type: 'MOVE' as const, to: { row: 2, col: 4 } },
    ];

    const history: any[] = [];
    for (const act of movesToPlay) {
      const p = state.players[state.currentPlayerIndex];
      const res = applyAction(state, act, { actorId: p.id, timestamp: Date.now() });
      if (!res.success) {
        throw new Error('Action failed');
      }
      state = res.state;
      history.push(res.state.lastMove);
    }

    const review = await service.reviewGame(createInitialState({ mode: '2p' }), history);

    expect(review).toBeDefined();
    expect(review.totalMoves).toBe(4);
    expect(review.moveAnalyses.length).toBe(4);
    expect(review.summary).toBeDefined();
    expect(review.engineVersion).toBe('duoorb-rust-mcts-2.0');
  });

  it('serves cached review when present in database', async () => {
    const cachedReview: any = {
      gameId: 'test-game',
      totalMoves: 2,
      moveAnalyses: [],
      summary: { confidence: 'high' },
      engineVersion: 'duoorb-rust-1.0',
    };

    const mockPrisma: any = {
      isConnected: true,
      gameAnalysis: {
        findUnique: vi.fn().mockResolvedValue({
          gameId: 'test-game',
          reviewData: cachedReview,
        }),
      },
    };

    const service = new AnalysisService(mockPrisma);
    const result = await service.getCachedReview('test-game');
    expect(result).toEqual(cachedReview);
    expect(mockPrisma.gameAnalysis.findUnique).toHaveBeenCalledWith({
      where: { gameId: 'test-game' },
    });
  });
});
