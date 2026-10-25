import type {
  GameHistoryItemDto,
  HistorySummaryDto,
} from '../network/apiClient';
import type { SavedGameRecord } from '../storage/gameStorage';

export type HistoryOutcome = 'WIN' | 'LOSS' | 'DRAW';

/**
 * Device-local results use the same seat-id rule as the replay: a real
 * display name can never flip a win into a loss. Pass-and-play has no single
 * "you", so it stays neutral.
 */
export function localHistoryOutcome(game: SavedGameRecord): HistoryOutcome {
  if (game.type !== 'ai' || !game.myPlayerId) return 'DRAW';
  if (!game.winnerId) return 'DRAW';
  return game.winnerId === game.myPlayerId ? 'WIN' : 'LOSS';
}

/**
 * Adapt a stored device game to the row DTO. Local games are honestly
 * unrated; the AI persona (when one was used) supplies the opponent label.
 */
export function mapLocalGameToHistoryItem(
  game: SavedGameRecord
): GameHistoryItemDto {
  const isAi = game.type === 'ai';
  const aiSeat = isAi
    ? game.initialState?.players?.find((p) => p.id !== game.myPlayerId)
    : undefined;
  const opponentName =
    game.botName ??
    aiSeat?.displayName ??
    (isAi ? 'AI' : game.winnerName || 'Player');
  return {
    gameId: game.id,
    mode: game.mode,
    status: 'COMPLETED',
    isRanked: false,
    timeControlMinutes: game.timeControlMinutes ?? 0,
    incrementSeconds: game.incrementSeconds ?? 0,
    outcome: localHistoryOutcome(game),
    endedReason: game.endedReason ?? 'GOAL',
    endedAt: new Date(game.date).toISOString(),
    durationMs: Math.max(0, (game.durationSeconds || 0) * 1000),
    myRating: { before: null, after: null, delta: 0 },
    opponent: {
      // A device-local game has no account behind the opponent. An empty id
      // keeps the result modal's View Profile action correctly hidden.
      userId: '',
      username: opponentName,
      displayName: opponentName,
      ratingBefore: game.botRating ?? null,
      ratingAfter: null,
    },
  };
}

/** Newest-first, server rows win when the same game appears on both sides. */
export function mergeHistoryItems(
  serverGames: GameHistoryItemDto[],
  localGames: GameHistoryItemDto[]
): GameHistoryItemDto[] {
  const byId = new Map<string, GameHistoryItemDto>();
  for (const game of localGames) byId.set(game.gameId, game);
  for (const game of serverGames) byId.set(game.gameId, game);
  return [...byId.values()].sort(
    (a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime()
  );
}

/** AI + pass-and-play games only; online games are represented by the server. */
export function deviceHistoryGames(
  games: SavedGameRecord[]
): SavedGameRecord[] {
  return games.filter((g) => g.type !== 'online');
}

export function summarizeDeviceHistory(
  games: SavedGameRecord[]
): HistorySummaryDto {
  const device = deviceHistoryGames(games);
  let wins = 0;
  let losses = 0;
  for (const game of device) {
    const outcome = localHistoryOutcome(game);
    if (outcome === 'WIN') wins++;
    else if (outcome === 'LOSS') losses++;
  }
  return { total: device.length, wins, losses };
}

/** Lifetime server totals + every device game, with no double counting. */
export function combineHistorySummary(
  serverSummary: HistorySummaryDto | null | undefined,
  deviceGames: SavedGameRecord[]
): HistorySummaryDto {
  const local = summarizeDeviceHistory(deviceGames);
  return {
    total: (serverSummary?.total ?? 0) + local.total,
    wins: (serverSummary?.wins ?? 0) + local.wins,
    losses: (serverSummary?.losses ?? 0) + local.losses,
  };
}
