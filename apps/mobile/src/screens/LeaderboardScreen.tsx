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
import { Feather, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { THEME } from '../theme';
import { api, LeaderboardEntryDto } from '../network/apiClient';
import { useSession } from '../network/session';
import { useConnectivity } from '../network/useConnectivity';
import { GuestGate } from '../components/GuestGate';
import { NoConnectionSection } from '../components/NoConnection';
import { kindOf, sectionKind, type ErrorKind } from '../network/errors';
import { EmptyState } from '../components/StateViews';

interface LeaderboardScreenProps {
  onSelectPlayer: (player: { userId: string; username: string }) => void;
  onQuickMatch: () => void;
}

const PAGE_SIZE = 50;

type BoardTier = 'gold' | 'silver' | 'bronze' | 'top10' | 'top50' | 'top100' | 'plain';

/** Rank determines the tier — never the player. Same range, same card. */
function tierOfRank(rank: number): BoardTier {
  if (rank === 1) return 'gold';
  if (rank === 2) return 'silver';
  if (rank === 3) return 'bronze';
  if (rank <= 10) return 'top10';
  if (rank <= 50) return 'top50';
  if (rank <= 100) return 'top100';
  return 'plain';
}

interface TierStyle {
  /** Card gradient stops (diagonal). Null = flat `card`. */
  gradient: string[] | null;
  card: string;
  border: string;
  borderWidth: number;
  /** Left accent bar stops (vertical). Single stop = solid. Null = none. */
  accent: string[] | null;
  rankColor: string;
  /** Medal icon above the number, medal tiers only. */
  rankIcon?: 'workspace-premium' | 'military-tech';
  rankIconColor: string;
  /** Avatar ring gradient stops + padding (the ring width). */
  ring: string[];
  ringWidth: number;
  nameColor: string;
  winsColor: string;
  statsColor: string;
  dotColor: string;
  ratingColor: string;
  ratingSize: number;
  shadow: boolean;
}

/**
 * The six card styles, progressively more neutral as the rank drops.
 * Same range, same card — the rank only picks the tier.
 */
const TIER_STYLE: Record<BoardTier, TierStyle> = {
  gold: {
    gradient: ['#FFFBEB', '#FEF3C7', '#FDE68A', '#F59E0B', '#D97706'],
    card: '#FFFBEB',
    border: '#F59E0B',
    borderWidth: 1.5,
    accent: ['#FDE68A', '#B45309'],
    rankColor: '#78350F',
    rankIcon: 'workspace-premium',
    rankIconColor: '#B45309',
    ring: ['#FFFFFF', '#D97706'],
    ringWidth: 2,
    nameColor: '#451A24',
    winsColor: '#451A24',
    statsColor: '#78350F',
    dotColor: '#B45309',
    ratingColor: '#451A24',
    ratingSize: 18,
    shadow: true,
  },
  silver: {
    gradient: ['#FFFFFF', '#F1F5F9', '#E2E8F0', '#F8FAFC', '#CBD5E1'],
    card: '#F1F5F9',
    border: '#94A3B8',
    borderWidth: 1.5,
    accent: ['#FFFFFF', '#64748B'],
    rankColor: '#1E293B',
    rankIcon: 'military-tech',
    rankIconColor: '#475569',
    ring: ['#FFFFFF', '#64748B'],
    ringWidth: 2,
    nameColor: '#0F172A',
    winsColor: '#1E293B',
    statsColor: '#475569',
    dotColor: '#64748B',
    ratingColor: '#0F172A',
    ratingSize: 18,
    shadow: true,
  },
  bronze: {
    gradient: ['#FFF7F2', '#FAE8DF', '#F2D4C2', '#DFB598', '#C99372'],
    card: '#FFF7F2',
    border: '#BA805E',
    borderWidth: 1.5,
    accent: ['#FFEADB', '#8A4E28'],
    rankColor: '#5C2B0C',
    rankIcon: 'military-tech',
    rankIconColor: '#8A4823',
    ring: ['#FFFFFF', '#A56138'],
    ringWidth: 2,
    nameColor: '#4A2108',
    winsColor: '#4A2108',
    statsColor: '#6E3210',
    dotColor: '#9C5832',
    ratingColor: '#4A2108',
    ratingSize: 18,
    shadow: true,
  },
  top10: {
    gradient: null,
    card: '#FFFFFF',
    border: '#E2E5EC',
    borderWidth: 1,
    accent: ['#5B67D8', '#5B67D8'],
    rankColor: '#343946',
    rankIconColor: '#343946',
    ring: ['#DDE1E8', '#DDE1E8'],
    ringWidth: 1,
    nameColor: '#171A24',
    winsColor: '#171A24',
    statsColor: '#747987',
    dotColor: '#CBD0DB',
    ratingColor: '#171A24',
    ratingSize: 14,
    shadow: true,
  },
  top50: {
    gradient: null,
    card: '#FFFFFF',
    border: '#E3E6ED',
    borderWidth: 1,
    accent: ['#4FAE7B', '#4FAE7B'],
    rankColor: '#343946',
    rankIconColor: '#343946',
    ring: ['#DDE1E8', '#DDE1E8'],
    ringWidth: 1,
    nameColor: '#171A24',
    winsColor: '#171A24',
    statsColor: '#747987',
    dotColor: '#CBD0DB',
    ratingColor: '#171A24',
    ratingSize: 14,
    shadow: false,
  },
  top100: {
    gradient: null,
    card: '#FFFFFF',
    border: '#E5E7EC',
    borderWidth: 1,
    accent: ['#8B93A3', '#8B93A3'],
    rankColor: '#4A5060',
    rankIconColor: '#4A5060',
    ring: ['#E0E3E8', '#E0E3E8'],
    ringWidth: 1,
    nameColor: '#171A24',
    winsColor: '#171A24',
    statsColor: '#7A808C',
    dotColor: '#CBD0DB',
    ratingColor: '#171A24',
    ratingSize: 14,
    shadow: false,
  },
  plain: {
    gradient: null,
    card: '#FFFFFF',
    border: '#E5E7EC',
    borderWidth: 1,
    accent: null,
    rankColor: '#4A5060',
    rankIconColor: '#4A5060',
    ring: ['#E0E3E8', '#E0E3E8'],
    ringWidth: 1,
    nameColor: '#171A24',
    winsColor: '#171A24',
    statsColor: '#7A808C',
    dotColor: '#CBD0DB',
    ratingColor: '#171A24',
    ratingSize: 14,
    shadow: false,
  },
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

  const renderItem = ({ item, index }: { item: LeaderboardEntryDto; index: number }) => {
    const tierKey = tierOfRank(item.rank);
    const tier = TIER_STYLE[tierKey];
    // Medals keep their gradient + ring medallion; the flatter geometry
    // (smaller radius, square-ish avatar) applies to every tier.
    const medal = tier.gradient !== null;
    // Connected list: consecutive same-tier rows (never medals) share one
    // continuous card — no gap, shared side borders, hairlines between,
    // rounded only at the group's outer corners.
    const groupable = !medal;
    const prevSame =
      groupable && index > 0 && tierOfRank(entries[index - 1].rank) === tierKey;
    const nextSame =
      groupable &&
      index < entries.length - 1 &&
      tierOfRank(entries[index + 1].rank) === tierKey;
    // The viewer's own row keeps its YOU pill inside the tier card — the
    // card itself never changes for it.
    const isMe = centered && item.userId === myUserId;

    return (
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: tier.gradient ? undefined : tier.card,
            borderColor: tier.border,
            borderWidth: tier.borderWidth,
            borderRadius: 8,
          },
          // A touching row below hides this one's bottom shadow; the group
          // keeps the top shadow of its first row and the full shadow of
          // its last instead of a dark seam between every row.
          tier.shadow && !nextSame && THEME.shadows.card,
          groupable && {
            // Absorb the list gap so same-tier rows touch; outer corners
            // round only at the group's ends.
            marginTop: prevSame ? -8 : 0,
            borderWidth: 0,
            borderLeftWidth: 1,
            borderRightWidth: 1,
            borderColor: tier.border,
            borderTopWidth: prevSame ? 0 : 1,
            borderTopLeftRadius: prevSame ? 0 : 8,
            borderTopRightRadius: prevSame ? 0 : 8,
            borderBottomWidth: 1,
            borderBottomColor: nextSame ? THEME.colors.surfaceMuted : tier.border,
            borderBottomLeftRadius: nextSame ? 0 : 8,
            borderBottomRightRadius: nextSame ? 0 : 8,
          },
        ]}
        activeOpacity={0.7}
        onPress={() => onSelectPlayer({ userId: item.userId, username: item.username })}
      >
        {tier.gradient && (
          <LinearGradient
            colors={tier.gradient as [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardGradient}
          />
        )}
        {tier.accent && (
          <LinearGradient
            colors={tier.accent as [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={[
              styles.accent,
              {
                // One continuous line per connected group: segments meet
                // exactly at the row joints, rounded only at the group's
                // ends. Inset by the border so it never pokes past the edge.
                // Medal cards are standalone, so theirs is always complete.
                left: 1,
                width: medal ? 6 : 4,
                top: prevSame ? 0 : 1,
                bottom: nextSame ? 0 : 1,
                borderTopLeftRadius: prevSame ? 0 : 7,
                borderBottomLeftRadius: nextSame ? 0 : 7,
              },
            ]}
          />
        )}

        <View style={styles.rankCluster}>
          {tier.rankIcon && (
            <MaterialIcons name={tier.rankIcon} size={18} color={tier.rankIconColor} />
          )}
          <Text style={[styles.rankNum, { color: tier.rankColor }]}>{item.rank}</Text>
        </View>

        <LinearGradient
          colors={tier.ring as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.avatarRing,
            { padding: tier.ringWidth, borderRadius: 6 },
          ]}
        >
          <View
            style={[
              styles.avatarInner,
              { backgroundColor: '#F4F5F7', borderRadius: 4 },
            ]}
          >
            <View style={styles.avatarGloss} />
            <Text style={[styles.avatarInitial, { color: tier.nameColor }]}>
              {(item.username.charAt(0) || '?').toUpperCase()}
            </Text>
          </View>
        </LinearGradient>

        <View style={styles.playerDetails}>
          <Text style={[styles.playerName, { color: tier.nameColor }]} numberOfLines={1}>
            {item.username}
          </Text>
          <Text style={[styles.playerStats, { color: tier.statsColor }]}>
            <Text style={[styles.playerWins, { color: tier.winsColor }]}>{item.wins} W</Text>
            <Text style={{ color: tier.dotColor }}> • </Text>
            <Text>{item.winRate}% Win Rate</Text>
          </Text>
        </View>

        {isMe ? (
          <View style={styles.youPill}>
            <Text style={styles.youPillText}>YOU</Text>
          </View>
        ) : (
          <Text
            style={[styles.ratingValue, { color: tier.ratingColor, fontSize: tier.ratingSize }]}
          >
            {Math.round(item.rating).toLocaleString('en-US')}
          </Text>
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

      {!!rankError && (
        <View style={styles.rankNote}>
          <Text style={styles.rankNoteText}>{rankError}</Text>
        </View>
      )}

      {loading && entries.length === 0 ? (
        // No placeholder rows on this page: the leaderboard is a numbered
        // table, so fake rank rows read as real (and wrong) standings.
        // The header and pills render immediately and the cached window
        // lands a beat later.
        null
      ) : loadError ? (
        <NoConnectionSection
          kind={sectionKind(loadError.kind, isConnected)}
          onRetry={() => void fetchLeaderboard()}
        />
      ) : entries.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            title="NO RANKINGS YET"
            description="Play ranked matches to qualify for the global leaderboard."
          />
        </View>
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
              title="Your rank needs saving"
              message="Link Google to appear on leaderboard + save rank."
              secondaryLabel="Not now"
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
            <Text style={styles.notRankedTitle}>NOT RANKED YET</Text>
            <Text style={styles.notRankedSub}>
              Play a ranked match to earn your spot on the board.
            </Text>
            <TouchableOpacity
              style={styles.notRankedPlayBtn}
              activeOpacity={0.8}
              onPress={() => {
                setNotRanked(false);
                onQuickMatch();
              }}
              accessibilityLabel="Play a ranked match"
            >
              <Text style={styles.notRankedPlayText}>Play Ranked</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setNotRanked(false)}
              accessibilityLabel="Back to leaderboard"
            >
              <Text style={styles.notRankedBackText}>Back to leaderboard</Text>
            </TouchableOpacity>
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
    fontSize: 20,
    fontWeight: '700',
    color: THEME.colors.onSurface,
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
  // Not-ranked card: white card on the dim, with its own close.
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
  // Empty board: centered in the available space, like the not-ranked view.
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 48,
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
    paddingTop: 16,
    paddingBottom: 32,
    gap: 8,
    maxWidth: 460,
    width: '100%',
    alignSelf: 'center',
  },
  // Tier card shell: gradient (medals) or flat fill, border and shadow
  // come from the tier inline. Radius is a flat 12 per the tier spec.
  card: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  // Card gradient fill, rounded to match so no clipping wrapper (which
  // would eat the shadow) is needed.
  cardGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 8,
  },
  // Tier accent hugging the card's left edge. Geometry (inset, width,
  // radii) is set inline per tier so the bar always matches its card and
  // can never poke past the edge; absolute (not clipped) so shadows stay.
  accent: {
    position: 'absolute',
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
  rankCluster: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  rankNum: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
  },
  // 40px medallion: gradient ring outside, tinted face inside. Square
  // with softly rounded corners on every tier.
  avatarRing: {
    width: 40,
    height: 40,
  },
  avatarInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  // Gloss highlight for depth on the tinted face.
  avatarGloss: {
    position: 'absolute',
    top: 3,
    left: 7,
    width: 10,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  avatarInitial: {
    fontFamily: THEME.fonts.bold,
    fontSize: 15,
    fontWeight: '700',
  },
  playerDetails: {
    flex: 1,
  },
  playerName: {
    fontFamily: THEME.fonts.bold,
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  playerStats: {
    fontFamily: THEME.fonts.medium,
    fontSize: 12,
    marginTop: 2,
  },
  playerWins: {
    fontFamily: THEME.fonts.semiBold,
    fontWeight: '600',
  },
  ratingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ratingValue: {
    fontFamily: THEME.fonts.extraBold,
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


