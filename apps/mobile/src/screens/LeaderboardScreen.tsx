import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { THEME, useStyles } from '../theme';
import { api, LeaderboardEntryDto } from '../network/apiClient';
import { useSession } from '../network/session';
import { useConnectivity } from '../network/useConnectivity';
import { GuestGate } from '../components/GuestGate';
import { PremiumBadge } from '../components/PremiumBadge';
import { AdBanner } from '../components/AdBanner';
import { NoConnectionSection } from '../components/NoConnection';
import { kindOf, sectionKind, type ErrorKind } from '../network/errors';
import { EmptyState } from '../components/StateViews';
import { useTranslation } from '../i18n';

interface LeaderboardScreenProps {
  onSelectPlayer: (player: { userId: string; username: string }) => void;
  onQuickMatch: () => void;
}

const PAGE_SIZE = 50;

/** Medal finishes: glossy gradient medallions, white number, subtle depth. */
const MEDALS: Record<number, { stops: [string, string] }> = {
  1: { stops: ['#FFD972', '#E8A415'] },
  2: { stops: ['#E8EDF2', '#9AA3AE'] },
  3: { stops: ['#E8A15C', '#A8641F'] },
};

const PodiumSpot: React.FC<{
  entry: LeaderboardEntryDto;
  avatarSize: number;
  barHeight: number;
  isMe: boolean;
  onPress: () => void;
}> = ({ entry, avatarSize, barHeight, isMe, onPress }) => {
  const styles = useStyles(createStyles);
  const { t } = useTranslation();
  const medal = MEDALS[entry.rank] ?? null;
  const name = entry.displayName || entry.username;
  return (
    <TouchableOpacity style={styles.spot} activeOpacity={0.8} onPress={onPress}>
      <View style={{ width: avatarSize, height: avatarSize }}>
        <View
          style={[
            styles.podiumAvatar,
            {
              width: avatarSize,
              height: avatarSize,
              borderRadius: avatarSize / 2,
            },
          ]}
        >
          <Text style={[styles.podiumInitial, { fontSize: Math.round(avatarSize * 0.36) }]}>
            {(name.charAt(0) || '?').toUpperCase()}
          </Text>
        </View>
        {medal && (
          <LinearGradient
            colors={medal.stops}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.medalBadge}
          >
            <Text style={styles.medalNum}>{entry.rank}</Text>
          </LinearGradient>
        )}
      </View>
      <Text style={styles.spotName} numberOfLines={1}>
        {name}
      </Text>
      {isMe && (
        <View style={styles.youPill}>
          <Text style={styles.youPillText}>{t('leaderboard.you')}</Text>
        </View>
      )}
      <View style={styles.scorePill}>
        <Text style={styles.scorePillText}>
          {Math.round(entry.rating).toLocaleString('en-US')}
        </Text>
      </View>
      <LinearGradient
        colors={[THEME.colors.surfaceContainerHigh, THEME.colors.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.bar, { height: barHeight }]}
      />
    </TouchableOpacity>
  );
};

/**
 * Last loaded page. Tab switches remount this screen, so the previous rows
 * render on the first frame and refresh silently. Skeleton only when empty.
 */
let leaderboardCache: { entries: LeaderboardEntryDto[]; total: number; offset: number } | null = null;

