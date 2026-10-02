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
import { useIdentity } from '../network/auth';
import {
  api,
  EquippedBadgeDto,
  PublicProfileDto,
  RatingHistoryPointDto,
  HeadToHeadStats,
  GameHistoryItemDto,
} from '../network/apiClient';
import { RatingChart } from '../components/RatingChart';
import { GuestGate } from '../components/GuestGate';
import { toast } from '../components/AppToast';
import { actionMessage, kindOf, loadMessage, type ErrorKind } from '../network/errors';
import { ReportDialog } from '../components/ReportDialog';
import { LoadingState, EmptyState, ErrorState } from '../components/StateViews';
import { SavedGameRecord } from '../storage/gameStorage';

interface PlayerProfileScreenProps {
  userId: string;
  initialUsername?: string;
  onBack: () => void;
  onChallenge: (targetUser: { id: string; username: string }) => void;
  onSelectGame: (game: SavedGameRecord) => void;
  /**
   * Rendered as an overlay on top of a live match. Hides everything that
   * would navigate away (Challenge, replay entries): leaving the game
   * screen mid-match resigns the live game, so those actions must not be
   * reachable here. Add Friend stays — it is a plain API call.
   */
  inGame?: boolean;
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
  inGame = false,
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
  const [blocked, setBlocked] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [detailBadge, setDetailBadge] = useState<EquippedBadgeDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ message?: string; kind: ErrorKind } | null>(null);
  // The canonical identity, so "your" name in head-to-head comparisons is
  // never a value frozen at mount.
  const identity = useIdentity();
  // A guest viewer owns no friends and no head-to-head: friend actions and
  // the H2H/recent sections become the link lock. Challenge stays open.
  const viewerIsGuest = identity?.isGuest === true;

  const loadPlayerData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [pubSettled, rSettled, friendsSettled, myGamesSettled, theirGamesSettled] =
        await Promise.allSettled([
          api.getPublicProfile(userId),
          api.getRatingHistory(userId, 'CLASSIC_1V1', 20),
          api.getFriends(),
          api.getMyHistory(50, 0),
          api.getUserHistory(userId, 10, 0),
        ]);
      const pubProfile = pubSettled.status === 'fulfilled' ? pubSettled.value : null;

      try {
        const blockedRes = await api.isBlocked(userId);
        setBlocked(blockedRes);
      } catch (e) {
        // Keep the prior value (default Block): a failed probe must not flip
        // the button to Unblock.
        toast.show(actionMessage(e));
      }

      if (pubProfile) {
        setProfile(pubProfile);
      } else if (pubSettled.status === 'rejected') {
        // No profile AND the fetch failed: full error, never a fabricated
        // 1500 stand-in.
        setLoadError({
          message: loadMessage(pubSettled.reason),
          kind: kindOf(pubSettled.reason),
        });
        return;
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

      if (rSettled.status === 'fulfilled') setRatingHistory(rSettled.value);
      if (theirGamesSettled.status === 'fulfilled') {
        setTheirGames([...theirGamesSettled.value.games].sort((a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime()));
      }
      if (friendsSettled.status === 'fulfilled') {
        const friendsList = friendsSettled.value;
        const isAlreadyFriend = friendsList.some((f) => f.id === userId || f.username === initialUsername);
        setIsFriend(isAlreadyFriend);
      }

      if (myGamesSettled.status === 'fulfilled') {
        const h2h = api.computeHeadToHead(
          myGamesSettled.value.games,
          userId,
          pubProfile?.username || initialUsername
        );
        setHeadToHead(h2h);
      }
    } catch {
      setLoadError({ message: undefined, kind: 'UNKNOWN' });
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
    } catch (e) {
      // Keep the menu open on failure so retry is one tap away.
      toast.show(actionMessage(e));
    } finally {
      setRemoving(false);
    }
  };

  const handleSendFriendRequest = async () => {
    if (!profile) return;
    try {
      await api.sendFriendRequest({ toUserId: profile.id, toUsername: profile.username });
      setFriendRequestSent(true);
    } catch (e) {
      toast.show(actionMessage(e));
    }
  };

  const handleToggleBlock = async () => {
    if (blockBusy) return;
    setBlockBusy(true);
    try {
      if (blocked) {
        await api.unblockUser(userId);
        setBlocked(false);
      } else {
        await api.blockUser(userId);
        setBlocked(true);
        setIsFriend(false);
      }
    } catch (e) {
      // Keep current state on failure.
      toast.show(actionMessage(e));
    } finally {
      setBlockBusy(false);
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
      .catch(() => {
        toast.show("Couldn't open replay.");
      });
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
  const viewerName = identity?.displayName ?? '';

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
      ) : loadError ? (
        <ErrorState
          kind={loadError.kind}
          message={loadError.message}
          onRetry={() => void loadPlayerData()}
        />
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
                    <Feather name="calendar" size={14} color={THEME.colors.textSecondaryStrong} />
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
                <Text style={[styles.statBoxNumber, { color: THEME.colors.primary }]}>{winRate}%</Text>
                <Text style={styles.statBoxLabel}>Win Rate</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statBoxNumber}>{gamesPlayed}</Text>
                <Text style={styles.statBoxSub}>{wins}W · {losses}L</Text>
              </View>
            </View>

            {/* Action Buttons: Challenge & Add Friend. Challenge is hidden
                in a live-match overlay — it would navigate away and resign
                the game. */}
            <View style={styles.actionsRow}>
              {!inGame && (
              <TouchableOpacity
                style={styles.challengeBtn}
                activeOpacity={0.88}
                onPress={() => onChallenge({ id: profile!.id, username: profile!.username })}
              >
                <MaterialCommunityIcons name="sword-cross" size={20} color={THEME.colors.onPrimary} />
                <Text style={styles.challengeBtnText}>Challenge</Text>
              </TouchableOpacity>
              )}

              {!viewerIsGuest && (
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
              )}
            </View>

            {/* Safety row: Play UGC policy - block + report, always visible. */}
            <View style={styles.safetyRow}>
              <TouchableOpacity
                style={[styles.safetyBtn, blocked && styles.safetyBtnActive]}
                onPress={() => void handleToggleBlock()}
                disabled={blockBusy}
                accessibilityLabel={blocked ? 'Unblock player' : 'Block player'}
              >
                <Feather
                  name={blocked ? 'check-circle' : 'slash'}
                  size={15}
                  color={blocked ? THEME.colors.success : THEME.colors.danger}
                />
                <Text style={[styles.safetyText, blocked && styles.safetyTextActive]}>
                  {blockBusy ? '…' : blocked ? 'Unblock' : 'Block'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.safetyBtn}
                onPress={() => setShowReport(true)}
                accessibilityLabel="Report player"
              >
                <Feather name="flag" size={15} color={THEME.colors.textSecondary} />
                <Text style={styles.safetyText}>Report</Text>
              </TouchableOpacity>
            </View>
            {blocked && (
              <Text style={styles.blockedNote}>Blocked — you will not match or see requests from this player.</Text>
            )}
          </View>

          <ReportDialog
            visible={showReport}
            targetUserId={userId}
            targetUsername={profile?.username ?? initialUsername ?? 'player'}
            onClose={() => setShowReport(false)}
          />

          {/* Badge showcase — the 3 badges they equipped, plus hard-AI
              totals. Server-driven; hidden when the profile has none. */}
          {!!profile?.badges &&
            (profile.badges.equipped.length > 0 || profile.badges.hardWins > 0) && (
              <View style={styles.badgeCard}>
                <Text style={styles.sectionHeading}>SHOWCASE</Text>
                {profile.badges.equipped.length > 0 && (
                  <View style={styles.badgeRow}>
                    {profile.badges.equipped.map((badge) => (
                      <TouchableOpacity
                        key={badge.code}
                        style={styles.badgeChip}
                        activeOpacity={0.7}
                        onPress={() => setDetailBadge(badge)}
                        accessibilityLabel={`${badge.name}: details`}
                      >
                        <Feather
                          name={(badge.icon ?? 'award') as 'award'}
                          size={16}
                          color={THEME.colors.assessmentInaccuracy}
                        />
                        <Text style={styles.badgeName} numberOfLines={1}>
                          {badge.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                <Text style={styles.badgeStats}>
                  {profile.badges.hardWins > 0
                    ? `${profile.badges.hardWins} different Hard AI win${profile.badges.hardWins === 1 ? '' : 's'}`
                    : 'No hard-AI wins yet'}
                  {profile.badges.fastestPlies !== null && profile.badges.fastestPlies !== undefined
                    ? ` · fastest ${profile.badges.fastestPlies} moves`
                    : ''}
                </Text>
              </View>
            )}

          {/* HEAD TO HEAD CARD (Stitch) — guests get the link lock instead. */}
          {viewerIsGuest ? (
            <GuestGate
              title="Head-to-head needs saving"
              message="Link Google to save rating, friends, history & head-to-head."
              mini
            />
          ) : (
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
                <Text style={[styles.h2hScore, { color: THEME.colors.danger }]}>
                  {headToHead?.theirWins ?? 0}
                </Text>
                <Text style={styles.h2hSideLabel}>
                  {(profile?.displayName || profile?.username || 'Them').split(' ')[0]} Won
                </Text>
              </View>

              <View style={[styles.h2hSide, styles.h2hSideBorders]}>
                <Text style={[styles.h2hScore, { color: THEME.colors.primary }]}>
                  {headToHead?.myWinRate ?? 0}%
                </Text>
                <Text style={styles.h2hSideLabel}>Your Win Rate</Text>
              </View>

              <View style={styles.h2hSide}>
                <Text style={[styles.h2hScore, { color: THEME.colors.tertiaryContainer }]}>
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
          )}

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

          {/* Their recent matches — guests get the link lock instead. */}
          {viewerIsGuest ? (
            <GuestGate
              title="Recent matches need saving"
              message="Link Google to save rating, friends, history & head-to-head."
              mini
            />
          ) : (
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
                      activeOpacity={inGame ? 1 : 0.75}
                      onPress={inGame ? undefined : () => handleGameTap(match)}
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

                      <Feather name="chevron-right" size={20} color={THEME.colors.textSecondaryStrong} />
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
          )}
        </ScrollView>
      )}

      {/* Badge details (read-only for visitors): what it is and how to earn it. */}
      <Modal
        visible={detailBadge !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailBadge(null)}
      >
        <View style={styles.detailOverlay}>
          <View style={styles.detailCard}>
            <View style={styles.detailIconCircle}>
              <Feather
                name={((detailBadge?.icon ?? 'award') as 'award')}
                size={28}
                color={THEME.colors.assessmentInaccuracy}
              />
            </View>
            <Text style={styles.detailName}>{detailBadge?.name}</Text>
            <Text style={styles.detailDesc}>{detailBadge?.description}</Text>
            {!!detailBadge?.requirement && (
              <Text style={styles.detailReq}>{detailBadge.requirement}</Text>
            )}
            <TouchableOpacity
              style={styles.detailCloseBtn}
              activeOpacity={0.7}
              onPress={() => setDetailBadge(null)}
              accessibilityLabel="Close badge details"
            >
              <Text style={styles.detailCloseText}>Close</Text>
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
    backgroundColor: THEME.colors.drawBg,
  },
  header: {
    height: 64,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.colors.backgroundCard,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.surfaceMuted,
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
    color: THEME.colors.inverseLabel,
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
    backgroundColor: THEME.colors.backgroundCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceMuted,
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
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: THEME.colors.chartStroke,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  avatarInitial: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 22,
    fontWeight: '800',
    color: THEME.colors.onPrimary,
  },
  identityMeta: {
    gap: 3,
    flex: 1,
  },
  usernameText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.inverseLabel,
    letterSpacing: -0.2,
  },
  handleText: {
    fontFamily: THEME.fonts.regular,
    fontSize: 12,
    color: THEME.colors.textSecondaryStrong,
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
    color: THEME.colors.textSecondaryStrong,
  },
  statBoxes: {
    flexDirection: 'row',
    gap: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: THEME.colors.surfaceMuted,
    borderRadius: 4,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statBoxNumber: {
    fontFamily: THEME.fonts.bold,
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.inverseLabel,
    letterSpacing: -0.2,
    fontVariant: ['tabular-nums'],
  },
  statBoxLabel: {
    fontFamily: THEME.fonts.medium,
    fontSize: 11,
    fontWeight: '500',
    color: THEME.colors.textSecondaryStrong,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  statBoxSub: {
    fontFamily: THEME.fonts.regular,
    fontSize: 11,
    fontWeight: '400',
    color: THEME.colors.textOnMuted,
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
    backgroundColor: THEME.colors.inverseLabel,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...THEME.shadows.card,
  },
  challengeBtnText: {
    fontFamily: THEME.fonts.semiBold,
    color: THEME.colors.onPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  friendBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 4,
    backgroundColor: THEME.colors.slate[200],
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
    color: THEME.colors.inverseLabel,
  },
  friendBtnTextActive: {
    color: THEME.colors.textMuted,
  },
  safetyRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  safetyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.outlineVariant,
    backgroundColor: THEME.colors.surfaceMuted,
  },
  safetyBtnActive: {
    borderColor: THEME.colors.success,
  },
  safetyText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 13,
    color: THEME.colors.textSecondary,
  },
  safetyTextActive: {
    color: THEME.colors.success,
  },
  blockedNote: {
    fontFamily: THEME.fonts.medium,
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
  },
  h2hCard: {
    backgroundColor: THEME.colors.backgroundCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceMuted,
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
    color: THEME.colors.inverseLabel,
    letterSpacing: -0.2,
  },
  h2hSub: {
    fontFamily: THEME.fonts.regular,
    fontSize: 14,
    color: THEME.colors.textSecondaryStrong,
    marginTop: 2,
  },
  recordPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.slate[200],
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  recordLabel: {
    fontFamily: THEME.fonts.medium,
    fontSize: 11,
    fontWeight: '500',
    color: THEME.colors.textSecondaryStrong,
  },
  recordValue: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.primary,
    fontVariant: ['tabular-nums'],
  },
  h2hBox: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.surfaceMuted,
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
    borderColor: THEME.colors.surfaceHairline,
  },
  h2hScore: {
    fontFamily: THEME.fonts.bold,
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.inverseLabel,
    fontVariant: ['tabular-nums'],
  },
  h2hSideLabel: {
    fontFamily: THEME.fonts.medium,
    fontSize: 11,
    fontWeight: '500',
    color: THEME.colors.textSecondaryStrong,
    textAlign: 'center',
  },
  sectionHeading: {
    fontFamily: THEME.fonts.bold,
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    letterSpacing: 0.8,
  },
  badgeCard: {
    backgroundColor: THEME.colors.backgroundCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceMuted,
    padding: 16,
    gap: 10,
    ...THEME.shadows.card,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badgeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.colors.warningLight,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: THEME.colors.warningBorder,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: '100%',
  },
  badgeName: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.onSurface,
    flexShrink: 1,
  },
  badgeStats: {
    fontFamily: THEME.fonts.regular,
    fontSize: 12,
    color: THEME.colors.textSecondaryStrong,
    fontVariant: ['tabular-nums'],
  },
  detailOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  detailCard: {
    backgroundColor: THEME.colors.surfaceContainerLowest,
    borderRadius: THEME.radius.xl,
    padding: 24,
    maxWidth: 340,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.surfaceContainer,
    ...THEME.shadows.modal,
  },
  detailIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    backgroundColor: THEME.colors.warningLight,
    borderWidth: 1,
    borderColor: THEME.colors.warningBorder,
  },
  detailName: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 20,
    fontWeight: '800',
    color: THEME.colors.onSurface,
    textAlign: 'center',
  },
  detailDesc: {
    fontFamily: THEME.fonts.regular,
    fontSize: 14,
    color: THEME.colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: 4,
  },
  detailReq: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.primary,
    textAlign: 'center',
    marginTop: 8,
  },
  detailCloseBtn: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  detailCloseText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textMuted,
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
    color: THEME.colors.inverseLabel,
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
    color: THEME.colors.textSecondaryStrong,
  },
  streakBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    borderRadius: 4,
    backgroundColor: THEME.colors.surfacePrimaryTint,
  },
  streakText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.primaryDark,
  },
  chartCard: {
    backgroundColor: THEME.colors.backgroundCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceMuted,
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
    backgroundColor: THEME.colors.surfaceMuted,
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
  matchesList: {
    backgroundColor: THEME.colors.backgroundCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceMuted,
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
    borderBottomColor: THEME.colors.surfaceMuted,
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
    color: THEME.colors.inverseLabel,
  },
  ownRatingBlue: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.primary,
  },
  oppRatingMuted: {
    fontFamily: THEME.fonts.regular,
    fontSize: 14,
    fontWeight: '400',
    color: THEME.colors.textSecondaryStrong,
  },
  matchDateText: {
    fontFamily: THEME.fonts.regular,
    fontSize: 14,
    color: THEME.colors.textSecondaryStrong,
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
    backgroundColor: THEME.colors.backgroundCard,
    borderRadius: 16,
    padding: 20,
  },
  removeTitle: {
    fontFamily: THEME.fonts.bold,
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.inverseLabel,
    textAlign: 'center',
  },
  removeDesc: {
    fontFamily: THEME.fonts.regular,
    fontSize: 13,
    color: THEME.colors.textSecondaryStrong,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 16,
    lineHeight: 19,
  },
  removeActions: {
    gap: 8,
  },
  removeConfirm: {
    backgroundColor: THEME.colors.danger,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  removeBusy: {
    opacity: 0.6,
  },
  removeConfirmText: {
    fontFamily: THEME.fonts.bold,
    color: THEME.colors.onPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  removeCancel: {
    backgroundColor: THEME.colors.surfaceMuted,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  removeCancelText: {
    fontFamily: THEME.fonts.semiBold,
    color: THEME.colors.textOnMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  loadMoreBtn: {
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: THEME.colors.backgroundCard,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceMuted,
    alignItems: 'center',
  },
  loadMoreText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.inverseLabel,
  },
});
