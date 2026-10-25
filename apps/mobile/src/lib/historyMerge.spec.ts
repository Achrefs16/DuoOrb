import { describe, expect, it } from 'vitest';
import { createInitialState } from '@duoorb/game-core';
import type { GameHistoryItemDto } from '../network/apiClient';
import type { SavedGameRecord } from '../storage/gameStorage';
import {
  combineHistorySummary,
  localHistoryOutcome,
  mapLocalGameToHistoryItem,
  mergeHistoryItems,
  summarizeDeviceHistory,
} from './historyMerge';

function savedGame(
  id: string,
  type: SavedGameRecord['type'],
  winnerId: string | null,
  date = 1_700_000_000_000
): SavedGameRecord {
  const state = createInitialState({
    gameId: id,
    mode: '2p',
    playerNames: ['You', 'Bot'],
  });
  return {
    id,
    date,
    mode: '2p',
    type,
    winnerId,
    winnerName: winnerId === state.players[0].id ? 'You' : 'Bot',
    myPlayerId: type === 'ai' ? state.players[0].id : null,
    totalMoves: 4,
    durationSeconds: 30,
    initialState: state,
    history: [],
  };
}

function serverGame(id: string, endedAt: number): GameHistoryItemDto {
  return {
    gameId: id,
    mode: '2p',
    status: 'COMPLETED',
    isRanked: true,
    timeControlMinutes: 3,
    incrementSeconds: 0,
    outcome: 'WIN',
    endedAt: new Date(endedAt).toISOString(),
    durationMs: 20_000,
    myRating: { before: 1500, after: 1510, delta: 10 },
    opponent: {
      userId: 'u2',
      username: 'Rival',
      displayName: 'Rival',
      ratingBefore: 1490,
      ratingAfter: 1480,
    },
  };
}

describe('device history merge', () => {
  it('decides local AI results by seat id, not display name', () => {
    const state = createInitialState({ mode: '2p', playerNames: ['Real Name', 'Bot'] });
    expect(
      localHistoryOutcome(
        savedGame('win', 'ai', state.players[0].id)
      )
    ).toBe('WIN');
    expect(
      localHistoryOutcome(
        savedGame('loss', 'ai', state.players[1].id)
      )
    ).toBe('LOSS');
    expect(localHistoryOutcome(savedGame('local', 'local', null))).toBe('DRAW');
  });

  it('maps AI metadata and keeps local games unrated', () => {
    const game = savedGame('ai-1', 'ai', null);
    game.botId = 'pip';
    game.botName = 'Pip';
    game.botRating = 900;
    game.timeControlMinutes = 5;
    game.incrementSeconds = 3;
    const item = mapLocalGameToHistoryItem(game);
    expect(item.opponent?.displayName).toBe('Pip');
    expect(item.opponent?.ratingBefore).toBe(900);
    expect(item.isRanked).toBe(false);
    expect(item.timeControlMinutes).toBe(5);
    expect(item.incrementSeconds).toBe(3);
    expect(item.outcome).toBe('DRAW');
  });

  it('merges server and device rows newest-first and deduplicates by game id', () => {
    const local = mapLocalGameToHistoryItem(
      savedGame('local-1', 'ai', null, 1_700_000_100_000)
    );
    const server = serverGame('online-1', 1_700_000_200_000);
    const duplicateLocal = { ...local, gameId: 'online-1', outcome: 'LOSS' as const };
    const merged = mergeHistoryItems([server], [local, duplicateLocal]);
    expect(merged.map((g) => g.gameId)).toEqual(['online-1', 'local-1']);
    expect(merged[0].outcome).toBe('WIN');
  });

  it('combines lifetime server totals with device results only once', () => {
    const state = createInitialState({ mode: '2p', playerNames: ['You', 'Bot'] });
    const localGames = [
      savedGame('win', 'ai', state.players[0].id),
      savedGame('loss', 'ai', state.players[1].id),
      savedGame('pass', 'local', null),
      savedGame('online-local-copy', 'online', state.players[0].id),
    ];
    expect(summarizeDeviceHistory(localGames)).toEqual({ total: 3, wins: 1, losses: 1 });
    expect(
      combineHistorySummary({ total: 10, wins: 6, losses: 4 }, localGames)
    ).toEqual({ total: 13, wins: 7, losses: 5 });
  });
});
