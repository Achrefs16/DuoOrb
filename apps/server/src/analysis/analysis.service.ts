import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import {
  createInitialState,
  type GameMode,
  type GameReview,
  type GameState,
  type RecordedAction,
} from '@duoorb/game-core';

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  /** Bump together with client-side analysis version. */
  private static readonly ANALYSIS_VERSION = 'analysis-3.3';

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Match review service.
   * Serves cached analyses from the database when available.
   * Active analysis is computed directly on client devices (native Android / WebAssembly).
   */
  async reviewGame(
    initialState?: GameState,
    history?: RecordedAction[],
    providedGameId?: string,
    providedMode?: GameMode
  ): Promise<GameReview> {
    let safeHistory: RecordedAction[] = Array.isArray(history) ? history : [];
    let safeState: GameState | undefined = initialState;

    let gameId =
      providedGameId ||
      safeState?.gameId ||
      (safeHistory.length > 0 ? (safeHistory[0] as any)?.gameId : null) ||
      `game-${Date.now()}`;

    // 1. Check database cache if connected
    if (this.prisma.isConnected && gameId) {
      try {
        const cached = await this.prisma.gameAnalysis.findUnique({
          where: { gameId },
        });
        if (
          cached &&
          cached.reviewData &&
          cached.analysisVersion === AnalysisService.ANALYSIS_VERSION
        ) {
          this.logger.debug(`Cache hit for game review: ${gameId}`);
          return cached.reviewData as unknown as GameReview;
        }
        if (cached && cached.reviewData) {
          this.logger.debug(
            `Stale analysis cache for ${gameId} (${cached.analysisVersion}); recomputing`
          );
        }
      } catch (err: any) {
        this.logger.warn(`Failed reading analysis cache for ${gameId}: ${err.message}`);
      }
    }

    // 2. Synthesize initial state if absent
    if (!safeState || !Array.isArray(safeState.players) || safeState.players.length === 0) {
      const playerIds = new Set(safeHistory.map((h) => h.playerId));
      const mode: GameMode =
        providedMode || (playerIds.size > 2 ? '4p' : '2p');
      safeState = createInitialState({
        gameId,
        mode,
      });
    }

    // Game Review is exclusively supported for Classic 2-Player (2p)
    if (safeState.mode !== '2p') {
      this.logger.log(`Analysis skipped for unsupported mode "${safeState.mode}" in game ${gameId}`);
      return {
        gameId,
        mode: safeState.mode,
        totalMoves: 0,
        accuracies: {},
        moveAnalyses: [],
        winChanceHistory: [],
        criticalMoments: [],
        decidingMoments: [],
        summary: {
          keyLesson: {
            title: 'Classic 2P Only',
            detail: 'Comprehensive Game Review is exclusively supported for Classic 2-Player matches.',
          },
          confidence: 'unsupported',
        },
        engineVersion: 'client-native',
        analysisVersion: AnalysisService.ANALYSIS_VERSION,
      } as unknown as GameReview;
    }

    // 3. Client devices (Android native & Web WASM) execute the neural/MCTS engine locally.
    // The server returns a lightweight review response and can store it in the database cache.
    const review: GameReview = {
      gameId,
      mode: safeState.mode,
      totalMoves: safeHistory.length,
      accuracies: {},
      moveAnalyses: [],
      winChanceHistory: [],
      criticalMoments: [],
      decidingMoments: [],
      summary: {
        keyLesson: {
          title: 'Client-Side Analysis',
          detail: 'Game analysis is performed directly on-device via native AI engine.',
        },
        confidence: 'low',
      },
      engineVersion: 'client-native',
      analysisVersion: AnalysisService.ANALYSIS_VERSION,
    } as unknown as GameReview;

    if (this.prisma.isConnected) {
      this.prisma.gameAnalysis
        .upsert({
          where: { gameId },
          create: {
            gameId,
            engineVersion: review.engineVersion ?? 'client-native',
            analysisVersion: AnalysisService.ANALYSIS_VERSION,
            totalMoves: review.totalMoves,
            winnerId: review.winnerId ?? null,
            reviewData: review as any,
          },
          update: {
            engineVersion: review.engineVersion ?? 'client-native',
            analysisVersion: AnalysisService.ANALYSIS_VERSION,
            reviewData: review as any,
          },
        })
        .catch((err: any) => {
          this.logger.warn(`Failed writing analysis cache for ${gameId}: ${err.message}`);
        });
    }

    return review;
  }

  /**
   * Retrieve a previously generated analysis from the cache.
   */
  async getCachedReview(gameId: string): Promise<GameReview> {
    if (!this.prisma.isConnected) {
      throw new NotFoundException('Analysis cache unavailable: database disconnected');
    }

    const record = await this.prisma.gameAnalysis.findUnique({
      where: { gameId },
    });

    if (!record || !record.reviewData) {
      throw new NotFoundException(`No analysis found for game ${gameId}`);
    }

    if (record.analysisVersion !== AnalysisService.ANALYSIS_VERSION) {
      throw new NotFoundException(
        `Analysis for game ${gameId} is outdated; request a fresh review`
      );
    }

    return record.reviewData as unknown as GameReview;
  }
}
