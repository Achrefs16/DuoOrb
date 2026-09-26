import React, { useEffect, useState, useCallback } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { createInitialState } from '@duoorb/game-core';
import { THEME, playerColor } from '../theme';
import { getCurrentUser } from '../network/auth';
import {
  api,
  PublicProfileDto,
  RatingHistoryPointDto,
  HeadToHeadStats,
  GameHistoryItemDto,
} from '../network/apiClient';
import { RatingChart } from '../components/RatingChart';
import { LoadingState, EmptyState, ErrorState } from '../components/StateViews';
import { SavedGameRecord } from '../storage/gameStorage';

interface PlayerProfileScreenProps {
  userId: string;
  initialUsername?: string;
  onBack: () => void;
  onChallenge: (targetUser: { id: string; username: string }) => void;
  onSelectGame: (game: SavedGameRecord) => void;
}

type MatchFilter = 'ALL' | 'WINS' | 'LOSSES';

function formatJoinedAt(value?: string | number): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `Joined ${d.toLocaleString('en-US', { month: 'long', year: 'numeric' })}`;
}

function clockDisplayName(game: GameHistoryItemDto): string {
  if (game.mode === '2p') return 'Classic';
  const m = game.timeControlMinutes;
  const inc = game.incrementSeconds > 0 ? `+${game.incrementSeconds}` : '';
  return `${m}m${inc}`;
}

