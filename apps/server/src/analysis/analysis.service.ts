import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { analyzeGameAsync } from '@duoorb/analyzer-rust';
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

  constructor(private readonly prisma: PrismaService) {}

  /**
   * High-performance asynchronous game analysis powered by the native Rust engine.
   * Utilizes background OS threads so Node.js and real-time WebSockets remain unblocked.
   * Caches results in PostgreSQL when the database is available.
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
        if (cached && cached.reviewData) {
          this.logger.debug(`Cache hit for game review: ${gameId}`);
          return cached.reviewData as unknown as GameReview;
        }
      } catch (err: any) {
        this.logger.warn(`Failed reading analysis cache for ${gameId}: ${err.message}`);
      }
    }

    // 2. If initial state or history is missing and we have a database connection,
    // attempt to reconstruct the match from the online game history table
    if (this.prisma.isConnected && gameId && (!safeState || safeHistory.length === 0)) {
      try {
        const dbGame = await this.prisma.game.findUnique({
          where: { id: gameId },
          include: {
            players: {
              include: { user: { include: { profile: true } } },
            },
            moves: {
              orderBy: { sequence: 'asc' },
            },
          },
        });
        if (dbGame) {
          if (!safeState) {
            safeState = createInitialState({
              gameId: dbGame.id,
              mode: dbGame.mode as GameMode,
              playerNames: dbGame.players.map(
                (p) => p.user?.profile?.displayName || `Player ${p.playerIndex + 1}`
              ),
            });
          }
          if (safeHistory.length === 0 && dbGame.moves.length > 0) {
            safeHistory = dbGame.moves.map((m) => ({
              sequence: m.sequence,
              playerId: `p${m.playerIndex + 1}`,
              action: m.payload as any,
              timestamp: Number(m.serverTimestamp),
            }));
          }
        }
      } catch (err: any) {
        this.logger.warn(`Failed fetching game history for ${gameId}: ${err.message}`);
      }
    }

    // 3. Synthesize initial state if still absent (e.g. from local/AI/old offline games)
    if (!safeState || !Array.isArray(safeState.players) || safeState.players.length === 0) {
      const playerIds = new Set(safeHistory.map((h) => h.playerId));
      const mode: GameMode =
        providedMode || (playerIds.size > 2 ? '4p' : '2p');
      safeState = createInitialState({
        gameId,
        mode,
      });
    }

    // 4. Compute analysis asynchronously in Rust via NAPI worker thread
    const startTime = performance.now();
    const rawReview = await analyzeGameAsync(safeState, safeHistory);
    const durationMs = (performance.now() - startTime).toFixed(2);
    this.logger.log(`Analyzed game ${gameId} (${safeHistory.length} moves) in ${durationMs}ms via Rust engine`);

    // Normalize and alias fields so mobile UI receives both canonical and UI-convenience shapes
    const normalizedMoves = (rawReview.moveAnalyses || []).map((m: any) => {
      const act = m.playedAction ?? m.action;
      const evalVal = m.evaluationAfter ?? m.evaluation ?? 0;
      const winVal = m.winChanceAfter ?? m.winChance ?? 0.5;
      return {
        ...m,
        action: act,
        playedAction: act,
        evaluation: evalVal,
        evaluationAfter: evalVal,
        winChance: winVal,
        winChanceAfter: winVal,
      };
    });

    const winChanceHistory = normalizedMoves.map((m: any, idx: number) => ({
      step: m.step ?? idx + 1,
      winChance: m.winChance,
    }));

    const decidingMoments = (rawReview.criticalMoments ?? []).map((step: number) => ({
      moveNumber: step,
      playerId: normalizedMoves[step - 1]?.playerId ?? 'p1',
      reason: 'SWING' as const,
      beforeWinChance: normalizedMoves[step - 2]?.winChance ?? 0.5,
      afterWinChance: normalizedMoves[step - 1]?.winChance ?? 0.5,
      evaluationSwing: normalizedMoves[step - 1]?.evaluationLoss ?? 0,
      raceSwing: 0,
      importance: 1,
    }));

    const review: GameReview = {
      ...rawReview,
      moveAnalyses: normalizedMoves,
      winChanceHistory,
      decidingMoments,
    };

    // 5. Persist to database cache in background if connected
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
