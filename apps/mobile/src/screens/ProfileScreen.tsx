import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { OrbIcon } from '../components/OrbIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createInitialState } from '@duoorb/game-core';
import { THEME, useStyles } from '../theme';
import { useTranslation } from '../i18n';
import { useSession } from '../network/session';
import { useConnectivity } from '../network/useConnectivity';
import {
  api,
  AchievementsResponseDto,
  UserMeDto,
  RatingHistoryPointDto,
  GameHistoryItemDto,
} from '../network/apiClient';
import { RatingChart } from '../components/RatingChart';
import { AdBanner } from '../components/AdBanner';
import { BOTTOM_NAV_HEIGHT } from '../components/BottomNav';
import {
  AchievementMedal,
  BadgeProgressBar,
  CATEGORY_META,
  METALS,
  categoryOf,
  tierOf,
} from '../components/AchievementMedal';
import { AchievementsModal } from '../components/AchievementsModal';
import { MatchResultModal } from '../components/MatchResultModal';
import { GuestGate } from '../components/GuestGate';
import { PremiumBadge } from '../components/PremiumBadge';
import { isPremiumActive, refreshPremium, usePremium } from '../monetization/premium';
import { toast } from '../components/AppToast';
import { NoConnectionSection } from '../components/NoConnection';
import { actionMessage, kindOf, loadMessage, sectionKind, type ErrorKind } from '../network/errors';
import { ProfileSkeleton } from '../components/Skeleton';
import { SavedGameRecord, loadGameHistory, saveSettings } from '../storage/gameStorage';
import { CosmeticsCustomizerModal } from '../components/CosmeticsCustomizerModal';
import { PremiumSheet } from '../components/PremiumSheet';
import {
  COSMETIC_SKINS,
  useBallSkinId,
  useWallSkinId,
  setBallSkinId,
  setWallSkinId,
} from '../theme/cosmeticsCatalog';
import {
  deviceHistoryGames,
  mapLocalGameToHistoryItem,
  mergeHistoryItems,
} from '../lib/historyMerge';
import { modeDisplayName } from '../matchModes';

interface ProfileScreenProps {
  onOpenSettings: () => void;
  onOpenHistory?: () => void;
  onSelectGame?: (game: SavedGameRecord) => void;
  onAnalyzeGame?: (game: SavedGameRecord) => void;
  /** Opens the shared player profile for a recent match's opponent. */
  onOpenPlayerProfile?: (player: { userId: string; username: string }) => void;
}

type OutcomeFilter = 'ALL' | 'WINS' | 'LOSSES';

const PAGE_SIZE = 10;

/**
 * Last loaded bundle, keyed by account. Tab switches remount this screen,
 * so the previous profile and match history render on the first frame and
 * refresh silently.
 */
let profileCache: {
  userId: string;
  profile: UserMeDto;
  ratingHistory: RatingHistoryPointDto[];
  achievements: AchievementsResponseDto | null;
  games: GameHistoryItemDto[];
  localGames: SavedGameRecord[];
  serverLoaded: number;
  serverTotal: number;
} | null = null;

