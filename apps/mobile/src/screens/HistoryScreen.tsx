import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { OrbIcon } from '../components/OrbIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createInitialState } from '@duoorb/game-core';
import { THEME, useStyles } from '../theme';
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
import { PremiumBadge } from '../components/PremiumBadge';
import { AdBanner } from '../components/AdBanner';
import { SavedGameRecord, loadGameHistory } from '../storage/gameStorage';
import {
  combineHistorySummary,
  deviceHistoryGames,
  mapLocalGameToHistoryItem,
  mergeHistoryItems,
} from '../lib/historyMerge';
import { useTranslation } from '../i18n';

interface HistoryScreenProps {
  onBack: () => void;
  onSelectGame: (game: SavedGameRecord) => void;
  /** Jumps straight to full review (same gate as everywhere else). */
  onAnalyzeGame: (game: SavedGameRecord) => void;
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
  summary: { total: number; wins: number; losses: number } | null;
  liveRating: number | null;
  serverLoaded: number;
  serverTotal: number;
} | null = null;

export const HistoryScreen: React.FC<HistoryScreenProps> = ({
  onBack,
  onSelectGame,
  onAnalyzeGame,
  onQuickMatch,
  onOpenPlayerProfile,
}) => {
  const styles = useStyles(createStyles);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [games, setGames] = useState<GameHistoryItemDto[]>([]);
  const [localGames, setLocalGames] = useState<SavedGameRecord[]>([]);
  const [filter, setFilter] = useState<OutcomeFilter>('ALL');
  const [selected, setSelected] = useState<GameHistoryItemDto | null>(null);
  const [summary, setSummary] = useState<{ total: number; wins: number; losses: number } | null>(null);
  const [liveRating, setLiveRating] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  // Render mirrors of the pagination refs, so the footer never reads a ref
  // during render.
  const [serverLoaded, setServerLoaded] = useState(0);
  const [serverTotal, setServerTotal] = useState(0);
  const offsetRef = useRef(0);
  const serverTotalRef = useRef(0);
  const gamesRef = useRef<GameHistoryItemDto[]>([]);
  const loadingMoreRef = useRef(false);
  const historySeqRef = useRef(0);
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
    const seq = ++historySeqRef.current;
    if (!silent) {
      setLoading(true);
      setLoadError(null);
    }
    try {
      const savedLocal = await loadGameHistory();
      setLocalGames(savedLocal);

      // Refresh the loaded window, not page 1: a silent remount must keep
      // every page the player loaded earlier.
      const cached = historyCache && historyCache.guest === isGuest ? historyCache : null;
      const historyLimit = Math.max(PAGE_SIZE, cached?.serverLoaded ?? offsetRef.current);

      const [meSettled, serverSettled] = await Promise.allSettled([
        api.getMe(),
        isGuest
          ? Promise.resolve({ games: [], total: 0, summary: null })
          : api.getMyHistory(historyLimit, 0),
      ]);
      if (seq !== historySeqRef.current) return;

      const meRes = meSettled.status === 'fulfilled' ? meSettled.value : null;
      const serverRes =
        serverSettled.status === 'fulfilled' ? serverSettled.value : null;
      const serverError =
        serverSettled.status === 'rejected' ? serverSettled.reason : null;

      const r = meRes?.ratings?.CLASSIC_1V1?.rating;
      const roundedRating = typeof r === 'number' ? Math.round(r) : null;
      if (roundedRating !== null) setLiveRating(roundedRating);
      // A failed /me request must not erase the rating already shown by a
      // cached history bundle.
      const nextLiveRating = roundedRating ?? cached?.liveRating ?? null;

      // Unified history: every device game (AI + pass-and-play) stays visible
      // beside the server's online list. Server rows win identity ties, so a
      // locally cached online record can never duplicate the canonical one.
      const device = deviceHistoryGames(savedLocal);
      const localItems = device.map(mapLocalGameToHistoryItem);

      if (serverRes) {
        const serverGames = serverRes.games;
        const merged = mergeHistoryItems(serverGames, localItems);
        const nextSummary = combineHistorySummary(serverRes.summary, savedLocal);
        setGames(merged);
        gamesRef.current = merged;
        offsetRef.current = serverGames.length;
        serverTotalRef.current = serverRes.total;
        setServerLoaded(serverGames.length);
        setServerTotal(serverRes.total);
        setSummary(nextSummary);

        historyCache = {
          guest: isGuest,
          games: merged,
          localGames: savedLocal,
          summary: nextSummary,
          liveRating: nextLiveRating,
          serverLoaded: serverGames.length,
          serverTotal: serverRes.total,
        };
      } else {
        // History request failed: keep every server row already loaded and
        // never replace the list with a local-only page.
        const previousGames = cached?.games ?? gamesRef.current;
        const merged = mergeHistoryItems(previousGames, localItems);
        setGames(merged);
        gamesRef.current = merged;

        const keptLoaded = cached?.serverLoaded ?? offsetRef.current;
        const keptTotal = cached?.serverTotal ?? serverTotalRef.current;
        offsetRef.current = keptLoaded;
        serverTotalRef.current = keptTotal;
        setServerLoaded(keptLoaded);
        setServerTotal(keptTotal);

        if (cached) {
          historyCache = {
            ...cached,
            games: merged,
            localGames: savedLocal,
          };
        } else {
          setSummary(combineHistorySummary(null, savedLocal));
        }

        // Only a completely empty first load becomes a full error page. With
        // even one device game we stay on the list (offline AI history works).
        if (!isGuest && merged.length === 0 && !silent) {
          setLoadError({
            message: loadMessage(serverError),
            kind: kindOf(serverError),
          });
        }
      }
    } catch {
      if (!silent && seq === historySeqRef.current) {
        setLoadError({ message: undefined, kind: 'UNKNOWN' });
      }
    } finally {
      if (seq === historySeqRef.current) setLoading(false);
    }
  }, [isGuest]);

  useEffect(() => {
    gamesRef.current = games;
  }, [games]);

  // Invalidate any in-flight history request when this screen unmounts, so a
  // remounted screen's cache cannot be overwritten by the old instance.
  useEffect(() => () => {
    historySeqRef.current += 1;
  }, []);

  // Next page — appended to the list, never reloaded. Guests have no server
  // list, so there is nothing more to load. A failed page keeps every loaded
  // row; the footer button stays enabled for retry.
  const loadMore = useCallback(async () => {
    if (loading || loadingMoreRef.current || isGuest) return;
    if (offsetRef.current >= serverTotalRef.current) return;
    loadingMoreRef.current = true;
    const seq = ++historySeqRef.current;
    setLoadingMore(true);
    try {
      const serverRes = await api.getMyHistory(PAGE_SIZE, offsetRef.current);
      if (!serverRes || seq !== historySeqRef.current) return;

      const merged = mergeHistoryItems(serverRes.games, gamesRef.current);
      setGames(merged);
      gamesRef.current = merged;
      offsetRef.current += serverRes.games.length;
      serverTotalRef.current = serverRes.total;
      setServerLoaded(offsetRef.current);
      setServerTotal(serverRes.total);
      if (historyCache && historyCache.guest === isGuest) {
        historyCache = {
          ...historyCache,
          games: merged,
          serverLoaded: offsetRef.current,
          serverTotal: serverRes.total,
        };
      }
    } catch (e) {
      toast.show(loadMessage(e) ?? t('history.loadFailed'));
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [isGuest, loading, t]);

  useEffect(() => {
    // Instant restore, silent refresh. Static chrome (header, filters)
    // renders on the first frame either way.
    if (historyCache && historyCache.guest === isGuest) {
      setGames(historyCache.games);
      setLocalGames(historyCache.localGames);
      setSummary(historyCache.summary);
      setLiveRating(historyCache.liveRating);
      offsetRef.current = historyCache.serverLoaded;
      serverTotalRef.current = historyCache.serverTotal;
      setServerLoaded(historyCache.serverLoaded);
      setServerTotal(historyCache.serverTotal);
      setLoading(false);
      fetchHistory(true);
    } else {
      fetchHistory();
    }
  }, [fetchHistory, isGuest]);

  // Resolves a list row to a full record: device games open instantly,
  // server games fetch the replay first. Shared by Replay and Analyse.
  const resolveRecord = (
    gameItem: GameHistoryItemDto,
    done: (record: SavedGameRecord) => void
  ) => {
    const localMatch = localGames.find((lg) => lg.id === gameItem.gameId);
    if (localMatch) {
      setSelected(null);
      done(localMatch);
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
          const viewer = identity?.userId
            ? replay.players.find((p: any) => p.userId === identity.userId)
            : undefined;
          const viewerSeatId = viewer ? `p${viewer.playerIndex + 1}` : null;
          const record: SavedGameRecord = {
            id: replay.gameId,
            date: new Date(replay.endedAt).getTime(),
            mode: replay.mode,
            type: 'online',
            winnerId: replay.winnerId,
            winnerName: replay.players.find((p: any) => p.isWinner)?.displayName ?? 'Winner',
            myPlayerId: viewerSeatId,
            perspectivePlayerId: viewerSeatId ?? 'p1',
            isViewerSeated: viewerSeatId != null,
            endedReason: replay.endedReason ?? 'GOAL',
            timeControlMinutes: replay.timeControlMinutes,
            incrementSeconds: replay.incrementSeconds,
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
          setSelected(null);
          done(record);
        }
      })
      .catch(() => {
        toast.show(t('history.replayFailed'));
      });
  };

  const handleGameSelect = (gameItem: GameHistoryItemDto) => {
    resolveRecord(gameItem, onSelectGame);
  };

  const handleGameAnalyze = (gameItem: GameHistoryItemDto) => {
    resolveRecord(gameItem, onAnalyzeGame);
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

  // Filtered list (memoized: a fresh .filter each render would give FlatList
  // new data identity and re-render every row on any state change).
  const filteredGames = useMemo(
    () =>
      games.filter((g) => {
        if (filter === 'WINS') return g.outcome === 'WIN';
        if (filter === 'LOSSES') return g.outcome === 'LOSS';
        return true;
      }),
    [games, filter]
  );

  // A filter can be empty while older pages still contain matching rows.
  const filterHasNoLoadedMatches = games.length > 0 && filter !== 'ALL';

  /**
   * One row of the match list, in the Profile page's list design: the rows
   * are drawn as SEGMENTS of a single card (top segment rounds the top
   * corners, last segment rounds the bottom, hairline dividers between) so
   * the whole list reads as one grouped list instead of a stack of cards.
   */
  const renderMatchRow = useCallback(
    ({
      item,
      index,
    }: {
      item: GameHistoryItemDto;
      index: number;
    }) => {
    const isWin = item.outcome === 'WIN';
    const isNeutral = item.outcome === 'DRAW';
    const delta = item.myRating?.delta ?? 0;
    const opponentName = item.opponent?.displayName || item.opponent?.username || t('history.opponent');
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={styles.matchRowOpponent} numberOfLines={1}>
              {t('gameover.vs', { name: opponentName })}
              {opponentRating !== undefined && opponentRating !== null ? (
                <Text style={styles.matchRowOppRating}> ({Math.round(opponentRating)})</Text>
              ) : null}
            </Text>
            {item.opponent?.isPremium && <PremiumBadge size="xs" />}
          </View>
          <Text style={styles.matchRowMode}>
            {item.isRanked ? t('history.ranked') : t('history.practice')} · {modeDisplayName(item.mode)}
            {pts}
          </Text>
        </View>

          <OrbIcon name="chevron-right" size={20} color={THEME.colors.textSecondaryStrong} />
        </TouchableOpacity>
      );
    },
    // Row content reads t/styles plus the list length (first/last segment
    // styling); setSelected and modeDisplayName are stable.
    [t, styles, filteredGames]
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          activeOpacity={0.7}
          accessibilityLabel={t('common.back')}
          accessibilityRole="button"
        >
          <OrbIcon name="arrow-left" size={22} color={THEME.colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('history.title')}</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      {loading && games.length === 0 && localGames.length === 0 ? (
        <HistorySkeleton />
      ) : loadError ? (
        <NoConnectionSection
          kind={sectionKind(loadError.kind, isConnected)}
          message={loadError.message}
          onRetry={() => void fetchHistory()}
        />
      ) : isConnected === false && games.length === 0 ? (
        <NoConnectionSection kind="offline" onRetry={() => void fetchHistory()} />
      ) : (
        <FlatList
          data={filteredGames}
          style={styles.list}
          keyExtractor={(item) => item.gameId}
          renderItem={renderMatchRow}
          // Retain ~5 screens of rows instead of the default ~10: rows are
          // cheap cards and the list is short (paged). Deliberately no
          // removeClippedSubviews (Android overlay artifacts).
          windowSize={11}
          contentContainerStyle={[
            styles.rowsContent,
            { paddingBottom: 32 + insets.bottom },
          ]}
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
                    <Text style={styles.statLabel}>{t('history.matches')}</Text>
                    <Text style={styles.statValue}>{totalMatches}</Text>
                  </View>
                  <View style={[styles.summaryStatBox, styles.statBorderHorizontal]}>
                    <Text style={styles.statLabel}>{t('history.wins')}</Text>
                    <Text style={[styles.statValue, { color: THEME.colors.tertiary }]}>{totalWins}</Text>
                  </View>
                  <View style={styles.summaryStatBox}>
                    <Text style={styles.statLabel}>{t('history.losses')}</Text>
                    <Text style={[styles.statValue, { color: THEME.colors.secondary }]}>{totalLosses}</Text>
                  </View>
                </View>

                <View style={styles.summaryRowBottom}>
                  <View style={styles.summaryStatBox}>
                    <Text style={styles.statLabel}>{t('history.winRate')}</Text>
                    <Text style={styles.statValue}>{winRate}%</Text>
                  </View>
                  <View style={styles.summaryStatBox}>
                    <Text style={styles.statLabel}>{t('history.currentRating')}</Text>
                    <Text style={[styles.statValue, { color: THEME.colors.primary }]}>{currentRating}</Text>
                  </View>
                </View>
              </View>

              {/* Guest lock: online history is server-side, so guests get the
                  lock here while their device games list below under their
                  own heading. */}
              {isGuest && (
                <GuestGate
                  title={t('profile.keepEveryMatch')}
                  message={t('profile.keepEveryMatchDesc')}
                  mini
                />
              )}
              {isGuest && (
                <Text style={styles.deviceLabel}>{t('history.onThisDevice')}</Text>
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
                        {f === 'ALL' ? t('profile.all') : f === 'WINS' ? t('profile.wins') : t('profile.losses')} ({count})
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
              <OrbIcon
                name={filterHasNoLoadedMatches ? 'filter' : 'clock'}
                size={36}
                color={THEME.colors.textMuted}
              />
              <Text style={styles.emptyTitle}>
                {filterHasNoLoadedMatches
                  ? t('history.filteredEmpty')
                  : t('history.noMatchesRecorded')}
              </Text>
              <Text style={styles.emptySub}>
                {filterHasNoLoadedMatches
                  ? t('history.filteredEmptySub')
                  : t('history.noMatchesSub')}
              </Text>
              {!filterHasNoLoadedMatches && (
                <TouchableOpacity
                  style={styles.quickMatchBtn}
                  activeOpacity={0.8}
                  onPress={onQuickMatch}
                >
                  <Text style={styles.quickMatchBtnText}>{t('history.playNow')}</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          ListFooterComponent={
            <>
              {!isGuest && games.length > 0 && serverLoaded < serverTotal ? (
                <TouchableOpacity
                  style={[styles.loadMoreBtn, loadingMore && styles.loadMoreBtnBusy]}
                  activeOpacity={0.8}
                  disabled={loadingMore}
                  onPress={() => void loadMore()}
                >
                  <Text style={styles.loadMoreText}>
                    {loadingMore
                      ? t('history.loading')
                      : `${t('history.loadMore')} (${serverLoaded}/${serverTotal})`}
                  </Text>
                </TouchableOpacity>
              ) : null}
              {/* Ad slot (P6, O2): below the pager, never above a button. */}
              <AdBanner placement="list" />
            </>
          }
          />
      )}

      {/* Match detail modal (Stitch) */}
      <MatchResultModal
        match={selected}
        onClose={() => setSelected(null)}
        onReplay={handleGameSelect}
        onAnalyze={handleGameAnalyze}
        onViewOpponentProfile={onOpenPlayerProfile}
      />
    </View>
  );
};

const createStyles = () => StyleSheet.create({
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
    backgroundColor: THEME.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.surfaceContainer,
  },
  title: {
    fontFamily: THEME.fonts.bold,
    fontSize: 22,
    fontWeight: '700',
    color: THEME.colors.onSurface,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
  },
  headerPlaceholder: {
    width: 40,
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
    paddingBottom: 88, // Clears the floating nav overlay.
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
    backgroundColor: THEME.colors.inverseSurface,
  },
  filterPillText: {
    fontFamily: THEME.fonts.medium,
    fontSize: 12,
    fontWeight: '500',
    color: THEME.colors.textOnMuted,
  },
  filterPillTextActive: {
    color: THEME.colors.inverseOnSurface,
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
