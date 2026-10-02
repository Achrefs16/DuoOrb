import React, { useEffect, useState, useCallback } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { THEME } from '../theme';
import { useSession } from '../network/session';
import { useConnectivity } from '../network/useConnectivity';
import {
  api,
  AchievementsResponseDto,
  UserMeDto,
  RatingHistoryPointDto,
} from '../network/apiClient';
import { flushAiWinQueue } from '../aiwins/aiWins';
import { RatingChart } from '../components/RatingChart';
import {
  AchievementMedal,
  BadgeProgressBar,
  CATEGORY_META,
  METALS,
  categoryOf,
  tierOf,
} from '../components/AchievementMedal';
import { AchievementsModal } from '../components/AchievementsModal';
import { GuestGate } from '../components/GuestGate';
import { toast } from '../components/AppToast';
import { NoConnectionSection } from '../components/NoConnection';
import { actionMessage, kindOf, loadMessage, sectionKind, type ErrorKind } from '../network/errors';
import { ProfileSkeleton } from '../components/Skeleton';

interface ProfileScreenProps {
  onOpenSettings: () => void;
  /** Opens the shared player profile for a recent match's opponent. */
  onOpenPlayerProfile?: (player: { userId: string; username: string }) => void;
}

/**
 * Last loaded bundle, keyed by account. Tab switches remount this screen,
 * so the previous profile renders on the first frame and refreshes
 * silently. Never mix accounts: guest and Google rows stay separate.
 * Skeleton only when there is nothing to show yet.
 *
 * Match history is NOT cached here: it lives on the History tab, which
 * owns its own paging cache.
 */
let profileCache: {
  userId: string;
  profile: UserMeDto;
  ratingHistory: RatingHistoryPointDto[];
  achievements: AchievementsResponseDto | null;
} | null = null;