function formatJoinedAt(value?: string | number): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `Joined ${d.toLocaleString('en-US', { month: 'long', year: 'numeric' })}`;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  onOpenSettings,
  onOpenHistory,
  onSelectGame,
  onAnalyzeGame,
  onOpenPlayerProfile,
}) => {
  const styles = useStyles(createStyles);
  const { t, language } = useTranslation();
  const insets = useSafeAreaInsets();
  const { identity } = useSession();
  const isGuest = identity?.isGuest === true;
  const userId = identity?.userId;
  const { isConnected } = useConnectivity();
  // Own badge reads the live entitlement store (same source as every gate),
  // not the fetched profile snapshot — it flips the moment a purchase lands.
  const premiumState = usePremium();
  const showOwnBadge = isPremiumActive(premiumState);

  const [profile, setProfile] = useState<UserMeDto | null>(null);
  const [ratingHistory, setRatingHistory] = useState<RatingHistoryPointDto[]>([]);
  const [achievements, setAchievements] = useState<AchievementsResponseDto | null>(null);
  const [equipping, setEquipping] = useState(false);
  const [detailCode, setDetailCode] = useState<string | null>(null);
  const [showAchievements, setShowAchievements] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ message?: string; kind: ErrorKind } | null>(null);

  // Equipment & Style customization state
  const [cosmeticsCategory, setCosmeticsCategory] = useState<'ball' | 'wall' | null>(null);
  const [premiumOpen, setPremiumOpen] = useState(false);
  const equippedBallId = useBallSkinId();
  const equippedWallId = useWallSkinId();

  const activeBall = COSMETIC_SKINS[equippedBallId] ?? null;
  const activeWall = COSMETIC_SKINS[equippedWallId] ?? null;

  const handleEquipBall = useCallback((id: string) => {
    setBallSkinId(id);
    void saveSettings({ ballSkinId: id });
  }, []);

  const handleEquipWall = useCallback((id: string) => {
    setWallSkinId(id);
    void saveSettings({ wallSkinId: id });
  }, []);

  // Match History state
  const [games, setGames] = useState<GameHistoryItemDto[]>([]);
  const [localGames, setLocalGames] = useState<SavedGameRecord[]>([]);
  const [filter, setFilter] = useState<OutcomeFilter>('ALL');
  const [recentVisible, setRecentVisible] = useState(5);
  const [selectedMatch, setSelectedMatch] = useState<GameHistoryItemDto | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  // Render mirrors of the refs above: refs drive async pagination, state
  // drives the footer so it can update without reading refs during render.
  const [serverLoaded, setServerLoaded] = useState(0);
  const [serverTotal, setServerTotal] = useState(0);
  const offsetRef = useRef(0);
  const serverTotalRef = useRef(0);
  const gamesRef = useRef<GameHistoryItemDto[]>([]);
  // Synchronous guard: state alone lets a double-tap fire two pages at the
  // same offset, which then skips a page of history.
  const loadingMoreRef = useRef(false);
  // Latest history request wins, so a slow silent refresh cannot overwrite a
  // page the player just loaded.
  const historySeqRef = useRef(0);

  const formatJoined = (value?: string | number): string | null => {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    const dateStr = d.toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' });
    return t('profile.joined', { date: dateStr });
  };

  const fetchProfileData = useCallback(async (silent = false) => {
    // Silent = background refresh with data on screen: never flash a
    // skeleton, never replace the profile with an error.
    const seq = ++historySeqRef.current;
    if (!silent) {
      setLoading(true);
      setLoadError(null);
    }
    try {
      let me: UserMeDto | null = null;
      let meError: unknown = null;
      try {
        me = await api.getMe();
      } catch (e) {
        meError = e;
      }
      if (seq !== historySeqRef.current) return;
      if (me) {
        setProfile(me);
        const prev = profileCache?.userId === me.id ? profileCache : null;
        // Refresh the whole window already on screen, not just page 1: a
        // silent remount must not throw away pages the player loaded.
        const historyLimit = Math.max(PAGE_SIZE, prev?.serverLoaded ?? offsetRef.current);
        const [rSettled, aSettled, localSaved, historySettled] = await Promise.allSettled([
          api.getRatingHistory(me.id, 'CLASSIC_1V1', 20),
          api.getMyAchievements(),
          loadGameHistory(),
          isGuest
            ? Promise.resolve({ games: [], total: 0 })
            : api.getMyHistory(historyLimit, 0),
        ]);
        if (seq !== historySeqRef.current) return;

        if (rSettled.status === 'fulfilled') setRatingHistory(rSettled.value);
        if (aSettled.status === 'fulfilled') setAchievements(aSettled.value);

        const savedLocal = localSaved.status === 'fulfilled' ? localSaved.value : prev?.localGames ?? [];
        setLocalGames(savedLocal);

        const historyError = historySettled.status === 'rejected' ? historySettled.reason : null;
        const serverRes = historySettled.status === 'fulfilled' ? historySettled.value : null;
        const device = deviceHistoryGames(savedLocal);
        const localItems = device.map(mapLocalGameToHistoryItem);

        if (serverRes) {
          const serverGames = serverRes.games;
          const merged = mergeHistoryItems(serverGames, localItems);
          setGames(merged);
          gamesRef.current = merged;
          offsetRef.current = serverGames.length;
          serverTotalRef.current = serverRes.total;
          setServerLoaded(serverGames.length);
          setServerTotal(serverRes.total);

          profileCache = {
            userId: me.id,
            profile: me,
            ratingHistory: rSettled.status === 'fulfilled' ? rSettled.value : prev?.ratingHistory ?? [],
            achievements: aSettled.status === 'fulfilled' ? aSettled.value : prev?.achievements ?? null,
            games: merged,
            localGames: savedLocal,
            serverLoaded: serverGames.length,
            serverTotal: serverRes.total,
          };
        } else {
          // History request failed: keep every server row already loaded.
          // Only the device games are refreshed; counters stay put.
          const previousGames = prev?.games ?? gamesRef.current;
          const merged = previousGames.length > 0
            ? mergeHistoryItems(previousGames, localItems)
            : localItems;
          const keptLoaded = prev?.serverLoaded ?? offsetRef.current;
          const keptTotal = prev?.serverTotal ?? serverTotalRef.current;

          setGames(merged);
          gamesRef.current = merged;
          offsetRef.current = keptLoaded;
          serverTotalRef.current = keptTotal;
          setServerLoaded(keptLoaded);
          setServerTotal(keptTotal);

          if (prev) {
            profileCache = {
              ...prev,
              profile: me,
              localGames: savedLocal,
              games: merged,
            };
          } else if (!silent && merged.length === 0 && !isGuest) {
            setLoadError({
              message: loadMessage(historyError),
              kind: kindOf(historyError),
            });
          }
        }
      } else {
        // Fallback for offline: load device matches, but never erase a list
        // that is already on screen.
        const prev =
          userId && profileCache?.userId === userId ? profileCache : null;
        try {
          const savedLocal = await loadGameHistory();
          setLocalGames(savedLocal);
          const device = deviceHistoryGames(savedLocal);
          const localItems = device.map(mapLocalGameToHistoryItem);
          const previousGames = prev?.games ?? gamesRef.current;
          const merged = previousGames.length > 0
            ? mergeHistoryItems(previousGames, localItems)
            : localItems;
          const keptLoaded = prev?.serverLoaded ?? offsetRef.current;
          const keptTotal = prev?.serverTotal ?? serverTotalRef.current;

          setGames(merged);
          gamesRef.current = merged;
          offsetRef.current = keptLoaded;
          serverTotalRef.current = keptTotal;
          setServerLoaded(keptLoaded);
          setServerTotal(keptTotal);

          if (prev) {
            profileCache = {
              ...prev,
              localGames: savedLocal,
              games: merged,
            };
          }
        } catch {}

        if (!silent && !prev) {
          setLoadError({ message: loadMessage(meError), kind: kindOf(meError) });
        }
      }
    } catch {
      if (!silent && seq === historySeqRef.current) {
        setLoadError({ message: undefined, kind: 'UNKNOWN' });
      }
    } finally {
      if (seq === historySeqRef.current) setLoading(false);
    }
  }, [isGuest, userId]);

  useEffect(() => {
    gamesRef.current = games;
  }, [games]);

  // Invalidate any in-flight history request when this screen unmounts, so a
  // remounted screen's cache cannot be overwritten by the old instance.
  useEffect(() => () => {
    historySeqRef.current += 1;
  }, []);

  useEffect(() => {
    const mine = userId && profileCache?.userId === userId ? profileCache : null;
    if (mine) {
      setProfile(mine.profile);
      setRatingHistory(mine.ratingHistory);
      setAchievements(mine.achievements);
      setGames(mine.games);
      setLocalGames(mine.localGames);
      offsetRef.current = mine.serverLoaded;
      serverTotalRef.current = mine.serverTotal;
      setServerLoaded(mine.serverLoaded);
      setServerTotal(mine.serverTotal);
      setLoading(false);
      fetchProfileData(true);
    } else {
      fetchProfileData();
    }
  }, [fetchProfileData, userId]);

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
      gamesRef.current = merged;
      setGames(merged);
      offsetRef.current += serverRes.games.length;
      serverTotalRef.current = serverRes.total;
      setServerLoaded(offsetRef.current);
      setServerTotal(serverRes.total);
      if (profileCache && profileCache.userId === userId) {
        profileCache.serverLoaded = offsetRef.current;
        profileCache.serverTotal = serverRes.total;
        profileCache.games = merged;
      }
    } catch (e) {
      toast.show(loadMessage(e) ?? t('history.loadFailed'));
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [isGuest, loading, t, userId]);

  const resolveRecord = (
    gameItem: GameHistoryItemDto,
    done: (record: SavedGameRecord) => void
  ) => {
    const localMatch = localGames.find((lg) => lg.id === gameItem.gameId);
    if (localMatch) {
      setSelectedMatch(null);
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
          setSelectedMatch(null);
          done(record);
        }
      })
      .catch(() => {
        toast.show(t('history.replayFailed'));
      });
  };

  const filteredGames = useMemo(() => {
    return games.filter((g) => {
      if (filter === 'WINS') return g.outcome === 'WIN';
      if (filter === 'LOSSES') return g.outcome === 'LOSS';
      return true;
    });
  }, [games, filter]);

  // A filter can be empty while older pages still contain matching rows. Keep
  // that state distinct from a brand-new account with no matches at all.
  const filterHasNoLoadedMatches = games.length > 0 && filter !== 'ALL';

  const winCount = useMemo(() => games.filter((g) => g.outcome === 'WIN').length, [games]);
  const lossCount = useMemo(() => games.filter((g) => g.outcome === 'LOSS').length, [games]);

  const rating1v1 = profile?.ratings?.CLASSIC_1V1?.rating ?? 1500;
  const wins = profile?.ratings?.CLASSIC_1V1?.wins ?? 0;
  const losses = profile?.ratings?.CLASSIC_1V1?.losses ?? 0;
  const gamesPlayed = profile?.ratings?.CLASSIC_1V1?.gamesPlayed ?? (wins + losses);
  const winRate =
    gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;
  const joinedLine = formatJoined(profile?.createdAt);

  const initial = (profile?.displayName || profile?.username || 'K').charAt(0).toUpperCase();

  // Badge detail lookup for the tapped badge (earned, locked, or equipped).
  const detailBadge =
    detailCode && achievements
      ? achievements.catalog.find((c) => c.code === detailCode) ?? null
      : null;
  const detailEarnedAt = detailBadge
    ? achievements?.earned.find((e) => e.code === detailBadge.code)?.earnedAt
    : undefined;
  const detailEquipped = detailBadge
    ? achievements?.equipped.some((b) => b.code === detailBadge.code) ?? false
    : false;
  const detailOwners = detailBadge ? achievements?.owners[detailBadge.code] ?? 0 : 0;
  const detailProgress =
    detailBadge && !detailBadge.earned ? detailBadge.progress : undefined;

  /** Tap an earned badge to equip/unequip it in the 3-slot showcase. */
  const toggleBadge = async (code: string) => {
    if (!achievements || equipping) return;
    const equippedCodes = achievements.equipped.map((b) => b.code);
    const next = equippedCodes.includes(code)
      ? equippedCodes.filter((c) => c !== code)
      : [...equippedCodes, code].slice(0, 3);
    while (next.length < 3) next.push(null as unknown as string);
    setEquipping(true);
    try {
      const updated = await api.setEquippedBadges(next);
      setAchievements(updated);
    } catch (e) {
      // Offline or refused: the showcase stays as it was, said out loud.
      toast.show(actionMessage(e));
    } finally {
      setEquipping(false);
    }
  };

  const metalLabel = (tier?: string) => {
    switch (tier?.toLowerCase()) {
      case 'bronze': return t('achievements.bronze');
      case 'silver': return t('achievements.silver');
      case 'gold': return t('achievements.gold');
      case 'platinum': return t('achievements.platinum');
      case 'diamond': return t('achievements.diamond');
      default: return tier ?? '';
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('profile.title')}</Text>
        <TouchableOpacity
          style={styles.settingsIconBtn}
          activeOpacity={0.7}
          onPress={onOpenSettings}
          accessibilityLabel={t('settings.title')}
        >
          <OrbIcon name="settings" size={18} color={THEME.colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {loading && !profile ? (
        <ProfileSkeleton />
      ) : loadError ? (
        <NoConnectionSection
          kind={sectionKind(loadError.kind, isConnected)}
          message={loadError.message}
          onRetry={() => void fetchProfileData()}
        />
      ) : (
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: BOTTOM_NAV_HEIGHT + 30 + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Identity Card with stats */}
          <View style={styles.identityCard}>
            <View style={styles.identityLeft}>
              <View style={styles.avatarWrap}>
                <View style={styles.avatarBox}>
                  <Text style={styles.avatarInitial}>{initial}</Text>
                </View>
                <View style={styles.onlineBadge} />
              </View>

              <View style={styles.identityInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.profileName} numberOfLines={1}>
                    {profile?.displayName || profile?.username || 'Player'}
                  </Text>
                  {showOwnBadge && <PremiumBadge size="sm" />}
                </View>
                {!!profile?.username && (
                  <Text style={styles.handleText} numberOfLines={1}>
                    @{profile.username}
                  </Text>
                )}
                {identity?.isGuest === true && (
                  <View style={styles.guestPill}>
                    <Text style={styles.guestPillText}>{t('profile.unsavedGuest')}</Text>
                  </View>
                )}
                {joinedLine && (
                  <View style={styles.joinDateRow}>
                    <OrbIcon name="calendar" size={12} color={THEME.colors.textMuted} />
                    <Text style={styles.joinDateText}>{joinedLine}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* 3-Stat boxes */}
            <View style={styles.statRibbon}>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{Math.round(rating1v1)}</Text>
                <Text style={styles.statLabel}>{t('profile.rating')}</Text>
              </View>

              <View style={styles.statCard}>
                <Text style={[styles.statNumber, { color: THEME.colors.primary }]}>{winRate}%</Text>
                <Text style={styles.statLabel}>{t('profile.winRate')}</Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{gamesPlayed}</Text>
                <Text style={styles.statLabelSub}>{t('profile.record', { wins, losses })}</Text>
              </View>
            </View>
          </View>

          {/* Guest lock: rating stays visible above, everything saved lives
              behind the link. */}
          {identity?.isGuest === true && (
            <View style={styles.gateWrap}>
              <GuestGate
                title={t('profile.keepEveryMatch')}
                message={t('profile.keepEveryMatchDesc')}
                mini
              />
            </View>
          )}

          {/* Equipment & Style Customization */}
          <View style={styles.cosmeticsSection}>
            <View style={styles.cosmeticsHeaderLeft}>
              <OrbIcon name="palette-swatch" size={16} color={THEME.colors.primary} />
              <Text style={styles.sectionHeading}>Equipment & Style</Text>
            </View>

            <View style={styles.cosmeticsCard}>
              {/* Ball Slot */}
              <TouchableOpacity
                style={styles.cosmeticSlot}
                activeOpacity={0.75}
                onPress={() => setCosmeticsCategory('ball')}
                accessibilityRole="button"
                accessibilityLabel="Choose Ball Skin"
              >
                <View style={styles.cosmeticPreviewCircle}>
                  {activeBall ? (
                    <Image source={activeBall.assets.orb} style={styles.slotOrbImg} resizeMode="contain" />
                  ) : (
                    <View style={styles.slotClassicOrb} />
                  )}
                </View>
                <View style={styles.cosmeticSlotInfo}>
                  <Text style={styles.slotCategory}>BALL SKIN</Text>
                  <Text style={styles.slotName} numberOfLines={1}>
                    {activeBall ? activeBall.name : 'Classic Duo'}
                  </Text>
                </View>
                <OrbIcon name="chevron-right" size={16} color={THEME.colors.textMuted} />
              </TouchableOpacity>

              <View style={styles.cosmeticSlotDivider} />

              {/* Wall Slot */}
              <TouchableOpacity
                style={styles.cosmeticSlot}
                activeOpacity={0.75}
                onPress={() => setCosmeticsCategory('wall')}
                accessibilityRole="button"
                accessibilityLabel="Choose Wall Skin"
              >
                <View style={styles.cosmeticPreviewRect}>
                  {activeWall ? (
                    <Image source={activeWall.assets.wallTray} style={styles.slotWallImg} resizeMode="contain" />
                  ) : (
                    <View style={styles.slotClassicWallWrap}>
                      <View style={styles.slotClassicWallBarBlue} />
                      <View style={styles.slotClassicWallBarRed} />
                    </View>
                  )}
                </View>
                <View style={styles.cosmeticSlotInfo}>
                  <Text style={styles.slotCategory}>WALL SKIN</Text>
                  <Text style={styles.slotName} numberOfLines={1}>
                    {activeWall ? activeWall.name : 'Classic Duo'}
                  </Text>
                </View>
                <OrbIcon name="chevron-right" size={16} color={THEME.colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Achievements — online only. Offline, `achievements`
              stays null and the section simply does not render: no error.
              Always shown once loaded, even at 0 earned: a fresh account
              must still see the streaks and milestones it can start. */}
          {achievements && (
            <View style={styles.recentSection}>
              <View style={styles.recentHeaderRow}>
                <Text style={styles.sectionHeading}>{t('profile.achievements')}</Text>
                <Text style={styles.sectionSub}>
                  {t('profile.earnedCount', {
                    earned: achievements.catalog.filter((c) => c.earned).length,
                    total: achievements.catalog.length,
                  })}
                </Text>
              </View>

              {/* Showcase: the 3 equipped medallions. */}
              <View style={styles.showcaseRow}>
                {[0, 1, 2].map((slot) => {
                  const badge = achievements.equipped.find((b) => b.slot === slot);
                  return (
                    <TouchableOpacity
                      key={slot}
                      style={styles.showcaseCell}
                      activeOpacity={0.7}
                      disabled={!badge || equipping}
                      onPress={() => badge && setDetailCode(badge.code)}
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

              <TouchableOpacity
                style={styles.viewAllBtn}
                activeOpacity={0.8}
                onPress={() => setShowAchievements(true)}
                accessibilityLabel={t('profile.viewAllAchievements')}
                accessibilityRole="button"
              >
                <OrbIcon name="grid" size={15} color={THEME.colors.textPrimary} />
                <Text style={styles.viewAllText}>{t('profile.viewAllAchievements')}</Text>
                <OrbIcon name="chevron-right" size={16} color={THEME.colors.textPrimary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Rating Progression Section */}
          <View style={styles.chartSection}>
            <RatingChart data={ratingHistory} currentRating={rating1v1} />
          </View>

          {/* Embedded Match History Section */}
          <View style={styles.historySection}>
            <View style={styles.historyHeaderRow}>
              <View>
                <Text style={styles.sectionHeading}>{t('history.title')}</Text>
                <Text style={styles.historySub}>
                  {t('profile.latestGames', { count: games.length })}
                </Text>
              </View>
              {onOpenHistory && (
                <TouchableOpacity
                  style={styles.fullHistoryBtn}
                  onPress={onOpenHistory}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                >
                  <Text style={styles.fullHistoryText}>Full History</Text>
                  <OrbIcon name="chevron-right" size={14} color={THEME.colors.primary} />
                </TouchableOpacity>
              )}
            </View>

            {isGuest && (
              <GuestGate
                title={t('profile.keepEveryMatch')}
                message={t('profile.keepEveryMatchDesc')}
                mini
              />
            )}

            {/* Filter Pills with counts */}
            <View style={styles.filterPillsRow}>
              {(['ALL', 'WINS', 'LOSSES'] as OutcomeFilter[]).map((f) => {
                const count = f === 'ALL' ? games.length : f === 'WINS' ? winCount : lossCount;
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

            {/* Match rows list */}
            {filteredGames.length > 0 ? (
              <View style={styles.matchesList}>
                {filteredGames.slice(0, recentVisible).map((item, index) => {
                  const isWin = item.outcome === 'WIN';
                  const isNeutral = item.outcome === 'DRAW';
                  const delta = item.myRating?.delta ?? 0;
                  const opponentName = item.opponent?.displayName || item.opponent?.username || t('history.opponent');
                  const opponentRating = item.opponent?.ratingBefore ?? item.opponent?.ratingAfter;
                  const pts = item.isRanked
                    ? ` · ${delta >= 0 ? `+${Math.round(delta)}` : `${Math.round(delta)}`} pts`
                    : '';
                  const isFirst = index === 0;
                  const isLast = index === Math.min(filteredGames.length, recentVisible) - 1;

                  return (
                    <TouchableOpacity
                      key={item.gameId}
                      style={[
                        styles.matchRow,
                        isFirst && styles.matchRowFirst,
                        isLast && styles.matchRowLast,
                        !isLast && styles.matchRowDivider,
                      ]}
                      activeOpacity={0.75}
                      onPress={() => setSelectedMatch(item)}
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
                })}
              </View>
            ) : (
              <View style={styles.emptyMatchesCard}>
                <OrbIcon
                  name={filterHasNoLoadedMatches ? 'filter' : 'clock'}
                  size={28}
                  color={THEME.colors.textMuted}
                />
                <Text style={styles.emptyMatchesTitle}>
                  {filterHasNoLoadedMatches
                    ? t('history.filteredEmpty')
                    : t('history.noMatchesRecorded')}
                </Text>
                <Text style={styles.emptyMatchesSub}>
                  {filterHasNoLoadedMatches
                    ? t('history.filteredEmptySub')
                    : t('history.noMatchesSub')}
                </Text>
              </View>
            )}

            {/* Pagination / Load more */}
            {filteredGames.length > recentVisible ? (
              <TouchableOpacity
                style={styles.loadMoreMatchesBtn}
                activeOpacity={0.8}
                onPress={() => setRecentVisible((v) => v + 5)}
              >
                <Text style={styles.loadMoreMatchesText}>
                  {t('profile.loadMore')} ({recentVisible}/{filteredGames.length})
                </Text>
              </TouchableOpacity>
            ) : !isGuest && serverLoaded < serverTotal ? (
              <TouchableOpacity
                style={[styles.loadMoreMatchesBtn, loadingMore && styles.loadMoreMatchesBtnBusy]}
                activeOpacity={0.8}
                disabled={loadingMore}
                onPress={() => void loadMore()}
              >
                <Text style={styles.loadMoreMatchesText}>
                  {loadingMore
                    ? t('history.loading')
                    : `${t('history.loadMore')} (${serverLoaded}/${serverTotal})`}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Ad slot: bottom of the page, below all actions. */}
          <AdBanner placement="list" />

          {/* Recent matches live on the History tab — one home for match history,
            not two. The opponent/friend profile keeps its own RECENT
            MATCHES section, which is a different thing: their record. */}
        </ScrollView>
      )}

      {/* Full achievement inventory: every badge, grouped and scrollable. */}
      {achievements && (
        <AchievementsModal
          visible={showAchievements}
          achievements={achievements}
          equipping={equipping}
          onToggleEquip={(code) => void toggleBadge(code)}
          onClose={() => setShowAchievements(false)}
        />
      )}

      {/* Badge details: what it is, how to earn it, rarity, equip toggle. */}
      <Modal
        visible={detailBadge !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailCode(null)}
      >
        <View style={styles.detailOverlay}>
          <View style={styles.detailCard}>
            <AchievementMedal
              icon={detailBadge?.icon ?? 'award'}
              tier={detailBadge?.tier}
              size={88}
              locked={!detailBadge?.earned}
            />
            {!!detailBadge && (
              <View
                style={[
                  styles.detailTierPill,
                  { backgroundColor: detailBadge.earned ? METALS[tierOf(detailBadge.tier)].disc : THEME.colors.surfaceMuted },
                ]}
              >
                <Text
                  style={[
                    styles.detailTierText,
                    {
                      color: detailBadge.earned
                        ? METALS[tierOf(detailBadge.tier)].face
                        : THEME.colors.textMuted,
                    },
                  ]}
                >
                  {detailBadge.earned ? metalLabel(detailBadge.tier) : 'LOCKED'} ·{' '}
                  {CATEGORY_META[categoryOf(detailBadge.category)].title}
                </Text>
              </View>
            )}
            <Text style={styles.detailName}>{detailBadge?.name}</Text>
            <Text style={styles.detailDesc}>{detailBadge?.description}</Text>
            {!!detailBadge?.requirement && (
              <Text style={styles.detailReq}>{detailBadge.requirement}</Text>
            )}
            {detailBadge && !detailBadge.earned && detailProgress && (
              <View style={styles.detailProgressWrap}>
                <BadgeProgressBar progress={detailProgress} tier={detailBadge.tier} />
              </View>
            )}
            <Text style={styles.detailMeta}>
              {detailEarnedAt
                ? t('achievements.earnedBadge', {
                    date: new Date(detailEarnedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    }),
                  })
                : 'Locked'}
              {` · ${detailOwners === 1 ? t('achievements.ownedBySingle') : t('achievements.ownedBy', { count: detailOwners })}`}
            </Text>
            {detailBadge?.earned && (
              <TouchableOpacity
                style={[styles.detailEquipBtn, detailEquipped && styles.detailEquipBtnActive]}
                activeOpacity={0.8}
                disabled={equipping}
                onPress={() => {
                  if (detailBadge) void toggleBadge(detailBadge.code);
                }}
              >
                <Text
                  style={[styles.detailEquipText, detailEquipped && styles.detailEquipTextActive]}
                >
                  {detailEquipped ? `${t('achievements.equipped')} ✓` : t('achievements.equip')}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.detailCloseBtn}
              activeOpacity={0.7}
              onPress={() => setDetailCode(null)}
              accessibilityLabel={t('report.done')}
            >
              <Text style={styles.detailCloseText}>{t('report.done')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Match detail modal */}
      <MatchResultModal
        match={selectedMatch}
        onClose={() => setSelectedMatch(null)}
        onReplay={(item) => resolveRecord(item, (rec) => onSelectGame?.(rec))}
        onAnalyze={(item) => resolveRecord(item, (rec) => onAnalyzeGame?.(rec))}
        onViewOpponentProfile={onOpenPlayerProfile}
      />

      {/* Equipment & Style Customizer Sheet */}
      <CosmeticsCustomizerModal
        visible={cosmeticsCategory !== null}
        category={cosmeticsCategory}
        onClose={() => setCosmeticsCategory(null)}
        onOpenPremium={() => {
          setCosmeticsCategory(null);
          setPremiumOpen(true);
        }}
        onEquipBall={handleEquipBall}
        onEquipWall={handleEquipWall}
      />

      {/* Premium Upgrade Sheet */}
      <PremiumSheet
        visible={premiumOpen}
        entry="profile_cosmetics"
        onClose={() => setPremiumOpen(false)}
        onDone={() => {
          setPremiumOpen(false);
          void refreshPremium();
        }}
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
    backgroundColor: THEME.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.surfaceMuted,
  },
  title: {
    fontFamily: THEME.fonts.bold,
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.inverseLabel,
    letterSpacing: -0.2,
  },
  settingsIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: THEME.colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 88, // Clears the floating nav overlay.
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
  identityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatarWrap: {
    position: 'relative',
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
  onlineBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: THEME.colors.tertiary,
    borderWidth: 2,
    borderColor: THEME.colors.onPrimary,
  },
  identityInfo: {
    gap: 3,
    flex: 1,
  },
  profileName: {
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
  // Warns that this account lives on this device only until linked.
  guestPill: {
    alignSelf: 'flex-start',
    marginTop: 6,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceHairline,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  guestPillText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 10,
    letterSpacing: 0.8,
    color: THEME.colors.textSecondary,
  },
  joinDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  joinDateText: {
    fontFamily: THEME.fonts.regular,
    fontSize: 14,
    color: THEME.colors.textOnMuted,
  },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statRibbon: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: THEME.colors.surfaceMuted,
    borderRadius: 4,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statNumber: {
    fontFamily: THEME.fonts.bold,
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.inverseLabel,
    letterSpacing: -0.2,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontFamily: THEME.fonts.medium,
    fontSize: 11,
    fontWeight: '500',
    color: THEME.colors.textSecondaryStrong,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  statLabelSub: {
    fontFamily: THEME.fonts.regular,
    fontSize: 11,
    fontWeight: '400',
    color: THEME.colors.textOnMuted,
    marginTop: 2,
  },
  chartSection: {
    width: '100%',
  },
  chartHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginBottom: 8,
  },
  sectionSub: {
    fontFamily: THEME.fonts.regular,
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  peakText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  recentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  recentSection: {
    gap: 8,
  },
  // Equipment & Style customization section styles
  cosmeticsSection: {
    gap: 8,
    marginTop: 6,
  },
  cosmeticsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  customizeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceHairline,
  },
  customizeBtnText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.primary,
  },
  cosmeticsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.backgroundCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceMuted,
    paddingVertical: 12,
    paddingHorizontal: 16,
    ...THEME.shadows.card,
  },
  cosmeticSlot: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cosmeticPreviewCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.surfaceContainerLowest,
  },
  slotOrbImg: {
    width: 36,
    height: 36,
  },
  slotClassicOrb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#2563EB',
    borderWidth: 1.5,
    borderColor: '#60A5FA',
    borderBottomWidth: 2.5,
    borderBottomColor: '#1D4ED8',
  },
  cosmeticPreviewRect: {
    width: 44,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.surfaceContainerLowest,
  },
  slotWallImg: {
    width: 46,
    height: 16,
  },
  slotClassicWallWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  slotClassicWallBarBlue: {
    width: 17,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563EB',
  },
  slotClassicWallBarRed: {
    width: 17,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DC2626',
  },
  cosmeticSlotInfo: {
    flex: 1,
    gap: 2,
  },
  slotCategory: {
    fontFamily: THEME.fonts.bold,
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    letterSpacing: 0.8,
  },
  slotName: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  cosmeticSlotDivider: {
    width: 1,
    height: 32,
    backgroundColor: THEME.colors.surfaceHairline,
    marginHorizontal: 10,
  },
  // Spacing for the guest link lock between the stats and the sections below.
  gateWrap: {
    marginTop: 12,
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
  detailOverlay: {
    flex: 1,
    backgroundColor: THEME.colors.modalBackdrop,
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
  detailTierPill: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 12,
  },
  detailTierText: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  detailProgressWrap: {
    width: '100%',
    marginTop: 12,
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
  detailMeta: {
    fontFamily: THEME.fonts.regular,
    fontSize: 12,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
    fontVariant: ['tabular-nums'],
  },
  detailEquipBtn: {
    marginTop: 16,
    width: '100%',
    height: 44,
    borderRadius: THEME.radius.lg,
    backgroundColor: THEME.colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailEquipBtnActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  detailEquipText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.onSurface,
  },
  detailEquipTextActive: {
    color: THEME.colors.onPrimary,
  },
  detailCloseBtn: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  detailCloseText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  sectionHeading: {
    fontFamily: THEME.fonts.bold,
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    letterSpacing: 0.8,
    paddingHorizontal: 2,
  },
  historySection: {
    marginTop: 18,
    gap: 12,
  },
  historyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  historySub: {
    fontFamily: THEME.fonts.regular,
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  fullHistoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  fullHistoryText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 13,
    color: THEME.colors.primary,
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
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
    borderRadius: 12,
    overflow: 'hidden',
    ...THEME.shadows.card,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: THEME.colors.backgroundCard,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: THEME.colors.surfaceMuted,
  },
  matchRowFirst: {
    borderTopWidth: 1,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  matchRowLast: {
    borderBottomWidth: 1,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  matchRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.surfaceMuted,
  },
  miniOutcomeBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeWin: {
    backgroundColor: THEME.colors.win,
  },
  badgeLoss: {
    backgroundColor: THEME.colors.loss,
  },
  badgeNeutral: {
    backgroundColor: THEME.colors.draw,
  },
  miniOutcomeText: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  textWin: {
    color: '#FFFFFF',
  },
  textLoss: {
    color: '#FFFFFF',
  },
  textNeutral: {
    color: '#FFFFFF',
  },
  matchRowMeta: {
    gap: 2,
    flex: 1,
  },
  matchRowOpponent: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  matchRowOppRating: {
    fontFamily: THEME.fonts.regular,
    fontSize: 13,
    fontWeight: '400',
    color: THEME.colors.textSecondary,
  },
  matchRowMode: {
    fontFamily: THEME.fonts.regular,
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  emptyMatchesCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
    backgroundColor: THEME.colors.backgroundCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceMuted,
    gap: 6,
  },
  emptyMatchesTitle: {
    fontFamily: THEME.fonts.bold,
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginTop: 6,
  },
  emptyMatchesSub: {
    fontFamily: THEME.fonts.regular,
    fontSize: 12,
    color: THEME.colors.textMuted,
    textAlign: 'center',
  },
  loadMoreMatchesBtn: {
    paddingVertical: 11,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceContainer,
    alignItems: 'center',
    ...THEME.shadows.card,
  },
  loadMoreMatchesBtnBusy: {
    opacity: 0.6,
  },
  loadMoreMatchesText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
});
