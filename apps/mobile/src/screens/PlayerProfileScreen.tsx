import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
import { THEME, playerColor, useStyles } from '../theme';
import { useTranslation } from '../i18n';
import { useIdentity } from '../network/auth';
import { useConnectivity } from '../network/useConnectivity';
import {
  api,
  PublicProfileDto,
  RatingHistoryPointDto,
  HeadToHeadStats,
  GameHistoryItemDto,
  type AchievementsResponseDto,
} from '../network/apiClient';
import { AchievementsModal } from '../components/AchievementsModal';
import { MatchResultModal } from '../components/MatchResultModal';
import { RatingChart } from '../components/RatingChart';
import { GuestGate } from '../components/GuestGate';
import { PremiumBadge } from '../components/PremiumBadge';
import { toast } from '../components/AppToast';
import { NoConnectionSection } from '../components/NoConnection';
import { actionMessage, kindOf, loadMessage, sectionKind, type ErrorKind } from '../network/errors';
import { ReportDialog } from '../components/ReportDialog';
import { PlayerProfileSkeleton } from '../components/Skeleton';
import { AchievementMedal } from '../components/AchievementMedal';
import { SavedGameRecord } from '../storage/gameStorage';

interface PlayerProfileScreenProps {
  userId: string;
  initialUsername?: string;
  onBack: () => void;
  onChallenge: (targetUser: { id: string; username: string }) => void;
  onSelectGame: (game: SavedGameRecord) => void;
  /** Jumps straight to full review (same gate as everywhere else). */
  onAnalyzeGame: (game: SavedGameRecord) => void;
  /**
   * Rendered as an overlay on top of a live match. Hides everything that
   * would navigate away (Challenge, replay entries): leaving the game
   * screen mid-match resigns the live game, so those actions must not be
   * reachable here. Google Sign-In is hidden for the same reason — it opens
   * a browser mid-match (risking a grace-window forfeit while signing in),
   * and linking is only offered in the viewer's own Profile after the match
   * has finished. Add Friend stays — it is a plain API call.
   */
  inGame?: boolean;
}

type MatchFilter = 'ALL' | 'WINS' | 'LOSSES';

/**
 * Viewed profiles by userId. Opening the same opponent twice restores
 * instantly and refreshes silently. Skeleton only when never loaded.
 */
const playerCache = new Map<
  string,
  {
    profile: PublicProfileDto;
    ratingHistory: RatingHistoryPointDto[];
    theirGames: GameHistoryItemDto[];
    isFriend: boolean;
    headToHead: HeadToHeadStats | null;
  }
