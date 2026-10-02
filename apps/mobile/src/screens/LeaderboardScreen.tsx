import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../theme';
import { api, LeaderboardEntryDto } from '../network/apiClient';
import { useSession } from '../network/session';
import { useConnectivity } from '../network/useConnectivity';
import { GuestGate } from '../components/GuestGate';
import { NoConnectionSection } from '../components/NoConnection';
import { kindOf, sectionKind, type ErrorKind } from '../network/errors';
import { PlayerAvatarOrb } from '../components/PlayerIdentity';
import { EmptyState } from '../components/StateViews';
import { LeaderboardSkeleton } from '../components/Skeleton';

interface LeaderboardScreenProps {
  onSelectPlayer: (player: { userId: string; username: string }) => void;
  onQuickMatch: () => void;
}

const PAGE_SIZE = 50;

/**
 * Last loaded page. Tab switches remount this screen, so the previous rows
 * render on the first frame and refresh silently. Skeleton only when empty.
 */
let leaderboardCache: { entries: LeaderboardEntryDto[]; total: number; offset: number } | null = null;

export const LeaderboardScreen: React.FC<LeaderboardScreenProps> = ({
  onSelectPlayer,
  onQuickMatch,
}) => {
  const [entries, setEntries] = useState<LeaderboardEntryDto[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<{ kind: ErrorKind } | null>(null);
  // Centered on the viewer's own row (My Rank). Null when browsing the top.
  const [myRank, setMyRank] = useState<number | null>(null);
  const [myWindowOffset, setMyWindowOffset] = useState(0);
  const [centered, setCentered] = useState(false);
  // My Rank with no rank yet: full empty state, not a banner.
  const [notRanked, setNotRanked] = useState(false);
  // My Rank lookup failure: small inline banner, the board stays.
  const [rankError, setRankError] = useState<string | null>(null);
  const [showGuestCard, setShowGuestCard] = useState(false);
  const listRef = useRef<FlatList<LeaderboardEntryDto>>(null);

  const { identity } = useSession();
  const isGuest = identity?.isGuest === true;
  const myUserId = identity?.userId ?? null;
  const { isConnected } = useConnectivity();

  const fetchLeaderboard = useCallback(async (silent = false) => {
    // Silent = background refresh: keep the rows, never flash or error.
    if (!silent) {
      setLoading(true);
      setLoadError(null);
      setNotRanked(false);
      setRankError(null);
      setCentered(false);
      setMyRank(null);
      setShowGuestCard(false);
    }
    try {
      const page = await api.getLeaderboard('CLASSIC_1V1', PAGE_SIZE, 0);
      setEntries(page.entries);
      setTotal(page.total);
      setOffset(page.entries.length);
      leaderboardCache = { entries: page.entries, total: page.total, offset: page.entries.length };
    } catch (e) {
      if (!silent) setLoadError({ kind: kindOf(e) });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || centered || offset >= total) return;
    setLoadingMore(true);
    try {
      const page = await api.getLeaderboard('CLASSIC_1V1', PAGE_SIZE, offset);
      setEntries((prev) => [...prev, ...page.entries]);
      setTotal(page.total);
      setOffset((prev) => prev + page.entries.length);
    } catch {
      // Keep the loaded rows; the footer button stays for retry.
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, centered, offset, total]);

  useEffect(() => {
    // Instant restore, silent refresh: header, mode pills and lock banner
    // render on the first frame either way.
    if (leaderboardCache) {
      setEntries(leaderboardCache.entries);
      setTotal(leaderboardCache.total);
      setOffset(leaderboardCache.offset);
      setLoading(false);
      fetchLeaderboard(true);
    } else {
      fetchLeaderboard();
    }
  }, [fetchLeaderboard]);

  // After the centered window lands, jump to the viewer's row. Guarded: a
  // failed index falls back to an estimated offset instead of crashing.
  useEffect(() => {
    if (!centered || myRank == null) return;
    const t = setTimeout(() => {
      const index = myRank - 1 - myWindowOffset;
      try {
        listRef.current?.scrollToIndex({ index, viewPosition: 0.2, animated: true });
      } catch {
        try {
          listRef.current?.scrollToOffset({ offset: Math.max(0, index * 64), animated: false });
        } catch {
          // List not laid out yet; the row is still in the data.
        }
      }
    }, 150);
    return () => clearTimeout(t);
  }, [centered, entries, myRank, myWindowOffset]);

  const handleMyRank = useCallback(async () => {
    // Guests own no rank: the link card, no API call.
    if (isGuest) {
      setShowGuestCard(true);
      return;
    }
    setRankError(null);
    setNotRanked(false);
    try {
      const res = await api.getMyRank();
      if (!res.ranked) {
        setNotRanked(true);
        return;
      }
      setEntries(res.entries ?? []);
      setTotal(res.total ?? 0);
      setMyRank(res.rank ?? null);
      setMyWindowOffset(res.windowOffset ?? 0);
      setCentered(true);
    } catch {
      setRankError('Could not load your rank. Try again.');
    }
  }, [isGuest]);

  const renderItem = ({ item }: { item: LeaderboardEntryDto }) => {
    const isTop3 = item.rank <= 3;
    const rankColor =
      item.rank === 1
        ? THEME.colors.assessmentInaccuracy // Gold
        : item.rank === 2
        ? THEME.colors.textSecondaryStrong // Silver
        : item.rank === 3
        ? THEME.colors.warning // Bronze
        : THEME.colors.textMuted;
    const isMe = centered && item.userId === myUserId;

    return (
      <TouchableOpacity
        style={[styles.playerRow, isMe && styles.playerRowMe]}
        activeOpacity={0.7}
        onPress={() => onSelectPlayer({ userId: item.userId, username: item.username })}
      >
        <View style={styles.rankPill}>
          <Text style={[styles.rankText, { color: rankColor }]}>{item.rank}</Text>
        </View>

        <PlayerAvatarOrb
          size={34}
          color={isTop3 ? THEME.colors.player1 : THEME.colors.boardBorder}
          initial={item.username.charAt(0)}
        />

        <View style={styles.playerDetails}>
          <Text style={styles.playerName} numberOfLines={1}>
            {item.username}
          </Text>
          <Text style={styles.playerGames}>{item.gamesPlayed} games · {item.winRate}% win</Text>
        </View>

        {isMe ? (
          <View style={styles.youPill}>
            <Text style={styles.youPillText}>YOU</Text>
          </View>
        ) : (
          <View style={styles.ratingWrap}>
            <Text style={styles.ratingValue}>{item.rating}</Text>
            <Feather name="chevron-right" size={16} color={THEME.colors.textMuted} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Leaderboard</Text>
        <TouchableOpacity
          style={styles.myRankBtn}
          activeOpacity={0.7}
          onPress={() => void handleMyRank()}
          accessibilityLabel="My rank"
          accessibilityRole="button"
        >
          <Text style={styles.myRankBtnText}>My Rank</Text>
        </TouchableOpacity>
      </View>

      {isGuest && (
        <View style={styles.lockBanner}>
          <Feather name="lock" size={13} color={THEME.colors.textSecondary} />
          <Text style={styles.lockBannerText}>
            Link Google to appear on leaderboard + save rank.
          </Text>
        </View>
      )}

      {isGuest && showGuestCard && (
        <View style={styles.gateWrap}>
          <GuestGate
            title="Your rank needs saving"
            message="Link Google to appear on leaderboard + save rank."
            mini
          />
        </View>
      )}

      {!!rankError && (
        <View style={styles.rankNote}>
          <Text style={styles.rankNoteText}>{rankError}</Text>
        </View>
      )}

      {notRanked ? (
        <View style={styles.notRankedWrap}>
          <View style={styles.notRankedIconCircle}>
            <MaterialCommunityIcons
              name="trophy-outline"
              size={34}
              color={THEME.colors.assessmentInaccuracy}
            />
          </View>
          <Text style={styles.notRankedTitle}>NOT RANKED YET</Text>
          <Text style={styles.notRankedSub}>
            Play a ranked match to earn your spot on the board.
          </Text>
          <TouchableOpacity
            style={styles.notRankedPlayBtn}
            activeOpacity={0.8}
            onPress={onQuickMatch}
            accessibilityLabel="Play a ranked match"
          >
            <Text style={styles.notRankedPlayText}>Play Ranked</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => void fetchLeaderboard()}
            accessibilityLabel="Back to top"
          >
            <Text style={styles.notRankedBackText}>Back to top</Text>
          </TouchableOpacity>
        </View>
      ) : loading && entries.length === 0 ? (
        <LeaderboardSkeleton />
      ) : loadError ? (
        <NoConnectionSection
          kind={sectionKind(loadError.kind, isConnected)}
          onRetry={() => void fetchLeaderboard()}
        />
      ) : entries.length === 0 ? (
        <EmptyState
          title="NO RANKINGS YET"
          description="Play ranked matches to qualify for the global leaderboard."
        />
      ) : (
        <FlatList
          ref={listRef}
          data={entries}
          keyExtractor={(item) => item.userId}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.5}
          onScrollToIndexFailed={(info) => {
            listRef.current?.scrollToOffset({
              offset: Math.max(0, info.index * 64),
              animated: false,
            });
          }}
          ListFooterComponent={
            centered ? (
              <TouchableOpacity
                style={styles.backToTopBtn}
                activeOpacity={0.7}
                onPress={() => void fetchLeaderboard()}
                accessibilityLabel="Back to top"
                accessibilityRole="button"
              >
                <Text style={styles.backToTopText}>Back to top</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.footer}>
                {total > 0 && (
                  <Text style={styles.footerCount}>
                    Showing {entries.length} of {total}
                  </Text>
                )}
                {loadingMore ? (
                  <ActivityIndicator size="small" color={THEME.colors.textSecondary} />
                ) : (
                  entries.length < total && (
                    <TouchableOpacity
                      style={styles.loadMoreBtn}
                      activeOpacity={0.7}
                      onPress={() => void loadMore()}
                      accessibilityLabel="Load more"
                      accessibilityRole="button"
                    >
                      <Text style={styles.loadMoreText}>Load more</Text>
                    </TouchableOpacity>
                  )
                )}
              </View>
            )
          }
        />
      )}
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
    fontSize: 20,
    fontWeight: '700',
    color: THEME.colors.onSurface,
  },
  // Guest banner: browsing stays open, ranking does not.
  lockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceHairline,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  lockBannerText: {
    fontFamily: THEME.fonts.medium,
    fontSize: 12,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
  },
  // Inline link card under the header (My Rank tap as guest).
  gateWrap: {
    marginHorizontal: 20,
    marginBottom: 12,
  },
  // Rank hint (unranked / failed lookup): informational, never an error.
  rankNote: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceHairline,
    paddingVertical: 9,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  rankNoteText: {
    fontFamily: THEME.fonts.medium,
    fontSize: 12,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
  },
  notRankedWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 48,
  },
  notRankedIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.warningLight,
    borderWidth: 1,
    borderColor: THEME.colors.warningBorder,
    marginBottom: 16,
  },
  notRankedTitle: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  notRankedSub: {
    fontFamily: THEME.fonts.regular,
    fontSize: 13,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 260,
    marginBottom: 20,
  },
  notRankedPlayBtn: {
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: THEME.radius.md,
    marginBottom: 14,
    ...THEME.shadows.card,
  },
  notRankedPlayText: {
    fontFamily: THEME.fonts.bold,
    color: THEME.colors.onPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  notRankedBackText: {
    fontFamily: THEME.fonts.semiBold,
    color: THEME.colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  myRankBtn: {
    paddingVertical: 4,
  },
  myRankBtnText: {
    fontFamily: THEME.fonts.semiBold,
    color: THEME.colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 8,
    maxWidth: 460,
    width: '100%',
    alignSelf: 'center',
  },
  playerRow: {
    backgroundColor: THEME.colors.surfaceContainerLowest,
    borderRadius: THEME.radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceContainer,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...THEME.shadows.card,
  },
  // The viewer's own row in the centered window.
  playerRowMe: {
    borderColor: THEME.colors.primary,
    borderWidth: 2,
  },
  youPill: {
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  youPillText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: THEME.colors.onPrimary,
  },
  rankPill: {
    minWidth: 24,
    alignItems: 'center',
  },
  rankText: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 15,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  playerDetails: {
    flex: 1,
  },
  playerName: {
    fontFamily: THEME.fonts.bold,
    color: THEME.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  playerGames: {
    fontFamily: THEME.fonts.medium,
    color: THEME.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  ratingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ratingValue: {
    fontFamily: THEME.fonts.extraBold,
    color: THEME.colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  footer: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  footerCount: {
    fontFamily: THEME.fonts.medium,
    fontSize: 12,
    color: THEME.colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  loadMoreBtn: {
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceHairline,
    backgroundColor: THEME.colors.backgroundCard,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  loadMoreText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 13,
    color: THEME.colors.textSecondary,
  },
  backToTopBtn: {
    alignItems: 'center',
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceHairline,
    backgroundColor: THEME.colors.backgroundCard,
    paddingVertical: 11,
    marginTop: 4,
  },
  backToTopText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 13,
    color: THEME.colors.primary,
  },
});