function formatJoinedAt(value?: string | number): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `Joined ${d.toLocaleString('en-US', { month: 'long', year: 'numeric' })}`;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  onOpenSettings,
  onOpenPlayerProfile,
}) => {
  const { identity } = useSession();
  const { isConnected } = useConnectivity();
  const [profile, setProfile] = useState<UserMeDto | null>(null);
  const [ratingHistory, setRatingHistory] = useState<RatingHistoryPointDto[]>([]);
  const [achievements, setAchievements] = useState<AchievementsResponseDto | null>(null);
  const [equipping, setEquipping] = useState(false);
  const [detailCode, setDetailCode] = useState<string | null>(null);
  const [showAchievements, setShowAchievements] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ message?: string; kind: ErrorKind } | null>(null);

  const fetchProfileData = useCallback(async (silent = false) => {
    // Silent = background refresh with data on screen: never flash a
    // skeleton, never replace the profile with an error.
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
      if (me) {
        setProfile(me);
        // Drain the offline hard-AI-win outbox first, so freshly synced
        // badges and wins appear below. Silent by design — offline, the
        // flush is a no-op and these sections simply stay hidden.
        await flushAiWinQueue().catch(() => []);
        const [rSettled, aSettled] = await Promise.allSettled([
          api.getRatingHistory(me.id, 'CLASSIC_1V1', 20),
          api.getMyAchievements(),
        ]);
        // Failed slices keep their previous rows: stale-but-true beats
        // fabricated. First-load failures stay empty, honestly so.
        if (rSettled.status === 'fulfilled') setRatingHistory(rSettled.value);
        if (aSettled.status === 'fulfilled') setAchievements(aSettled.value);
        // Cache the bundle for instant remounts. Failed slices reuse the
        // previous cache (same account only), never blank state.
        const prev = profileCache?.userId === me.id ? profileCache : null;
        profileCache = {
          userId: me.id,
          profile: me,
          ratingHistory: rSettled.status === 'fulfilled' ? rSettled.value : prev?.ratingHistory ?? [],
          achievements: aSettled.status === 'fulfilled' ? aSettled.value : prev?.achievements ?? null,
        };
      } else {
        // No profile: full section, never a fabricated stand-in (first
        // load only - a silent refresh keeps what is on screen).
        if (!silent) setLoadError({ message: loadMessage(meError), kind: kindOf(meError) });
      }
    } catch {
      if (!silent) setLoadError({ message: undefined, kind: 'UNKNOWN' });
    } finally {
      setLoading(false);
    }
  // Runs on mount (tab switches remount this screen). Auth comes from the
  // canonical store inside api.getMe, so no identity dep is needed.
  }, []);

  useEffect(() => {
    // Instant restore, silent refresh: header, identity card chrome and the
    // last bundle render on the first frame. Account mismatch (guest <->
    // Google) always takes the full path, never another account's rows.
    const mine = profileCache && identity?.userId && profileCache.userId === identity.userId ? profileCache : null;
    if (mine) {
      setProfile(mine.profile);
      setRatingHistory(mine.ratingHistory);
      setAchievements(mine.achievements);
      setLoading(false);
      fetchProfileData(true);
    } else {
      fetchProfileData();
    }
  }, [fetchProfileData, identity?.userId]);

  const rating1v1 = profile?.ratings?.CLASSIC_1V1?.rating ?? 1500;
  const wins = profile?.ratings?.CLASSIC_1V1?.wins ?? 0;
  const losses = profile?.ratings?.CLASSIC_1V1?.losses ?? 0;
  const gamesPlayed = profile?.ratings?.CLASSIC_1V1?.gamesPlayed ?? (wins + losses);
  const winRate =
    gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;
  const joinedLine = formatJoinedAt(profile?.createdAt);

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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
        <TouchableOpacity
          style={styles.settingsIconBtn}
          activeOpacity={0.7}
          onPress={onOpenSettings}
          accessibilityLabel="Settings"
        >
          <Feather name="settings" size={18} color={THEME.colors.textSecondary} />
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
          contentContainerStyle={styles.content}
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
                <Text style={styles.profileName} numberOfLines={1}>
                  {profile?.displayName || profile?.username || 'Player'}
                </Text>
                {!!profile?.username && (
                  <Text style={styles.handleText} numberOfLines={1}>
                    @{profile.username}
                  </Text>
                )}
                {identity?.isGuest === true && (
                  <View style={styles.guestPill}>
                    <Text style={styles.guestPillText}>UNSAVED GUEST</Text>
                  </View>
                )}
                {joinedLine && (
                  <View style={styles.joinDateRow}>
                    <Feather name="calendar" size={12} color={THEME.colors.textMuted} />
                    <Text style={styles.joinDateText}>{joinedLine}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* 3-Stat boxes */}
            <View style={styles.statRibbon}>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{Math.round(rating1v1)}</Text>
                <Text style={styles.statLabel}>RATING</Text>
              </View>

              <View style={styles.statCard}>
                <Text style={[styles.statNumber, { color: THEME.colors.primary }]}>{winRate}%</Text>
                <Text style={styles.statLabel}>WIN RATE</Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{gamesPlayed}</Text>
                <Text style={styles.statLabelSub}>{wins}W · {losses}L</Text>
              </View>
            </View>
          </View>

          {/* Guest lock: rating stays visible above, everything saved lives
              behind the link. */}
          {identity?.isGuest === true && (
            <View style={styles.gateWrap}>
              <GuestGate
                title="Keep every match"
                message="Link Google to save rating, friends, history & head-to-head."
                mini
              />
            </View>
          )}

          {/* Achievements — online only. Offline, `achievements`
              stays null and the section simply does not render: no error.
              Always shown once loaded, even at 0 earned: a fresh account
              must still see the streaks and milestones it can start. */}
          {achievements && (
            <View style={styles.recentSection}>
              <View style={styles.recentHeaderRow}>
                <Text style={styles.sectionHeading}>ACHIEVEMENTS</Text>
                <Text style={styles.sectionSub}>
                  {achievements.catalog.filter((c) => c.earned).length}/{achievements.catalog.length} earned
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
                          <Text style={styles.showcaseEmptyText}>Slot {slot + 1}</Text>
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
                accessibilityLabel="View all achievements"
                accessibilityRole="button"
              >
                <Feather name="grid" size={15} color={THEME.colors.textPrimary} />
                <Text style={styles.viewAllText}>View All Achievements</Text>
                <Feather name="chevron-right" size={16} color={THEME.colors.textPrimary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Rating Progression Section */}
          <View style={styles.chartSection}>
            <RatingChart data={ratingHistory} currentRating={rating1v1} />
          </View>

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
                  {detailBadge.earned ? METALS[tierOf(detailBadge.tier)].label : 'LOCKED'} ·{' '}
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
                ? `Earned ${new Date(detailEarnedAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}`
                : 'Locked — earn it first'}
              {` · owned by ${detailOwners} player${detailOwners === 1 ? '' : 's'}`}
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
                  {detailEquipped ? 'Equipped ✓' : 'Equip badge'}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.detailCloseBtn}
              activeOpacity={0.7}
              onPress={() => setDetailCode(null)}
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
});