>();

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
  onAnalyzeGame,
  inGame = false,
}) => {
  const styles = useStyles(createStyles);
  const { t, language } = useTranslation();

  const formatJoined = (value?: string | number): string | null => {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    const dateStr = d.toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' });
    return t('profile.joined', { date: dateStr });
  };

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
  const [showAchievements, setShowAchievements] = useState(false);
  // Guest friend-request upsell: the disabled-looking button opens this,
  // never sends directly.
  const [showSignIn, setShowSignIn] = useState(false);
  // Overflow safety menu (block/report): closed by default, toggled only.
  const [showSafety, setShowSafety] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ message?: string; kind: ErrorKind } | null>(null);
  // Match detail modal (shared with History): row taps land here for
  // Replay / Analyse instead of opening the replay directly.
  const [selectedMatch, setSelectedMatch] = useState<GameHistoryItemDto | null>(null);
  // The canonical identity, so "your" name in head-to-head comparisons is
  // never a value frozen at mount.
  const identity = useIdentity();
  const { isConnected } = useConnectivity();
  // A guest viewer owns no friends and no head-to-head: friend actions and
  // the H2H/recent sections become the link lock — except inside a match,
  // where Google Sign-In is never offered (see inGame). Challenge stays open.
  const viewerIsGuest = identity?.isGuest === true;
  // The link lock itself: guests outside a match get the Save-with-Google
  // gate; guests inside one get neither the gate nor the locked data.
  const showLinkLock = viewerIsGuest && !inGame;

  /**
   * Their achievements in the same viewer as my Profile: equipped showcase
   * plus the full list, read-only. The server only sends another player's
   * equipped badges (no catalog, no progress), so the modal lists exactly
   * those — earned, with descriptions, no equip actions and no rarity
   * counts the server never sent.
   */
  const equippedBadges = profile?.badges?.equipped ?? [];
  const theirAchievements = useMemo((): AchievementsResponseDto | null => {
    const equipped = profile?.badges?.equipped ?? [];
    if (!profile?.badges || equipped.length === 0) return null;
    return {
      catalog: equipped.map((b) => ({ ...b, earned: true as const })),
      earned: equipped.map((b) => ({ ...b })),
      equipped,
      stats: {
        hardWins: profile.badges.hardWins,
        fastestPlies: profile.badges.fastestPlies,
      },
      owners: {},
    };
  }, [profile]);

  const loadPlayerData = useCallback(async (silent = false) => {
    // Silent = background refresh with data on screen: never flash a
    // skeleton, never replace the profile with an error.
    if (!silent) {
      setLoading(true);
      setLoadError(null);
    }
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
        // 1500 stand-in (first load only - a silent refresh keeps the screen).
        if (!silent) {
          setLoadError({
            message: loadMessage(pubSettled.reason),
            kind: kindOf(pubSettled.reason),
          });
        }
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
        // Cache for instant reopen. Failed slices reuse the previous entry.
        const prev = playerCache.get(userId);
        playerCache.set(userId, {
          profile: pubProfile ?? prev?.profile ?? {
            id: userId,
            username: initialUsername || 'Player',
            displayName: initialUsername || 'Player',
          },
          ratingHistory: rSettled.status === 'fulfilled' ? rSettled.value : prev?.ratingHistory ?? [],
          theirGames:
            theirGamesSettled.status === 'fulfilled'
              ? [...theirGamesSettled.value.games].sort((a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime())
              : prev?.theirGames ?? [],
          isFriend:
            friendsSettled.status === 'fulfilled'
              ? friendsSettled.value.some((f) => f.id === userId || f.username === initialUsername)
              : prev?.isFriend ?? false,
          headToHead: h2h,
        });
      }
    } catch {
      if (!silent) setLoadError({ message: undefined, kind: 'UNKNOWN' });
    } finally {
      setLoading(false);
    }
  }, [userId, initialUsername]);

  useEffect(() => {
    // Instant restore, silent refresh: header renders on the first frame.
    const cached = playerCache.get(userId);
    if (cached) {
      setProfile(cached.profile);
      setRatingHistory(cached.ratingHistory);
      setTheirGames(cached.theirGames);
      setIsFriend(cached.isFriend);
      setHeadToHead(cached.headToHead);
      setLoading(false);
      loadPlayerData(true);
    } else {
      loadPlayerData();
    }
  }, [loadPlayerData, userId]);

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

  const resolveRecord = (
    serverGame: GameHistoryItemDto,
    done: (record: SavedGameRecord) => void
  ) => {
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
          setSelectedMatch(null);
          done(record);
        }
      })
      .catch(() => {
        toast.show("Couldn't open replay.");
      });
  };

  const handleGameTap = (serverGame: GameHistoryItemDto) => {
    resolveRecord(serverGame, onSelectGame);
  };

  const handleGameAnalyze = (serverGame: GameHistoryItemDto) => {
    resolveRecord(serverGame, onAnalyzeGame);
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
        <Text style={styles.title}>{t('profile.playerTitle')}</Text>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => setShowSafety((v) => !v)}
          accessibilityLabel="More actions"
          accessibilityRole="button"
        >
          <MaterialIcons name="more-vert" size={20} color={THEME.colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Remove friend confirm */}
      <Modal visible={showRemove} transparent animationType="fade">
        <SafeAreaView style={styles.removeOverlay} edges={['top', 'bottom']}>
          <View style={styles.removeCard}>
            <Text style={styles.removeTitle}>
              {t('profile.removeFriendTitle', { name: profile?.displayName || profile?.username || 'friend' })}
            </Text>
            <Text style={styles.removeDesc}>
              {t('profile.removeFriendDesc')}
            </Text>
            <View style={styles.removeActions}>
              <TouchableOpacity
                style={[styles.removeConfirm, removing && styles.removeBusy]}
                disabled={removing}
                onPress={() => void handleRemoveFriend()}
              >
                <Text style={styles.removeConfirmText}>
                  {removing ? t('profile.removing') : t('profile.removeFriend')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.removeCancel}
                onPress={() => setShowRemove(false)}
              >
                <Text style={styles.removeCancelText}>{t('profile.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {loading && !profile ? (
        <PlayerProfileSkeleton />
      ) : loadError ? (
        <NoConnectionSection
          kind={sectionKind(loadError.kind, isConnected)}
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
                  {profile?.isPremium === true && (
                    <Text>
                      {' '}<PremiumBadge />
                    </Text>
                  )}
                </Text>
                {!!profile?.username && (
                  <Text style={styles.handleText} numberOfLines={1}>
                    @{profile.username}
                  </Text>
                )}
                {formatJoined(profile?.createdAt) && (
                  <View style={styles.joinedRow}>
                    <Feather name="calendar" size={14} color={THEME.colors.textSecondaryStrong} />
                    <Text style={styles.joinedText}>{formatJoined(profile?.createdAt)}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Stat boxes */}
            <View style={styles.statBoxes}>
              <View style={styles.statBox}>
                <Text style={styles.statBoxNumber}>{Math.round(rating1v1)}</Text>
                <Text style={styles.statBoxLabel}>{t('profile.rating')}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statBoxNumber, { color: THEME.colors.primary }]}>{winRate}%</Text>
                <Text style={styles.statBoxLabel}>{t('profile.winRate')}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statBoxNumber}>{gamesPlayed}</Text>
                <Text style={styles.statBoxSub}>{t('profile.record', { wins, losses })}</Text>
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
                <Text style={styles.challengeBtnText}>{t('profile.challenge')}</Text>
              </TouchableOpacity>
              )}

              {/* Friend action: always visible. Blocked players get Unblock
                  here instead of any friend request action; guests get a
                  disabled-looking button that opens the sign-in modal. */}
              <TouchableOpacity
                style={[
                  styles.friendBtn,
                  friendRequestSent && !viewerIsGuest && !blocked && styles.friendBtnActive,
                  viewerIsGuest && !blocked && styles.friendBtnGuest,
                ]}
                activeOpacity={0.75}
                disabled={(friendRequestSent && !viewerIsGuest && !blocked) || (blocked && blockBusy)}
                onPress={() => {
                  if (blocked) {
                    void handleToggleBlock();
                    return;
                  }
                  if (viewerIsGuest) {
                    setShowSignIn(true);
                    return;
                  }
                  if (isFriend) {
                    setShowRemove(true);
                    return;
                  }
                  void handleSendFriendRequest();
                }}
                accessibilityLabel={
                  blocked ? 'Unblock player' : viewerIsGuest ? 'Add Friend (sign in required)' : 'Friend action'
                }
              >
                <MaterialIcons
                  name={blocked ? 'block' : viewerIsGuest ? 'person-add' : isFriend ? 'keyboard-arrow-down' : 'person-add'}
                  size={20}
                  color={blocked ? THEME.colors.textPrimary : viewerIsGuest ? THEME.colors.textMuted : friendRequestSent ? THEME.colors.textMuted : THEME.colors.textPrimary}
                />
                <Text
                  style={[
                    styles.friendBtnText,
                    (friendRequestSent || viewerIsGuest) && !blocked && styles.friendBtnTextActive,
                  ]}
                >
                  {blocked
                    ? blockBusy
                      ? '…'
                      : t('profile.unblock')
                    : viewerIsGuest
                    ? t('profile.addFriend')
                    : isFriend
                    ? t('profile.friends')
                    : friendRequestSent
                    ? t('profile.sent')
                    : t('profile.addFriend')}
                </Text>
              </TouchableOpacity>
            </View>

          {/* Overflow safety actions are header-anchored (see the floating
              menu below), not inline buttons. The main actions above stay
              visually dominant. */}
            {blocked && (
              <Text style={styles.blockedNote}>{t('profile.blockedNote')}</Text>
            )}
          </View>

          <ReportDialog
            visible={showReport}
            targetUserId={userId}
            targetUsername={profile?.username ?? initialUsername ?? 'player'}
            onClose={() => setShowReport(false)}
          />

          {/* Guest sign-in, opened from the faded Add Friend button. The
              existing Save with Google card is the whole content — no second
              copy of it anywhere else on this profile. Closes itself the
              moment linking succeeds (GuestGate unmounts for linked users). */}
          <Modal
            visible={showSignIn && viewerIsGuest}
            transparent
            animationType="none"
            onRequestClose={() => setShowSignIn(false)}
          >
            <View style={styles.signInOverlay}>
              <View style={styles.signInCard}>
                <GuestGate
                  title={t('profile.saveToFriendsTitle')}
                  message={t('profile.saveToFriendsMessage')}
                  secondaryLabel={t('profile.notNow')}
                  onSecondary={() => setShowSignIn(false)}
                  mini
                />
              </View>
            </View>
          </Modal>

          {/* ACHIEVEMENTS — the same viewer as my Profile: equipped
              showcase plus the full list. Read-only here (see
              theirAchievements): no equip, no unearned states. */}
          {!!profile?.badges && (
            <View style={styles.achSection}>
              <View style={styles.achHeaderRow}>
                <Text style={styles.sectionHeading}>{t('profile.achievements')}</Text>
                <Text style={styles.achCount}>{t('profile.equippedCount', { count: equippedBadges.length })}</Text>
              </View>
              <View style={styles.showcaseRow}>
                {[0, 1, 2].map((slot) => {
                  const badge = equippedBadges.find((b) => b.slot === slot);
                  return (
                    <TouchableOpacity
                      key={slot}
                      style={styles.showcaseCell}
                      activeOpacity={0.7}
                      disabled={!badge}
                      onPress={() => setShowAchievements(true)}
                      accessibilityLabel={badge ? `${badge.name}: details` : `Showcase slot ${slot + 1} empty`}
                    >
                      {badge ? (
                        <>
                          <AchievementMedal icon={badge.icon} tier={badge.tier} size={52} />
                          <Text style={styles.showcaseName} numberOfLines={1}>
                            {badge.name}
                          </Text>
                        </>
                      ) : (
                        <>
                          <View style={styles.showcaseEmpty} />
                          <Text style={styles.showcaseEmptyText}>{t('profile.slot', { n: slot + 1 })}</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
              {(profile.badges.hardWins > 0 || profile.badges.fastestPlies !== null) && (
                <Text style={styles.achStats}>
                  {profile.badges.hardWins > 0
                    ? `${profile.badges.hardWins} different Hard AI win${profile.badges.hardWins === 1 ? '' : 's'}`
                    : 'No hard-AI wins yet'}
                  {profile.badges.fastestPlies !== null && profile.badges.fastestPlies !== undefined
                    ? ` · fastest ${profile.badges.fastestPlies} moves`
                    : ''}
                </Text>
              )}
              {theirAchievements && (
                <TouchableOpacity
                  style={styles.viewAllBtn}
                  activeOpacity={0.8}
                  onPress={() => setShowAchievements(true)}
                  accessibilityLabel={t('profile.viewAllAchievements')}
                  accessibilityRole="button"
                >
                  <Feather name="grid" size={15} color={THEME.colors.textPrimary} />
                  <Text style={styles.viewAllText}>{t('profile.viewAllAchievements')}</Text>
                  <Feather name="chevron-right" size={16} color={THEME.colors.textPrimary} />
                </TouchableOpacity>
              )}
            </View>
          )}
          {theirAchievements && (
            <AchievementsModal
              visible={showAchievements}
              achievements={theirAchievements}
              onToggleEquip={() => {}}
              onClose={() => setShowAchievements(false)}
              readOnly
            />
          )}

          {/* HEAD TO HEAD CARD (Stitch) — guests get the link lock instead,
              unless this is the in-match overlay, where sign-in is hidden. */}
          {showLinkLock && (
            <GuestGate
              title={t('profile.keepEveryMatch')}
              message={t('profile.keepEveryMatchDesc')}
              mini
            />
          )}
          {!viewerIsGuest && (
          <View style={styles.h2hCard}>
            <View style={styles.h2hTitleRow}>
              <View>
                <Text style={styles.h2hTitle}>{t('profile.headToHead')}</Text>
                <Text style={styles.h2hSub}>{t('profile.matchesAgainstYou')}</Text>
              </View>
              <View style={styles.recordPill}>
                <Text style={styles.recordLabel}>{t('profile.recordLabel')}</Text>
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
                  {t('profile.theyWon', { name: (profile?.displayName || profile?.username || 'Them').split(' ')[0] })}
                </Text>
              </View>

              <View style={[styles.h2hSide, styles.h2hSideBorders]}>
                <Text style={[styles.h2hScore, { color: THEME.colors.primary }]}>
                  {headToHead?.myWinRate ?? 0}%
                </Text>
                <Text style={styles.h2hSideLabel}>{t('profile.yourWinRate')}</Text>
              </View>

              <View style={styles.h2hSide}>
                <Text style={[styles.h2hScore, { color: THEME.colors.tertiaryContainer }]}>
                  {headToHead?.myWins ?? 0}
                </Text>
                <Text style={styles.h2hSideLabel}>{t('profile.youWon')}</Text>
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
              <Text style={styles.progTitle}>{t('profile.ratingHistory')}</Text>
              <Text
                style={[
                  styles.progDelta,
                  monthDelta >= 0 ? styles.textWin : styles.textLoss,
                ]}
              >
                {t('profile.ptsThisMonth', { delta: monthDelta >= 0 ? `+${monthDelta}` : `${monthDelta}` })}
              </Text>
            </View>
            <RatingChart data={ratingHistory} currentRating={Math.round(rating1v1)} showHeader={false} />
          </View>

          {/* Their recent matches — public record, visible to everyone
              including guests. No second sign-in card here: the only
              Google prompt on this profile lives in the head-to-head lock
              (and the friend button's modal, on demand). */}
          <View style={styles.matchesSection}>
            <View style={styles.matchesHeaderRow}>
              <Text style={styles.sectionHeading}>{t('profile.recentMatches')}</Text>
              <Text style={styles.matchesSub}>{t('profile.latestGames', { count: theirGames.length })}</Text>
            </View>

            {theirGames.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyCardText}>{t('profile.noMatches')}</Text>
                <Text style={styles.emptyCardSub}>{t('profile.noMatchesSub')}</Text>
              </View>
            ) : (
              <>
            {/* Filter Pills with counts */}
            <View style={styles.filterPillsRow}>
              {(['ALL', 'WINS', 'LOSSES'] as MatchFilter[]).map((f) => {
                const count =
                  f === 'ALL'
                    ? theirGames.length
                    : f === 'WINS'
                    ? theirWins
                    : theirLosses;
                const label = f === 'ALL' ? t('profile.all') : f === 'WINS' ? t('profile.wins') : t('profile.losses');
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
                      {label} ({count})
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
                      onPress={inGame ? undefined : () => setSelectedMatch(match)}
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
                <Text style={styles.emptyCardText}>{t('profile.noMatches')}</Text>
              </View>
            )}
            {filteredMatches.length > recentVisible && (
              <TouchableOpacity
                style={styles.loadMoreBtn}
                activeOpacity={0.8}
                onPress={() => setRecentVisible((v) => v + 5)}
              >
                <Text style={styles.loadMoreText}>{t('profile.loadMore')}</Text>
              </TouchableOpacity>
            )}
              </>
            )}
          </View>
        </ScrollView>
      )}

      {/* Floating overflow menu: anchored top-right under the header, above
          everything. Opens and closes without moving a single pixel of the
          profile layout underneath. */}
      {showSafety && (
        <>
          <TouchableOpacity
            style={styles.menuBackdrop}
            activeOpacity={1}
            onPress={() => setShowSafety(false)}
            accessibilityLabel="Close menu"
          />
          <View style={styles.safetyMenuFloat}>
            <TouchableOpacity
              style={styles.safetyItem}
              activeOpacity={0.7}
              onPress={() => {
                setShowSafety(false);
                void handleToggleBlock();
              }}
              disabled={blockBusy}
              accessibilityLabel={blocked ? `${t('profile.unblock')} player` : `${t('profile.block')} player`}
            >
              <Feather
                name={blocked ? 'check-circle' : 'slash'}
                size={15}
                color={THEME.colors.textSecondary}
              />
              <Text style={styles.safetyItemText}>
                {blockBusy ? '…' : blocked ? t('profile.unblock') : t('profile.block')}
              </Text>
            </TouchableOpacity>
            <View style={styles.safetyDivider} />
            <TouchableOpacity
              style={styles.safetyItem}
              activeOpacity={0.7}
              onPress={() => {
                setShowSafety(false);
                setShowReport(true);
              }}
              accessibilityLabel={`${t('profile.report')} player`}
            >
              <Feather name="flag" size={15} color={THEME.colors.textSecondary} />
              <Text style={styles.safetyItemText}>{t('profile.report')}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Match detail modal (shared with History): Replay / Analyse. */}
      <MatchResultModal
        match={inGame ? null : selectedMatch}
        onClose={() => setSelectedMatch(null)}
        onReplay={handleGameTap}
        onAnalyze={handleGameAnalyze}
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
    backgroundColor: THEME.colors.surfaceHairline,
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
  // Guest friend button: the action exists but the account does not — light
  // neutral, muted, faded, bordered. Deliberately not the blue CTA. Still
  // tappable: it opens the sign-in modal instead of sending.
  friendBtnGuest: {
    backgroundColor: THEME.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceHairline,
    opacity: 0.75,
  },
  // Floating overflow menu: backdrop + card anchored top-right under the
  // header, above everything (zIndex + elevation). Opens and closes without
  // moving any profile layout. Quiet by design: white card, muted rows.
  menuBackdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 20,
  },
  safetyMenuFloat: {
    position: 'absolute',
    top: 72,
    right: 12,
    width: 200,
    backgroundColor: THEME.colors.backgroundCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceHairline,
    overflow: 'hidden',
    zIndex: 30,
    ...THEME.shadows.card,
  },
  safetyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    height: 44,
  },
  safetyDivider: {
    height: 1,
    backgroundColor: THEME.colors.surfaceMuted,
    marginLeft: 43,
  },
  safetyItemText: {
    fontFamily: THEME.fonts.medium,
    fontSize: 14,
    color: THEME.colors.textSecondary,
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
    backgroundColor: THEME.colors.surfaceHairline,
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
  // Achievements viewer — same card as my Profile: heading + count,
  // 3-slot showcase, View All. Read-only here (see theirAchievements).
  achSection: {
    gap: 8,
  },
  achHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  achCount: {
    fontFamily: THEME.fonts.regular,
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  showcaseRow: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: THEME.colors.backgroundCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceMuted,
    paddingVertical: 12,
    ...THEME.shadows.card,
  },
  showcaseCell: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  showcaseName: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 10,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    textAlign: 'center',
  },
  showcaseEmpty: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: THEME.colors.boardBorder,
  },
  showcaseEmptyText: {
    fontFamily: THEME.fonts.medium,
    fontSize: 10,
    color: THEME.colors.textMuted,
  },
  achStats: {
    fontFamily: THEME.fonts.regular,
    fontSize: 12,
    color: THEME.colors.textSecondaryStrong,
    fontVariant: ['tabular-nums'],
    paddingHorizontal: 2,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 42,
    borderRadius: 10,
    backgroundColor: THEME.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceHairline,
  },
  viewAllText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
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
  emptyCardSub: {
    fontFamily: THEME.fonts.regular,
    fontSize: 12,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  // Guest sign-in dialog: instant dim, card from the shared gate.
  signInOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  signInCard: {
    maxWidth: 340,
    width: '100%',
    alignItems: 'center',
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