export const LeaderboardScreen: React.FC<LeaderboardScreenProps> = ({
  onSelectPlayer,
  onQuickMatch,
}) => {
  const styles = useStyles(createStyles);
  const { t } = useTranslation();
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
    // Instant restore, silent refresh: header and board render on the
    // first frame either way.
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
          listRef.current?.scrollToOffset({ offset: Math.max(0, index * 72), animated: false });
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
      setRankError(t('leaderboard.rankError'));
    }
  }, [isGuest, t]);

  // Podium owns ranks 1-3 on the top of the board only — never inside a
  // centered My Rank window, which renders every row in its window.
  const showPodium = !centered && entries.length >= 3 && entries[0].rank === 1;
  const rows = showPodium ? entries.slice(3) : entries;

  const renderPodium = () => {
    if (!showPodium) return null;
    const [first, second, third] = entries;
    const openPlayer = (entry: LeaderboardEntryDto) => () =>
      onSelectPlayer({ userId: entry.userId, username: entry.username });
    return (
      <View style={styles.podiumWrap}>
        <View style={styles.podiumRow}>
          <PodiumSpot
            entry={second}
            avatarSize={68}
            barHeight={76}
            isMe={second.userId === myUserId}
            onPress={openPlayer(second)}
          />
          <PodiumSpot
            entry={first}
            avatarSize={86}
            barHeight={116}
            isMe={first.userId === myUserId}
            onPress={openPlayer(first)}
          />
          <PodiumSpot
            entry={third}
            avatarSize={68}
            barHeight={58}
            isMe={third.userId === myUserId}
            onPress={openPlayer(third)}
          />
        </View>
      </View>
    );
  };

  const renderRow = ({ item }: { item: LeaderboardEntryDto }) => {
    const isMe = myUserId != null && item.userId === myUserId;
    const medal = MEDALS[item.rank] ?? null;
    const name = item.displayName || item.username;
    return (
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.7}
        onPress={() => onSelectPlayer({ userId: item.userId, username: item.username })}
      >
        {medal ? (
          <LinearGradient
            colors={medal.stops}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.rankBadge}
          >
            <Text style={[styles.rankNum, styles.rankNumMedal]}>{item.rank}</Text>
          </LinearGradient>
        ) : (
          <View style={styles.rankBadge}>
            <Text style={styles.rankNum}>{item.rank}</Text>
          </View>
        )}
        <View style={styles.avatar}>
          <Text style={styles.avatarInitial}>
            {(name.charAt(0) || '?').toUpperCase()}
          </Text>
        </View>
        <View style={styles.rowMeta}>
          <View style={styles.rowNameLine}>
            <Text style={styles.rowName} numberOfLines={1}>
              {name}
              {item.isPremium === true && (
                <Text>
                  {' '}<PremiumBadge />
                </Text>
              )}
            </Text>
            {isMe && (
              <View style={styles.youPill}>
                <Text style={styles.youPillText}>{t('leaderboard.you')}</Text>
              </View>
            )}
          </View>
          <Text style={styles.rowSub}>
            {t('leaderboard.matchesStats', { games: item.gamesPlayed, winRate: item.winRate })}
          </Text>
        </View>
        <View style={styles.scoreBlock}>
          <Text style={styles.score}>
            {Math.round(item.rating).toLocaleString('en-US')}
          </Text>
          <Text style={styles.pts}>{t('leaderboard.pts')}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('leaderboard.title')}</Text>
        <TouchableOpacity
          style={styles.myRankBtn}
          activeOpacity={0.7}
          onPress={() => void handleMyRank()}
          accessibilityLabel={t('leaderboard.myRank')}
          accessibilityRole="button"
        >
          <Text style={styles.myRankBtnText}>{t('leaderboard.myRank')}</Text>
        </TouchableOpacity>
      </View>

      {!!rankError && (
        <View style={styles.rankNote}>
          <Text style={styles.rankNoteText}>{rankError}</Text>
        </View>
      )}

      {loading && entries.length === 0 ? (
        // No placeholder rows on this page: the leaderboard is a numbered
        // table, so fake rank rows read as real (and wrong) standings.
        // The header renders immediately and the cached window lands a
        // beat later.
        null
      ) : loadError ? (
        <NoConnectionSection
          kind={sectionKind(loadError.kind, isConnected)}
          onRetry={() => void fetchLeaderboard()}
        />
      ) : entries.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            title={t('leaderboard.noRankingsTitle')}
            description={t('leaderboard.noRankingsDesc')}
          />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={rows}
          keyExtractor={(item) => item.userId}
          renderItem={renderRow}
          windowSize={11}
          ListHeaderComponent={renderPodium}
          contentContainerStyle={styles.listContent}
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.5}
          onScrollToIndexFailed={(info) => {
            listRef.current?.scrollToOffset({
              offset: Math.max(0, info.index * 72),
              animated: false,
            });
          }}
          ListFooterComponent={
            centered ? (
              <>
                <TouchableOpacity
                  style={styles.backToTopBtn}
                  activeOpacity={0.7}
                  onPress={() => void fetchLeaderboard()}
                  accessibilityLabel={t('leaderboard.backToTop')}
                  accessibilityRole="button"
                >
                  <Text style={styles.backToTopText}>{t('leaderboard.backToTop')}</Text>
                </TouchableOpacity>
                {/* Ad slot (P6, O2): below the pager, never above a button. */}
                <AdBanner placement="list" />
              </>
            ) : (
              <View style={styles.footer}>
                {total > 0 && (
                  <Text style={styles.footerCount}>
                    {t('leaderboard.showingCount', { count: entries.length, total })}
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
                      accessibilityLabel={t('leaderboard.loadMore')}
                      accessibilityRole="button"
                    >
                      <Text style={styles.loadMoreText}>{t('leaderboard.loadMore')}</Text>
                    </TouchableOpacity>
                  )
                )}
                {/* Ad slot (P6, O2): below the pager, never above a button. */}
                <AdBanner placement="list" />
              </View>
            )
          }
        />
      )}

      {/* Guest My Rank: the Save with Google card floats above the board —
          the list underneath never moves, nothing gets pushed down.
          No open animation: the dim overlay appears instantly. */}
      <Modal
        visible={isGuest && showGuestCard}
        transparent
        animationType="none"
        onRequestClose={() => setShowGuestCard(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.overlayCard}>
            <GuestGate
              title={t('leaderboard.guestRankTitle')}
              message={t('leaderboard.guestRankDesc')}
              secondaryLabel={t('premium.notNow')}
              onSecondary={() => setShowGuestCard(false)}
              mini
            />
          </View>
        </View>
      </Modal>

      {/* Not ranked yet: status card over the untouched board — never
          inserted into the list, never a layout change underneath.
          No open animation: the dim overlay appears instantly. */}
      <Modal
        visible={notRanked}
        transparent
        animationType="none"
        onRequestClose={() => setNotRanked(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.notRankedCard}>
            <TouchableOpacity
              style={styles.notRankedClose}
              activeOpacity={0.7}
              onPress={() => setNotRanked(false)}
              accessibilityLabel="Close"
              accessibilityRole="button"
            >
              <Feather name="x" size={20} color={THEME.colors.textMuted} />
            </TouchableOpacity>
            <View style={styles.notRankedIconCircle}>
              <MaterialCommunityIcons
                name="trophy-outline"
                size={34}
                color={THEME.colors.assessmentInaccuracy}
              />
            </View>
            <Text style={styles.notRankedTitle}>{t('leaderboard.notRankedTitle')}</Text>
            <Text style={styles.notRankedSub}>
              {t('leaderboard.notRankedDesc')}
            </Text>
            <TouchableOpacity
              style={styles.notRankedPlayBtn}
              activeOpacity={0.8}
              onPress={() => {
                setNotRanked(false);
                onQuickMatch();
              }}
              accessibilityLabel={t('leaderboard.playRanked')}
            >
              <Text style={styles.notRankedPlayText}>{t('leaderboard.playRanked')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setNotRanked(false)}
              accessibilityLabel={t('leaderboard.backToLeaderboard')}
            >
              <Text style={styles.notRankedBackText}>{t('leaderboard.backToLeaderboard')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  myRankBtn: {
    paddingVertical: 4,
  },
  myRankBtnText: {
    fontFamily: THEME.fonts.semiBold,
    color: THEME.colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  // Rank lookup failure: small inline banner, the board stays.
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
  // Empty board: centered in the available space, like the not-ranked view.
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 48,
  },
  // Podium: 2nd left, 1st raised center, 3rd right. Columns bottom-align
  // so every bar starts on the same baseline.
  podiumWrap: {
    marginTop: 8,
    marginBottom: 12,
  },
  podiumRow: {
    flexDirection: 'row',
    gap: 8,
  },
  spot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  podiumAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.backgroundCard,
    borderWidth: 2.5,
    borderColor: THEME.colors.surfaceHairline,
    overflow: 'hidden',
  },
  podiumInitial: {
    fontFamily: THEME.fonts.extraBold,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  // Medal finish: glossy gradient medallion, cut out from the page behind.
  medalBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: THEME.colors.background,
  },
  medalNum: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  spotName: {
    marginTop: 8,
    fontFamily: THEME.fonts.bold,
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    textAlign: 'center',
    maxWidth: '100%',
  },
  scorePill: {
    marginTop: 6,
    marginBottom: 10,
    backgroundColor: THEME.colors.backgroundCard,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceHairline,
    borderRadius: THEME.radius.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  scorePillText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  bar: {
    width: '100%',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  // Rank rows: medal badge, avatar, name + sessions, rating + pts.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.dividerSoft,
  },
  rankBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.backgroundCard,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceHairline,
  },
  rankNum: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  rankNumMedal: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.backgroundCard,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceHairline,
  },
  avatarInitial: {
    fontFamily: THEME.fonts.bold,
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  rowMeta: {
    flex: 1,
    gap: 2,
  },
  rowNameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowName: {
    fontFamily: THEME.fonts.bold,
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    flexShrink: 1,
  },
  // Viewer marker: primary in both modes.
  youPill: {
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  youPillText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: THEME.colors.onPrimary,
  },
  rowSub: {
    fontFamily: THEME.fonts.regular,
    fontSize: 12,
    color: THEME.colors.textMuted,
  },
  scoreBlock: {
    alignItems: 'flex-end',
  },
  score: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  pts: {
    fontFamily: THEME.fonts.medium,
    fontSize: 10,
    color: THEME.colors.textMuted,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 120, // Clears the floating nav overlay.
    maxWidth: 460,
    width: '100%',
    alignSelf: 'center',
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
  // Card overlays (guest link, not-ranked): dim + centered card, same
  // language as the resign/result modals. The board underneath never moves.
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  overlayCard: {
    maxWidth: 340,
    width: '100%',
    alignItems: 'center',
  },
  // Not-ranked card: themed card on the dim, with its own close.
  notRankedCard: {
    maxWidth: 340,
    width: '100%',
    alignItems: 'center',
    backgroundColor: THEME.colors.backgroundCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceHairline,
    padding: 24,
    ...THEME.shadows.modal,
  },
  notRankedClose: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notRankedIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.surfaceMuted,
    marginBottom: 12,
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
});
