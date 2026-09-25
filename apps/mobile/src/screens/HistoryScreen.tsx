import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { createInitialState } from '@duoorb/game-core';
import { THEME } from '../theme';
import { api, GameHistoryItemDto } from '../network/apiClient';
import { LoadingState, EmptyState, ErrorState } from '../components/StateViews';
import { SavedGameRecord, loadGameHistory } from '../storage/gameStorage';

interface HistoryScreenProps {
  onBack: () => void;
  onSelectGame: (game: SavedGameRecord) => void;
  onQuickMatch: () => void;
}

type OutcomeFilter = 'ALL' | 'WINS' | 'LOSSES';

function modeDisplayName(mode: string): string {
  if (mode === '2p') return 'Classic (9×9)';
  if (mode === '4p' || mode === 'center2' || mode === 'center3') return 'Center Rush';
  if (mode.startsWith('race')) return 'Race';
  return mode;
}

const PAGE_SIZE = 10;

export const HistoryScreen: React.FC<HistoryScreenProps> = ({
  onBack,
  onSelectGame,
  onQuickMatch,
}) => {
  const [games, setGames] = useState<GameHistoryItemDto[]>([]);
  const [localGames, setLocalGames] = useState<SavedGameRecord[]>([]);
  const [filter, setFilter] = useState<OutcomeFilter>('ALL');
  const [selected, setSelected] = useState<GameHistoryItemDto | null>(null);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<{ total: number; wins: number; losses: number } | null>(null);
  const [liveRating, setLiveRating] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const offsetRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const savedLocal = await loadGameHistory();
      setLocalGames(savedLocal);

      const [meRes, serverRes] = await Promise.all([
        api.getMe().catch(() => null),
        api.getMyHistory(PAGE_SIZE, 0).catch(() => null),
      ]);
      const r = meRes?.ratings?.CLASSIC_1V1?.rating;
      if (typeof r === 'number') setLiveRating(Math.round(r));
        if (serverRes && serverRes.games.length > 0) {
          setGames([...serverRes.games].sort((a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime()));
          offsetRef.current = serverRes.games.length;
          setTotal(serverRes.total);
          setSummary(serverRes.summary ?? null);
        } else {
          // Offline fallback: local device games only, honestly unrated.
          const mapped: GameHistoryItemDto[] = savedLocal.map((lg) => ({
          gameId: lg.id,
          mode: lg.mode,
          status: 'COMPLETED',
          isRanked: false,
          timeControlMinutes: 3,
          incrementSeconds: 2,
          outcome: (lg.winnerName === 'You' ? 'WIN' : 'LOSS') as 'WIN' | 'LOSS',
          endedAt: new Date(lg.date).toISOString(),
          durationMs: (lg.durationSeconds || 0) * 1000,
          myRating: { before: null, after: null, delta: 0 },
          opponent: {
            userId: 'local',
            username: lg.winnerName === 'You' ? 'AI' : lg.winnerName,
            displayName: lg.winnerName === 'You' ? 'AI' : lg.winnerName,
            ratingBefore: null,
            ratingAfter: null,
          },
        }));
        setGames(mapped);
        offsetRef.current = mapped.length;
        setTotal(mapped.length);
      }
    } catch {
      setError('Unable to load history.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Next page — appended to the list, never reloaded.
  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const serverRes = await api.getMyHistory(PAGE_SIZE, offsetRef.current).catch(() => null);
      if (serverRes) {
        setGames((prev) =>
          [...prev, ...serverRes.games].sort((a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime())
        );
        offsetRef.current += serverRes.games.length;
        setTotal(serverRes.total);
      }
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleGameSelect = (gameItem: GameHistoryItemDto) => {
    const localMatch = localGames.find((lg) => lg.id === gameItem.gameId);
    if (localMatch) {
      onSelectGame(localMatch);
      return;
    }

    api.getGameReplay(gameItem.gameId)
      .then((replay) => {
        if (replay) {
          const initial = createInitialState({
            gameId: replay.gameId,
            mode: replay.mode,
            playerNames: replay.players.map((p: any) => p.displayName),
          });
          const record: SavedGameRecord = {
            id: replay.gameId,
            date: new Date(replay.endedAt).getTime(),
            mode: replay.mode,
            type: 'online',
            winnerId: replay.winnerId,
            winnerName: replay.players.find((p: any) => p.isWinner)?.displayName ?? 'Winner',
            totalMoves: replay.moves.length,
            durationSeconds: Math.floor(
              (new Date(replay.endedAt).getTime() - new Date(replay.startedAt || replay.endedAt).getTime()) / 1000
            ),
            initialState: initial,
            history: replay.moves.map((m: any) => ({
              sequence: m.sequence,
              playerId: `p${m.playerIndex + 1}`,
              action: m.payload,
              timestamp: m.serverTimestamp,
            })),
          };
          onSelectGame(record);
        }
      })
      .catch(() => {});
  };

  // Stats computation — lifetime summary from the server when present
  // (accurate over ALL matches, not just the loaded page).
  const totalMatches = summary?.total ?? games.length;
  const totalWins = summary?.wins ?? games.filter((g) => g.outcome === 'WIN').length;
  const totalLosses = summary?.losses ?? games.filter((g) => g.outcome === 'LOSS').length;
  const winRate = totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0;
  const currentRating =
    liveRating ??
    games.find((g) => g.myRating?.after !== undefined && g.myRating?.after !== null)?.myRating
      ?.after ??
    1500;

  // Filtered list
  const filteredGames = games.filter((g) => {
    if (filter === 'WINS') return g.outcome === 'WIN';
    if (filter === 'LOSSES') return g.outcome === 'LOSS';
    return true;
  });

  const renderMatchCard = ({ item }: { item: GameHistoryItemDto }) => {
    const isWin = item.outcome === 'WIN';
    const delta = item.myRating?.delta ?? 0;
    const opponentName = item.opponent?.displayName || item.opponent?.username || 'Opponent';
    const opponentRating = item.opponent?.ratingBefore ?? item.opponent?.ratingAfter;

    return (
      <TouchableOpacity
        style={styles.matchCard}
        activeOpacity={0.75}
        onPress={() => setSelected(item)}
      >
        <View style={styles.cardLeft}>
          <View style={[styles.resultBadge, isWin ? styles.badgeWin : styles.badgeLoss]}>
            <Text style={[styles.resultBadgeText, isWin ? styles.textWin : styles.textLoss]}>
              {isWin ? 'W' : 'L'}
            </Text>
          </View>

          <View style={styles.cardInfo}>
            <View style={styles.opponentRow}>
              <Text style={styles.vsText} numberOfLines={1}>vs {opponentName}</Text>
              {opponentRating !== undefined && opponentRating !== null && (
                <Text style={styles.ratingText}>· {Math.round(opponentRating)}</Text>
              )}
            </View>
            <Text style={styles.modeText}>
              {item.isRanked ? 'Ranked' : 'Practice'} · {modeDisplayName(item.mode)}
            </Text>
          </View>
        </View>

        <View style={styles.cardRight}>
          {item.isRanked ? (
            <Text style={[styles.deltaText, delta >= 0 ? styles.deltaWin : styles.deltaLoss]}>
              {delta >= 0 ? `+${Math.round(delta)}` : `${Math.round(delta)}`}
            </Text>
          ) : (
            <Text style={styles.unratedText}>Unrated</Text>
          )}
          <Feather name="chevron-right" size={18} color={THEME.colors.outlineVariant} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
        <TouchableOpacity style={styles.filterIconButton} activeOpacity={0.7}>
          <Feather name="filter" size={18} color={THEME.colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <LoadingState message="Loading match history…" />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchHistory} />
      ) : (
        <FlatList
          data={filteredGames}
          keyExtractor={(item) => item.gameId}
          renderItem={renderMatchCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.headerComponent}>
              {/* Spacious Performance Summary Card */}
              <View style={styles.summaryCard}>
                <View style={styles.summaryRowTop}>
                  <View style={styles.summaryStatBox}>
                    <Text style={styles.statLabel}>MATCHES</Text>
                    <Text style={styles.statValue}>{totalMatches}</Text>
                  </View>
                  <View style={[styles.summaryStatBox, styles.statBorderHorizontal]}>
                    <Text style={styles.statLabel}>WINS</Text>
                    <Text style={[styles.statValue, { color: THEME.colors.tertiary }]}>{totalWins}</Text>
                  </View>
                  <View style={styles.summaryStatBox}>
                    <Text style={styles.statLabel}>LOSSES</Text>
                    <Text style={[styles.statValue, { color: THEME.colors.secondary }]}>{totalLosses}</Text>
                  </View>
                </View>

                <View style={styles.summaryRowBottom}>
                  <View style={styles.summaryStatBox}>
                    <Text style={styles.statLabel}>WIN RATE</Text>
                    <Text style={styles.statValue}>{winRate}%</Text>
                  </View>
                  <View style={styles.summaryStatBox}>
                    <Text style={styles.statLabel}>CURRENT RATING</Text>
                    <Text style={[styles.statValue, { color: THEME.colors.primary }]}>{currentRating}</Text>
                  </View>
                </View>
              </View>

              {/* Filter Pills */}
              <View style={styles.filterPillsRow}>
                <TouchableOpacity
                  style={[styles.filterPill, filter === 'ALL' && styles.filterPillActive]}
                  onPress={() => setFilter('ALL')}
                >
                  <Text style={[styles.filterPillText, filter === 'ALL' && styles.filterPillTextActive]}>
                    All
                  </Text>
                  <Text style={[styles.filterPillCount, filter === 'ALL' && styles.filterPillCountActive]}>
                    {totalMatches}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.filterPill, filter === 'WINS' && styles.filterPillActive]}
                  onPress={() => setFilter('WINS')}
                >
                  <Text style={[styles.filterPillText, filter === 'WINS' && styles.filterPillTextActive]}>
                    Wins
                  </Text>
                  <Text style={[styles.filterPillCount, { color: THEME.colors.tertiary }]}>
                    {totalWins}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.filterPill, filter === 'LOSSES' && styles.filterPillActive]}
                  onPress={() => setFilter('LOSSES')}
                >
                  <Text style={[styles.filterPillText, filter === 'LOSSES' && styles.filterPillTextActive]}>
                    Losses
                  </Text>
                  <Text style={[styles.filterPillCount, { color: THEME.colors.secondary }]}>
                    {totalLosses}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="clock" size={36} color={THEME.colors.textMuted} />
              <Text style={styles.emptyTitle}>No matches recorded</Text>
              <Text style={styles.emptySub}>Play your first match to see your tactical history.</Text>
              <TouchableOpacity
                style={styles.quickMatchBtn}
                activeOpacity={0.8}
                onPress={onQuickMatch}
              >
                <Text style={styles.quickMatchBtnText}>Play Now</Text>
              </TouchableOpacity>
            </View>
          }
          ListFooterComponent={
            games.length > 0 && games.length < total ? (
              <TouchableOpacity
                style={[styles.loadMoreBtn, loadingMore && styles.loadMoreBtnBusy]}
                activeOpacity={0.8}
                disabled={loadingMore}
                onPress={() => void loadMore()}
              >
                <Text style={styles.loadMoreText}>
                  {loadingMore ? 'Loading…' : `Load more (${games.length}/${total})`}
                </Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}

      {/* Match detail modal (Stitch) */}
      <Modal visible={!!selected} transparent animationType="fade">
        <View style={styles.detailOverlay}>
          <View style={styles.detailCard}>
            {selected && (() => {
              const isWin = selected.outcome === 'WIN';
              const isDraw = selected.outcome === 'DRAW';
              const opp = selected.opponent?.displayName || selected.opponent?.username || 'Opponent';
              const oppRating = selected.opponent?.ratingBefore ?? selected.opponent?.ratingAfter;
              const delta = selected.myRating?.delta ?? 0;
              return (
                <>
                  <TouchableOpacity
                    style={styles.detailClose}
                    onPress={() => setSelected(null)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather name="x" size={20} color={THEME.colors.textMuted} />
                  </TouchableOpacity>
                  <Text style={styles.detailOutcome}>
                    {isDraw ? 'Draw' : isWin ? 'Victory' : 'Defeat'}
                  </Text>
                  <Text style={styles.detailVs}>
                    vs {opp}
                    {oppRating !== undefined && oppRating !== null ? ` · ${Math.round(oppRating)}` : ''}
                  </Text>
                  <View style={styles.detailRows}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Mode</Text>
                      <Text style={styles.detailValue}>
                        {selected.isRanked ? 'Ranked' : 'Practice'} · {modeDisplayName(selected.mode)}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Rating Change</Text>
                      {selected.isRanked ? (
                        <Text style={[styles.detailValue, delta >= 0 ? styles.deltaWin : styles.deltaLoss]}>
                          {delta >= 0 ? `+${Math.round(delta)}` : `${Math.round(delta)}`} Rating
                        </Text>
                      ) : (
                        <Text style={styles.detailValue}>Unrated</Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.detailActions}>
                    <TouchableOpacity
                      style={styles.detailReplay}
                      onPress={() => {
                        const item = selected;
                        setSelected(null);
                        handleGameSelect(item);
                      }}
                    >
                      <Text style={styles.detailReplayText}>Replay</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.detailDone}
                      onPress={() => setSelected(null)}
                    >
                      <Text style={styles.detailDoneText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  header: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.colors.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.surfaceContainer,
  },
  title: {
    fontFamily: THEME.fonts.bold,
    fontSize: 22,
    fontWeight: '700',
    color: THEME.colors.onSurface,
  },
  filterIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
    gap: 8,
  },
  headerComponent: {
    marginBottom: 8,
  },
  summaryCard: {
    backgroundColor: THEME.colors.surfaceContainerLowest,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceContainer,
    padding: 16,
    marginBottom: 14,
    ...THEME.shadows.card,
  },
  summaryRowTop: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.surfaceContainerLow,
    paddingBottom: 12,
    marginBottom: 12,
  },
  summaryRowBottom: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryStatBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statBorderHorizontal: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: THEME.colors.surfaceContainerLow,
  },
  statLabel: {
    fontFamily: THEME.fonts.bold,
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    letterSpacing: 0.8,
  },
  statValue: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 20,
    fontWeight: '800',
    color: THEME.colors.onSurface,
    marginTop: 4,
  },
  filterPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.surfaceContainerLow,
  },
  filterPillActive: {
    backgroundColor: THEME.colors.inverseSurface,
  },
  filterPillText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.onSurfaceVariant,
  },
  filterPillTextActive: {
    color: THEME.colors.inverseOnSurface,
  },
  filterPillCount: {
    fontFamily: THEME.fonts.bold,
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: THEME.colors.textMuted,
  },
  filterPillCountActive: {
    color: 'rgba(238, 240, 255, 0.8)',
  },
  matchCard: {
    backgroundColor: THEME.colors.surfaceContainerLowest,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceContainer,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...THEME.shadows.card,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  resultBadge: {
    width: 38,
    height: 38,
    borderRadius: THEME.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeWin: {
    backgroundColor: THEME.colors.tertiaryLight,
  },
  badgeLoss: {
    backgroundColor: THEME.colors.secondaryContainer,
  },
  resultBadgeText: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 16,
    fontWeight: '800',
  },
  textWin: {
    color: THEME.colors.tertiary,
  },
  textLoss: {
    color: THEME.colors.secondary,
  },
  cardInfo: {
    flex: 1,
    gap: 2,
  },
  opponentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  vsText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.onSurface,
    maxWidth: 130,
  },
  ratingText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  modeText: {
    fontFamily: THEME.fonts.regular,
    fontSize: 11,
    color: THEME.colors.onSurfaceVariant,
  },
  cardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deltaText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  deltaWin: {
    color: THEME.colors.tertiary,
  },
  deltaLoss: {
    color: THEME.colors.secondary,
  },
  unratedText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  detailOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  detailCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: THEME.colors.surfaceContainerLowest,
    borderRadius: THEME.radius.xl,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceContainer,
    padding: 20,
    alignItems: 'center',
    ...THEME.shadows.modal,
  },
  detailClose: {
    alignSelf: 'flex-end',
    padding: 4,
    marginBottom: 4,
  },
  detailOutcome: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 22,
    fontWeight: '800',
    color: THEME.colors.onSurface,
  },
  detailVs: {
    fontFamily: THEME.fonts.medium,
    fontSize: 13,
    fontWeight: '500',
    color: THEME.colors.onSurfaceVariant,
    marginTop: 4,
    marginBottom: 16,
  },
  detailRows: {
    width: '100%',
    gap: 10,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  detailValue: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.onSurface,
  },
  detailActions: {
    width: '100%',
    gap: 8,
  },
  detailReplay: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.surfaceContainerLow,
    alignItems: 'center',
  },
  detailReplayText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.onSurface,
  },
  detailDone: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
  },
  detailDoneText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: THEME.fonts.bold,
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.onSurface,
    marginTop: 8,
  },
  emptySub: {
    fontFamily: THEME.fonts.regular,
    fontSize: 12,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    maxWidth: 240,
  },
  quickMatchBtn: {
    marginTop: 12,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.primary,
  },
  quickMatchBtnText: {
    fontFamily: THEME.fonts.bold,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  loadMoreBtn: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceContainer,
    alignItems: 'center',
    ...THEME.shadows.card,
  },
  loadMoreBtnBusy: {
    opacity: 0.6,
  },
  loadMoreText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.onSurface,
    fontVariant: ['tabular-nums'],
  },
});