export const PlayerProfileScreen: React.FC<PlayerProfileScreenProps> = ({
  userId,
  initialUsername,
  onBack,
  onChallenge,
  onSelectGame,
}) => {
  const [profile, setProfile] = useState<PublicProfileDto | null>(null);
  const [ratingHistory, setRatingHistory] = useState<RatingHistoryPointDto[]>([]);
  const [headToHead, setHeadToHead] = useState<HeadToHeadStats | null>(null);
  const [theirGames, setTheirGames] = useState<GameHistoryItemDto[]>([]);
  const [isFriend, setIsFriend] = useState<boolean>(false);
  const [friendRequestSent, setFriendRequestSent] = useState<boolean>(false);
  const [filter, setFilter] = useState<MatchFilter>('ALL');
  const [recentVisible, setRecentVisible] = useState(5);
  const [showRemove, setShowRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPlayerData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pubProfile, rHistory, friendsList, myGamesRes, theirGamesRes] = await Promise.all([
        api.getPublicProfile(userId).catch(() => null),
        api.getRatingHistory(userId, 'CLASSIC_1V1', 20).catch(() => []),
        api.getFriends().catch(() => []),
        api.getMyHistory(50, 0).catch(() => ({ games: [], total: 0 })),
        api.getUserHistory(userId, 10, 0).catch(() => ({ games: [], total: 0 })),
      ]);

      if (pubProfile) {
        setProfile(pubProfile);
      } else {
        setProfile({
          id: userId,
          username: initialUsername || 'Player',
          displayName: initialUsername || 'Player',
          ratings: {
            CLASSIC_1V1: {
              rating: 1500,
              rd: 350,
              gamesPlayed: 0,
              wins: 0,
              losses: 0,
              winRate: 0,
            },
          },
        });
      }

      setRatingHistory(rHistory);
      setTheirGames([...theirGamesRes.games].sort((a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime()));
      const isAlreadyFriend = friendsList.some((f) => f.id === userId || f.username === initialUsername);
      setIsFriend(isAlreadyFriend);

      const h2h = api.computeHeadToHead(
        myGamesRes.games,
        userId,
        pubProfile?.username || initialUsername
      );
      setHeadToHead(h2h);
    } catch {
      setError('Unable to load player profile.');
    } finally {
      setLoading(false);
    }
  }, [userId, initialUsername]);

  useEffect(() => {
    loadPlayerData();
  }, [loadPlayerData]);

  const handleRemoveFriend = async () => {
    if (removing) return;
    setRemoving(true);
    try {
      await api.removeFriend(userId);
      setIsFriend(false);
      setShowRemove(false);
      onBack();
    } catch {
      // keep the menu open on failure
    } finally {
      setRemoving(false);
    }
  };

  const handleSendFriendRequest = async () => {
    if (!profile) return;
    try {
      await api.sendFriendRequest({ toUserId: profile.id, toUsername: profile.username });
      setFriendRequestSent(true);
    } catch {
      // ignore
    }
  };

  const handleGameTap = (serverGame: GameHistoryItemDto) => {
    api.getGameReplay(serverGame.gameId)
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

  const rating1v1 = profile?.ratings?.CLASSIC_1V1?.rating ?? 1500;
  const wins = profile?.ratings?.CLASSIC_1V1?.wins ?? 0;
  const losses = profile?.ratings?.CLASSIC_1V1?.losses ?? 0;
  const gamesPlayed = profile?.ratings?.CLASSIC_1V1?.gamesPlayed ?? (wins + losses);
  const winRate =
    gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;

  const filteredMatches = theirGames.filter((m) => {
    if (filter === 'WINS') return m.outcome === 'WIN';
    if (filter === 'LOSSES') return m.outcome === 'LOSS';
    return true;
  });
  const theirWins = theirGames.filter((g) => g.outcome === 'WIN').length;
  const theirLosses = theirGames.filter((g) => g.outcome === 'LOSS').length;

  // Month progression from their rating history (fallback: overall span).
  const monthAgo = Date.now() - 30 * 24 * 3600 * 1000;
  const recentPts = ratingHistory.filter((p) => new Date(p.timestamp).getTime() >= monthAgo);
  const spanPts = recentPts.length > 1 ? recentPts : ratingHistory;
  const monthDelta =
    spanPts.length > 1
      ? Math.round(spanPts[spanPts.length - 1].ratingAfter - spanPts[0].ratingAfter)
      : 0;

  const initial = (profile?.displayName || profile?.username || 'O').charAt(0).toUpperCase();
  const viewerName = getCurrentUser().displayName;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Feather name="arrow-left" size={20} color={THEME.colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.title}>Player Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Remove friend confirm */}
      <Modal visible={showRemove} transparent animationType="fade">
        <SafeAreaView style={styles.removeOverlay} edges={['top', 'bottom']}>
          <View style={styles.removeCard}>
            <Text style={styles.removeTitle}>
              Remove {profile?.displayName || profile?.username || 'friend'}?
            </Text>
            <Text style={styles.removeDesc}>
              You will no longer see each other in your friends lists.
            </Text>
            <View style={styles.removeActions}>
              <TouchableOpacity
                style={[styles.removeConfirm, removing && styles.removeBusy]}
                disabled={removing}
                onPress={() => void handleRemoveFriend()}
              >
                <Text style={styles.removeConfirmText}>
                  {removing ? 'Removing…' : 'Remove friend'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.removeCancel}
                onPress={() => setShowRemove(false)}
              >
                <Text style={styles.removeCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {loading ? (
        <LoadingState message="Loading player profile…" />
      ) : error ? (
        <ErrorState message={error} onRetry={loadPlayerData} />
      ) : (
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Identity Card */}
          <View style={styles.identityCard}>
            <View style={styles.identityTop}>
              <View style={styles.avatarBox}>
                <Text style={styles.avatarInitial}>{initial}</Text>
              </View>

              <View style={styles.identityMeta}>
                <Text style={styles.usernameText} numberOfLines={1}>
                  {profile?.displayName || profile?.username}
                </Text>
                {!!profile?.username && (
                  <Text style={styles.handleText} numberOfLines={1}>
                    @{profile.username}
                  </Text>
                )}
                {formatJoinedAt(profile?.createdAt) && (
                  <View style={styles.joinedRow}>
                    <Feather name="calendar" size={14} color="#64748B" />
                    <Text style={styles.joinedText}>{formatJoinedAt(profile?.createdAt)}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Stat boxes */}
            <View style={styles.statBoxes}>
              <View style={styles.statBox}>
                <Text style={styles.statBoxNumber}>{Math.round(rating1v1)}</Text>
                <Text style={styles.statBoxLabel}>Rating</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statBoxNumber, { color: '#2563EB' }]}>{winRate}%</Text>
                <Text style={styles.statBoxLabel}>Win Rate</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statBoxNumber}>{gamesPlayed}</Text>
                <Text style={styles.statBoxSub}>{wins}W · {losses}L</Text>
              </View>
            </View>

            {/* Action Buttons: Challenge & Add Friend */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.challengeBtn}
                activeOpacity={0.88}
                onPress={() => onChallenge({ id: profile!.id, username: profile!.username })}
              >
                <MaterialCommunityIcons name="sword-cross" size={20} color="#FFFFFF" />
                <Text style={styles.challengeBtnText}>Challenge</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.friendBtn,
                  friendRequestSent && styles.friendBtnActive,
                ]}
                activeOpacity={0.75}
                disabled={friendRequestSent}
                onPress={() => {
                  if (isFriend) {
                    setShowRemove(true);
                    return;
                  }
                  void handleSendFriendRequest();
                }}
              >
                <MaterialIcons
                  name={isFriend ? 'keyboard-arrow-down' : 'person-add'}
                  size={20}
                  color={friendRequestSent ? THEME.colors.textMuted : THEME.colors.textPrimary}
                />
                <Text
                  style={[
                    styles.friendBtnText,
                    friendRequestSent && styles.friendBtnTextActive,
                  ]}
                >
                  {isFriend ? 'Friends' : friendRequestSent ? 'Sent' : 'Add Friend'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* HEAD TO HEAD CARD (Stitch) */}
          <View style={styles.h2hCard}>
            <View style={styles.h2hTitleRow}>
              <View>
                <Text style={styles.h2hTitle}>Head-to-Head</Text>
                <Text style={styles.h2hSub}>Matches against You</Text>
              </View>
              <View style={styles.recordPill}>
                <Text style={styles.recordLabel}>Record: </Text>
                <Text style={styles.recordValue}>
                  {headToHead?.myWins ?? 0}W - {headToHead?.theirWins ?? 0}L
                </Text>
              </View>
            </View>

            <View style={styles.h2hBox}>
              <View style={styles.h2hSide}>
                <Text style={[styles.h2hScore, { color: '#DC2626' }]}>
                  {headToHead?.theirWins ?? 0}
                </Text>
                <Text style={styles.h2hSideLabel}>
                  {(profile?.displayName || profile?.username || 'Them').split(' ')[0]} Won
                </Text>
              </View>

              <View style={[styles.h2hSide, styles.h2hSideBorders]}>
                <Text style={[styles.h2hScore, { color: '#2563EB' }]}>
                  {headToHead?.myWinRate ?? 0}%
                </Text>
                <Text style={styles.h2hSideLabel}>Your Win Rate</Text>
              </View>

              <View style={styles.h2hSide}>
                <Text style={[styles.h2hScore, { color: '#007F36' }]}>
                  {headToHead?.myWins ?? 0}
                </Text>
                <Text style={styles.h2hSideLabel}>You Won</Text>
              </View>
            </View>

            {headToHead?.currentStreak && headToHead.currentStreak.count >= 2 && (
              <View style={styles.streakBanner}>
                <Feather name="award" size={14} color={THEME.colors.primary} />
                <Text style={styles.streakText}>
                  {headToHead.currentStreak.holder === 'YOU'
                    ? `You won ${headToHead.currentStreak.count} matches in a row!`
                    : `${profile?.username} won ${headToHead.currentStreak.count} in a row.`}
                </Text>
              </View>
            )}
          </View>

          {/* Rating Progression */}
          <View style={styles.chartCard}>
            <View style={styles.progHeaderRow}>
              <Text style={styles.progTitle}>Rating Progression</Text>
              <Text
                style={[
                  styles.progDelta,
                  monthDelta >= 0 ? styles.textWin : styles.textLoss,
                ]}
              >
                {monthDelta >= 0 ? `+${monthDelta}` : `${monthDelta}`} pts this month
              </Text>
            </View>
            <RatingChart data={ratingHistory} currentRating={Math.round(rating1v1)} showHeader={false} />
          </View>

          {/* Their recent matches */}
          <View style={styles.matchesSection}>            <View style={styles.matchesHeaderRow}>
              <Text style={styles.sectionHeading}>RECENT MATCHES</Text>
              <Text style={styles.matchesSub}>Latest {theirGames.length} games</Text>
            </View>

            {/* Filter Pills with counts */}
            <View style={styles.filterPillsRow}>
              {(['ALL', 'WINS', 'LOSSES'] as MatchFilter[]).map((f) => {
                const count =
                  f === 'ALL'
                    ? theirGames.length
                    : f === 'WINS'
                    ? theirWins
                    : theirLosses;
                return (
                  <TouchableOpacity
                    key={f}
                    style={[styles.filterPill, filter === f && styles.filterPillActive]}
                    onPress={() => {
                      setFilter(f);
                      setRecentVisible(5);
                    }}
                  >
                    <Text style={[styles.filterPillText, filter === f && styles.filterPillTextActive]}>
                      {f === 'ALL' ? 'All' : f === 'WINS' ? 'Wins' : 'Losses'} ({count})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {filteredMatches.length > 0 ? (
              <View style={styles.matchesList}>
                {filteredMatches.slice(0, recentVisible).map((match) => {
                  const isWin = match.outcome === 'WIN';
                  const opp = match.opponent?.displayName || match.opponent?.username || 'Opponent';
                  const oppRating = match.opponent?.ratingBefore ?? match.opponent?.ratingAfter;
                  const delta = match.myRating?.delta ?? 0;
                  const isViewer = opp === viewerName;
                  return (
                    <TouchableOpacity
                      key={match.gameId}
                      style={styles.matchItem}
                      activeOpacity={0.75}
                      onPress={() => handleGameTap(match)}
                    >
                      <View style={styles.matchLeft}>
                        <View style={[styles.resultBadge, isWin ? styles.badgeWin : styles.badgeLoss]}>
                          <Text style={[styles.resultBadgeText, isWin ? styles.textWin : styles.textLoss]}>
                            {isWin ? 'W' : 'L'}
                          </Text>
                        </View>
                        <View>
                          <Text style={styles.matchModeText}>
                            vs {opp}
                            {oppRating !== undefined && oppRating !== null ? (
                              <Text style={isViewer ? styles.ownRatingBlue : styles.oppRatingMuted}>
                                {' '}({Math.round(oppRating)})
                              </Text>
                            ) : null}
                          </Text>
                          <Text style={styles.matchDateText}>
                            {clockDisplayName(match)}
                            {match.isRanked ? ` · ${delta >= 0 ? `+${Math.round(delta)}` : `${Math.round(delta)}`} pts` : ''}
                          </Text>
                        </View>
                      </View>

                      <Feather name="chevron-right" size={20} color="#64748B" />
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyCardText}>No matches found in this category.</Text>
              </View>
            )}
            {filteredMatches.length > recentVisible && (
              <TouchableOpacity
                style={styles.loadMoreBtn}
                activeOpacity={0.8}
                onPress={() => setRecentVisible((v) => v + 5)}
              >
                <Text style={styles.loadMoreText}>Load more</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    height: 64,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: THEME.fonts.bold,
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  scrollArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
    maxWidth: 448,
    width: '100%',
    alignSelf: 'center',
    gap: 16,
  },
  identityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 16,
    gap: 16,
    ...THEME.shadows.card,
  },
  identityTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarBox: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#004AC6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  avatarInitial: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  identityMeta: {
    gap: 3,
    flex: 1,
  },
  usernameText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  handleText: {
    fontFamily: THEME.fonts.regular,
    fontSize: 12,
    color: '#64748B',
  },
  joinedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  joinedText: {
    fontFamily: THEME.fonts.regular,
    fontSize: 14,
    color: '#64748B',
  },
  statBoxes: {
    flexDirection: 'row',
    gap: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statBoxNumber: {
    fontFamily: THEME.fonts.bold,
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
    fontVariant: ['tabular-nums'],
  },
  statBoxLabel: {
    fontFamily: THEME.fonts.medium,
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  statBoxSub: {
    fontFamily: THEME.fonts.regular,
    fontSize: 11,
    fontWeight: '400',
    color: '#475569',
    marginTop: 2,
  },
  ratingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.surfaceContainerLow,
    alignSelf: 'flex-start',
  },
  ratingBadgeText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: THEME.colors.surfaceContainerLow,
    borderRadius: THEME.radius.md,
    paddingVertical: 10,
  },
  statCol: {
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: THEME.colors.surfaceContainer,
  },
  statVal: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.onSurface,
  },
  statLbl: {
    fontFamily: THEME.fonts.bold,
    fontSize: 9,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    letterSpacing: 0.8,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  challengeBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 4,
    backgroundColor: '#0F172A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...THEME.shadows.card,
  },
  challengeBtnText: {
    fontFamily: THEME.fonts.semiBold,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  friendBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  friendBtnActive: {
    opacity: 0.6,
  },
  friendBtnText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  friendBtnTextActive: {
    color: THEME.colors.textMuted,
  },
  h2hCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 16,
    gap: 12,
    ...THEME.shadows.card,
  },
  h2hTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  h2hTitle: {
    fontFamily: THEME.fonts.bold,
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  h2hSub: {
    fontFamily: THEME.fonts.regular,
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  recordPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  recordLabel: {
    fontFamily: THEME.fonts.medium,
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
  },
  recordValue: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 11,
    fontWeight: '600',
    color: '#2563EB',
    fontVariant: ['tabular-nums'],
  },
  h2hBox: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    padding: 12,
  },
  h2hSide: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  h2hSideBorders: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#E2E8F0',
  },
  h2hScore: {
    fontFamily: THEME.fonts.bold,
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    fontVariant: ['tabular-nums'],
  },
  h2hSideLabel: {
    fontFamily: THEME.fonts.medium,
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
    textAlign: 'center',
  },
  sectionHeading: {
    fontFamily: THEME.fonts.bold,
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    letterSpacing: 0.8,
  },
  h2hStage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  progHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progTitle: {
    fontFamily: THEME.fonts.bold,
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  progDelta: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  matchesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  matchesSub: {
    fontFamily: THEME.fonts.regular,
    fontSize: 12,
    color: '#64748B',
  },
  streakBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    borderRadius: 4,
    backgroundColor: '#EFF6FF',
  },
  streakText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 11,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 16,
    gap: 8,
    ...THEME.shadows.card,
  },
  matchesSection: {
    gap: 8,
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    alignSelf: 'flex-start',
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
  },
  filterPillActive: {
    backgroundColor: '#131B2E',
  },
  filterPillText: {
    fontFamily: THEME.fonts.medium,
    fontSize: 12,
    fontWeight: '500',
    color: '#475569',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  matchesList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    overflow: 'hidden',
    ...THEME.shadows.card,
  },
  matchItem: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  matchLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  resultBadge: {
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
  resultBadgeText: {
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
  matchModeText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  ownRatingBlue: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
  },
  oppRatingMuted: {
    fontFamily: THEME.fonts.regular,
    fontSize: 14,
    fontWeight: '400',
    color: '#64748B',
  },
  matchDateText: {
    fontFamily: THEME.fonts.regular,
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  emptyCard: {
    backgroundColor: THEME.colors.surfaceContainerLowest,
    borderRadius: THEME.radius.lg,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.surfaceContainer,
  },
  emptyCardText: {
    fontFamily: THEME.fonts.regular,
    fontSize: 12,
    color: THEME.colors.textMuted,
  },
  removeOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  removeCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  removeTitle: {
    fontFamily: THEME.fonts.bold,
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  removeDesc: {
    fontFamily: THEME.fonts.regular,
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 16,
    lineHeight: 19,
  },
  removeActions: {
    gap: 8,
  },
  removeConfirm: {
    backgroundColor: '#DC2626',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  removeBusy: {
    opacity: 0.6,
  },
  removeConfirmText: {
    fontFamily: THEME.fonts.bold,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  removeCancel: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  removeCancelText: {
    fontFamily: THEME.fonts.semiBold,
    color: '#475569',
    fontSize: 14,
    fontWeight: '600',
  },
  loadMoreBtn: {
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    alignItems: 'center',
  },
  loadMoreText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
});
