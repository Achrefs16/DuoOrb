import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { createInitialState } from '@duoorb/game-core';
import { THEME } from '../theme';
import { modeDisplayName } from '../matchModes';
import { api, GameHistoryItemDto } from '../network/apiClient';
import { useSession } from '../network/session';
import { useConnectivity } from '../network/useConnectivity';
import { GuestGate } from '../components/GuestGate';
import { toast } from '../components/AppToast';
import { NoConnectionSection } from '../components/NoConnection';
import { kindOf, loadMessage, sectionKind, type ErrorKind } from '../network/errors';
import { HistorySkeleton } from '../components/Skeleton';
import { MatchResultModal } from '../components/MatchResultModal';
import { SavedGameRecord, loadGameHistory } from '../storage/gameStorage';

interface HistoryScreenProps {
  onBack: () => void;
  onSelectGame: (game: SavedGameRecord) => void;
  onQuickMatch: () => void;
  /** Opens the shared player profile for a listed opponent. */
  onOpenPlayerProfile?: (player: { userId: string; username: string }) => void;
}

type OutcomeFilter = 'ALL' | 'WINS' | 'LOSSES';

const PAGE_SIZE = 10;

/**
 * Last loaded list. Tab switches remount this screen, so the previous data
 * renders on the first frame and refreshes silently. Keyed by guest mode:
 * guests see device games, accounts see the server list - never mix them.
 * Skeletons only appear when there is nothing to show yet.
 */
let historyCache: {
  guest: boolean;
  games: GameHistoryItemDto[];
  localGames: SavedGameRecord[];
  total: number;
  summary: { total: number; wins: number; losses: number } | null;
  liveRating: number | null;
} | null = null;

