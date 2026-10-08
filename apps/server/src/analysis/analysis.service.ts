import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { analyzeGameAsync } from '@duoorb/analyzer-rust';
import type { GameReview, GameState, RecordedAction } from '@duoorb/game-core';

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * High-performance asynchronous game analysis powered by the native Rust engine.
   * Utilizes background OS threads so Node.js and real-time WebSockets remain unblocked.
   * Caches results in PostgreSQL when the database is available.
   */
  async reviewGame(
    initialState: GameState,
    history: RecordedAction[]
  ): Promise<GameReview> {
    const gameId = initialState.gameId || `temp-${Date.now()}`;

    // 1. Check database cache if connected
    if (this.prisma.isConnected) {
      try {
        const cached = await this.prisma.gameAnalysis.findUnique({
          where: { gameId },
        });
        if (cached && cached.reviewData) {
          this.logger.debug(`Cache hit for game review: ${gameId}`);
          return cached.reviewData as unknown as GameReview;
        }
      } catch (err: any) {
        this.logger.warn(`Failed reading analysis cache for ${gameId}: ${err.message}`);
      }
    }

    // 2. Compute analysis asynchronously in Rust via NAPI worker thread
    const startTime = performance.now();
    const review = await analyzeGameAsync(initialState, history);
    const durationMs = (performance.now() - startTime).toFixed(2);
    this.logger.log(`Analyzed game ${gameId} (${history.length} moves) in ${durationMs}ms via Rust engine`);

    // 3. Persist to database cache in background if connected
    if (this.prisma.isConnected) {
      this.prisma.gameAnalysis
        .upsert({
          where: { gameId },
          create: {
            gameId,
            engineVersion: review.engineVersion ?? 'duoorb-rust-1.0',
            analysisVersion: review.analysisVersion ?? 'analysis-1.0',
            totalMoves: review.totalMoves,
            winnerId: review.winnerId ?? null,
            reviewData: review as any,
          },
          update: {
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

    return record.reviewData as unknown as GameReview;
  }
}