export const HistoryScreen: React.FC<HistoryScreenProps> = ({
  onBack,
  onSelectGame,
  onQuickMatch,
  onOpenPlayerProfile,
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
  const [loadError, setLoadError] = useState<{ message?: string; kind: ErrorKind } | null>(null);
  // Guests keep their device games but never the server list: no online
  // history fetch fires for them, and the lock below replaces that section.
  const { identity } = useSession();
  const isGuest = identity?.isGuest === true;
  const { isConnected } = useConnectivity();

  const fetchHistory = useCallback(async (silent = false) => {
    // Silent = background refresh with data on screen: never flash a
    // skeleton, never replace the list with an error.
    if (!silent) {
      setLoading(true);
      setLoadError(null);
    }
    try {
      const savedLocal = await loadGameHistory();
      setLocalGames(savedLocal);

      const [meSettled, serverSettled] = await Promise.allSettled([
        api.getMe(),
        isGuest
          ? Promise.resolve({ games: [], total: 0, summary: null })
          : api.getMyHistory(PAGE_SIZE, 0),
      ]);
      const meRes = meSettled.status === 'fulfilled' ? meSettled.value : null;
      const serverRes =
        serverSettled.status === 'fulfilled' ? serverSettled.value : null;
      const serverError =
        serverSettled.status === 'rejected' ? serverSettled.reason : null;

      const r = meRes?.ratings?.CLASSIC_1V1?.rating;
      const roundedRating = typeof r === 'number' ? Math.round(r) : null;
      if (roundedRating !== null) setLiveRating(roundedRating);
        if (serverRes && serverRes.games.length > 0) {
          const sorted = [...serverRes.games].sort((a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime());
          setGames(sorted);
          offsetRef.current = serverRes.games.length;
          setTotal(serverRes.total);
          setSummary(serverRes.summary ?? null);
          historyCache = { guest: isGuest, games: sorted, localGames: savedLocal, total: serverRes.total, summary: serverRes.summary ?? null, liveRating: roundedRating };
        } else if (isGuest || !serverError) {
          // Device games: guests (server list skipped by design) or a server
          // list that came back empty. Honestly unrated.
          // WIN/LOSS comes from seat ids, never display names: matching
          // winnerName against 'You' marked every win as a loss the moment
          // the player set a real display name. Local pass-and-play has no
          // single "you", so those render neutral (DRAW) under the winner.
          const mapped: GameHistoryItemDto[] = savedLocal.map((lg) => {
            const isAi = !!lg.myPlayerId;
            const iWon = isAi && lg.winnerId === lg.myPlayerId;
            const aiSeat = isAi
              ? lg.initialState.players.find((p) => p.id !== lg.myPlayerId)
              : undefined;
            return {
              gameId: lg.id,
              mode: lg.mode,
              status: 'COMPLETED',
              isRanked: false,
              timeControlMinutes: 3,
              incrementSeconds: 2,
              outcome: (isAi ? (iWon ? 'WIN' : 'LOSS') : 'DRAW') as 'WIN' | 'LOSS' | 'DRAW',
              endedAt: new Date(lg.date).toISOString(),
              durationMs: (lg.durationSeconds || 0) * 1000,
              myRating: { before: null, after: null, delta: 0 },
              opponent: {
                // Empty on purpose: a device-local game has no account behind the
                // opponent, and the result modal keys the View Profile action off
                // this id. 'local' would open a profile for a user that is not one.
                userId: '',
                username: isAi ? aiSeat?.displayName ?? 'AI' : lg.winnerName,
                displayName: isAi ? aiSeat?.displayName ?? 'AI' : lg.winnerName,
                ratingBefore: null,
                ratingAfter: null,
              },
            };
          });
        setGames(mapped);
        offsetRef.current = mapped.length;
        setTotal(mapped.length);
        // Stats below must come from this list, never a stale server summary.
        setSummary(null);
        historyCache = { guest: isGuest, games: mapped, localGames: savedLocal, total: mapped.length, summary: null, liveRating: roundedRating };
        } else {
          // Nothing anywhere: full error screen with retry (first load only -
          // a silent refresh keeps the list it failed to replace).
          if (!silent) {
            setLoadError({
              message: loadMessage(serverError ?? undefined),
              kind: kindOf(serverError ?? undefined),
            });
          }
        }
    } catch {
      if (!silent) setLoadError({ message: undefined, kind: 'UNKNOWN' });
    } finally {
      setLoading(false);
    }
  }, [isGuest]);

  // Next page — appended to the list, never reloaded. Guests have no server
  // list, so there is nothing more to load. A failed page keeps every loaded
  // row; the footer button stays enabled for retry.
  const loadMore = useCallback(async () => {
    if (loadingMore || isGuest) return;
    setLoadingMore(true);
    try {
      const serverRes = await api.getMyHistory(PAGE_SIZE, offsetRef.current);
      if (serverRes) {
        setGames((prev) =>
          [...prev, ...serverRes.games].sort((a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime())
        );
        offsetRef.current += serverRes.games.length;
        setTotal(serverRes.total);
      }
    } catch (e) {
      toast.show(loadMessage(e) ?? "Couldn't load more matches.");
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, isGuest]);

  useEffect(() => {
    // Instant restore, silent refresh. Static chrome (header, filters)
    // renders on the first frame either way.
    if (historyCache && historyCache.guest === isGuest) {
      setGames(historyCache.games);
      setLocalGames(historyCache.localGames);
      setTotal(historyCache.total);
      setSummary(historyCache.summary);
      setLiveRating(historyCache.liveRating);
      offsetRef.current = historyCache.games.length;
      setLoading(false);
      fetchHistory(true);
    } else {
      fetchHistory();
    }
  }, [fetchHistory, isGuest]);

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
      .catch(() => {
        toast.show("Couldn't open replay.");
      });
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

  /**
   * One row of the match list, in the Profile page's list design: the rows
   * are drawn as SEGMENTS of a single card (top segment rounds the top
   * corners, last segment rounds the bottom, hairline dividers between) so
   * the whole list reads as one grouped list instead of a stack of cards.
   */
  const renderMatchRow = ({
    item,
    index,
  }: {
    item: GameHistoryItemDto;
    index: number;
  }) => {
    const isWin = item.outcome === 'WIN';
    const isNeutral = item.outcome === 'DRAW';
    const delta = item.myRating?.delta ?? 0;
    const opponentName = item.opponent?.displayName || item.opponent?.username || 'Opponent';
    const opponentRating = item.opponent?.ratingBefore ?? item.opponent?.ratingAfter;
    const pts = item.isRanked
      ? ` · ${delta >= 0 ? `+${Math.round(delta)}` : `${Math.round(delta)}`} pts`
      : '';
    const isFirst = index === 0;
    const isLast = index === filteredGames.length - 1;

    return (
      <TouchableOpacity
        style={[
          styles.matchRow,
          isFirst && styles.matchRowFirst,
          isLast && styles.matchRowLast,
          !isLast && styles.matchRowDivider,
        ]}
        activeOpacity={0.75}
        onPress={() => setSelected(item)}
      >
        <View
          style={[
            styles.miniOutcomeBadge,
            isWin ? styles.badgeWin : isNeutral ? styles.badgeNeutral : styles.badgeLoss,
          ]}
        >
          <Text
            style={[
              styles.miniOutcomeText,
              isWin ? styles.textWin : isNeutral ? styles.textNeutral : styles.textLoss,
            ]}
          >
            {isWin ? 'W' : isNeutral ? '–' : 'L'}
          </Text>
        </View>

        <View style={styles.matchRowMeta}>
          <Text style={styles.matchRowOpponent} numberOfLines={1}>
            vs {opponentName}
            {opponentRating !== undefined && opponentRating !== null ? (
              <Text style={styles.matchRowOppRating}> ({Math.round(opponentRating)})</Text>
            ) : null}
          </Text>
          <Text style={styles.matchRowMode}>
            {item.isRanked ? 'Ranked' : 'Practice'} · {modeDisplayName(item.mode)}
            {pts}
          </Text>
        </View>

        <Feather name="chevron-right" size={20} color={THEME.colors.textSecondaryStrong} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
      </View>

      {loading && games.length === 0 && localGames.length === 0 ? (
        <HistorySkeleton />
      ) : loadError ? (
        <NoConnectionSection
          kind={sectionKind(loadError.kind, isConnected)}
          message={loadError.message}
          onRetry={() => void fetchHistory()}
        />
      ) : isConnected === false ? (
        <NoConnectionSection kind="offline" onRetry={() => void fetchHistory()} />
      ) : (
        <FlatList
          data={filteredGames}
          style={styles.list}
          keyExtractor={(item) => item.gameId}
          renderItem={renderMatchRow}
          contentContainerStyle={styles.rowsContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
          <>
          {/* Summary, guest lock and filters scroll WITH the rows: one page
              scroll instead of a fixed block over a scrolling list. */}
          <View style={styles.topBlock}>
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

              {/* Guest lock: online history is server-side, so guests get the
                  lock here while their device games list below under their
                  own heading. */}
              {isGuest && (
                <GuestGate
                  title="Keep every match"
                  message="Link Google to save rating, friends, history & head-to-head."
                  mini
                />
              )}
              {isGuest && (
                <Text style={styles.deviceLabel}>ON THIS DEVICE</Text>
              )}

              {/* Filter Pills — same segmented control as the Profile page. */}
              <View style={styles.filterPillsRow}>
                {(['ALL', 'WINS', 'LOSSES'] as OutcomeFilter[]).map((f) => {
                  const count =
                    f === 'ALL' ? totalMatches : f === 'WINS' ? totalWins : totalLosses;
                  return (
                    <TouchableOpacity
                      key={f}
                      style={[styles.filterPill, filter === f && styles.filterPillActive]}
                      onPress={() => setFilter(f)}
                    >
                      <Text style={[styles.filterPillText, filter === f && styles.filterPillTextActive]}>
                        {f === 'ALL' ? 'All' : f === 'WINS' ? 'Wins' : 'Losses'} ({count})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
          </View>
          </>
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
      <MatchResultModal
        match={selected}
        onClose={() => setSelected(null)}
        onReplay={handleGameSelect}
        onViewOpponentProfile={onOpenPlayerProfile}
      />
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
  // Summary, guest lock and filters: the list header, so the whole page
  // scrolls as one instead of a fixed block over scrolling rows.
  topBlock: {
    paddingHorizontal: 16,
    paddingTop: 12,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  list: {
    flex: 1,
  },
  rowsContent: {
    paddingHorizontal: 16,
    paddingBottom: 28,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  // Guest lock heading over the device-local list.
  deviceLabel: {
    marginTop: 16,
    marginBottom: 4,
    fontFamily: THEME.fonts.bold,
    fontSize: 11,
    letterSpacing: 1,
    color: THEME.colors.textMuted,
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
  // Segmented filter control — identical to the Profile page's recent pills:
  // muted track, dark active pill, label + count in one text.
  filterPillsRow: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: THEME.colors.surfaceMuted,
    borderRadius: 12,
    padding: 4,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
  },
  filterPillActive: {
    backgroundColor: THEME.colors.slate[950],
  },
  filterPillText: {
    fontFamily: THEME.fonts.medium,
    fontSize: 12,
    fontWeight: '500',
    color: THEME.colors.textOnMuted,
  },
  filterPillTextActive: {
    color: THEME.colors.onPrimary,
    fontWeight: '600',
  },
  // Grouped list rows: every row carries the card's left/right borders, the
  // first adds the top edge + top corners, the last adds the bottom edge,
  // and a hairline separates neighbours. Drawn per-row because FlatList
  // cannot wrap cells in one container.
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: THEME.colors.backgroundCard,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: THEME.colors.surfaceMuted,
  },
  matchRowFirst: {
    borderTopWidth: 1,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  matchRowLast: {
    borderBottomWidth: 1,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  matchRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.surfaceMuted,
  },
  miniOutcomeBadge: {
    width: 40,
    height: 40,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeWin: {
    backgroundColor: THEME.colors.tertiaryLight,
  },
  badgeLoss: {
    backgroundColor: THEME.colors.secondaryContainer,
  },
  badgeNeutral: {
    backgroundColor: THEME.colors.surfaceMuted,
  },
  miniOutcomeText: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 14,
    fontWeight: '800',
  },
  textWin: {
    color: THEME.colors.tertiary,
  },
  textLoss: {
    color: THEME.colors.secondary,
  },
  textNeutral: {
    color: THEME.colors.textMuted,
  },
  matchRowMeta: {
    gap: 1,
    flex: 1,
  },
  matchRowOpponent: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.inverseLabel,
  },
  matchRowOppRating: {
    fontFamily: THEME.fonts.regular,
    fontSize: 14,
    fontWeight: '400',
    color: THEME.colors.textSecondaryStrong,
  },
  matchRowMode: {
    fontFamily: THEME.fonts.regular,
    fontSize: 14,
    color: THEME.colors.textSecondaryStrong,
    marginTop: 2,
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
    color: THEME.colors.onPrimary,
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
