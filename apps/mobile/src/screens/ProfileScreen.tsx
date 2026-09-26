import React, { useEffect, useState, useCallback } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { createInitialState } from '@duoorb/game-core';
import { THEME } from '../theme';
import { useSession } from '../network/session';
import {
  api,
  UserMeDto,
  RatingHistoryPointDto,
  GameHistoryItemDto,
} from '../network/apiClient';
import { RatingChart } from '../components/RatingChart';
import { LoadingState, EmptyState, ErrorState } from '../components/StateViews';
import { SavedGameRecord, loadGameHistory } from '../storage/gameStorage';

interface ProfileScreenProps {
  onOpenSettings: () => void;
  onSelectGame: (game: SavedGameRecord) => void;
}

type RecentFilter = 'ALL' | 'WINS' | 'LOSSES';

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

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  onOpenSettings,
  onSelectGame,
}) => {
  const { identity } = useSession();
  const [profile, setProfile] = useState<UserMeDto | null>(null);
  const [ratingHistory, setRatingHistory] = useState<RatingHistoryPointDto[]>([]);
  const [recentGames, setRecentGames] = useState<GameHistoryItemDto[]>([]);
  const [recentFilter, setRecentFilter] = useState<RecentFilter>('ALL');
  const [recentVisible, setRecentVisible] = useState(5);
  const [localHistory, setLocalHistory] = useState<SavedGameRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfileData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const localGames = await loadGameHistory();
      setLocalHistory(localGames);

      const me = await api.getMe().catch(() => null);
      if (me) {
        setProfile(me);
        const [rHistory, gamesRes] = await Promise.all([
          api.getRatingHistory(me.id, 'CLASSIC_1V1', 20).catch(() => []),
          api.getMyHistory(20, 0).catch(() => ({ games: [], total: 0 })),
        ]);
        setRatingHistory(rHistory);
        setRecentGames(
          [...gamesRes.games].sort((a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime())
        );
      } else {
        const winsCount = localGames.filter((g) => g.winnerName === 'You').length;
        const lossesCount = localGames.filter((g) => g.winnerName !== 'You').length;
        const total = localGames.length;

        setProfile({
          id: identity.userId,
          username: identity.username ?? identity.displayName,
          displayName: identity.displayName,
          ratings: {
            CLASSIC_1V1: {
              rating: 1500,
              rd: 350,
              gamesPlayed: total,
              wins: winsCount,
              losses: lossesCount,
              winRate: total > 0 ? Math.round((winsCount / total) * 100) : 0,
            },
          },
        });
      }
    } catch {
      setError('Unable to load profile data.');
    } finally {
      setLoading(false);
    }
  }, [identity.userId, identity.username, identity.displayName]);

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

  const rating1v1 = profile?.ratings?.CLASSIC_1V1?.rating ?? 1500;
  const wins = profile?.ratings?.CLASSIC_1V1?.wins ?? 0;
  const losses = profile?.ratings?.CLASSIC_1V1?.losses ?? 0;
  const gamesPlayed = profile?.ratings?.CLASSIC_1V1?.gamesPlayed ?? (wins + losses);
  const winRate =
    gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;
  const joinedLine = formatJoinedAt(profile?.createdAt);
  const filteredRecent = recentGames.filter((g) => {
    if (recentFilter === 'WINS') return g.outcome === 'WIN';
    if (recentFilter === 'LOSSES') return g.outcome === 'LOSS';
    return true;
  });

  const handleGameTap = (serverGame: GameHistoryItemDto) => {
    const matchingLocal = localHistory.find((lg) => lg.id === serverGame.gameId);
    if (matchingLocal) {
      onSelectGame(matchingLocal);
      return;
    }

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

  const initial = (profile?.displayName || profile?.username || 'K').charAt(0).toUpperCase();

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

      {loading ? (
        <LoadingState message="Loading profile…" />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchProfileData} />
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

          {/* Rating Progression Section */}
          <View style={styles.chartSection}>
            <RatingChart data={ratingHistory} currentRating={rating1v1} />
          </View>

          {/* Recent Matches Section */}
          <View style={styles.recentSection}>
            <View style={styles.recentHeaderRow}>
              <Text style={styles.sectionHeading}>RECENT MATCHES</Text>
              <Text style={styles.sectionSub}>{recentGames.length} matches played</Text>
            </View>

            <View style={styles.recentPillsRow}>
              {(['ALL', 'WINS', 'LOSSES'] as RecentFilter[]).map((f) => {
                const count =
                  f === 'ALL'
                    ? recentGames.length
                    : recentGames.filter((g) => g.outcome === (f === 'WINS' ? 'WIN' : 'LOSS')).length;
                return (
                  <TouchableOpacity
                    key={f}
                    style={[styles.recentPill, recentFilter === f && styles.recentPillActive]}
                    onPress={() => {
                      setRecentFilter(f);
                      setRecentVisible(5);
                    }}
                  >
                    <Text style={[styles.recentPillText, recentFilter === f && styles.recentPillTextActive]}>
                      {f === 'ALL' ? 'All' : f === 'WINS' ? 'Wins' : 'Losses'} ({count})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {filteredRecent.length > 0 ? (
              <View style={styles.recentList}>
                {filteredRecent.slice(0, recentVisible).map((match) => {
                  const isWin = match.outcome === 'WIN';
                  const opp = match.opponent?.displayName || match.opponent?.username || 'Opponent';
                  const oppRating = match.opponent?.ratingBefore ?? match.opponent?.ratingAfter;
                  const delta = match.myRating?.delta ?? 0;
                  const pts = match.isRanked
                    ? ` · ${delta >= 0 ? `+${Math.round(delta)}` : `${Math.round(delta)}`} pts`
                    : '';

                  return (
                    <TouchableOpacity
                      key={match.gameId}
                      style={styles.matchItem}
                      activeOpacity={0.75}
                      onPress={() => handleGameTap(match)}
                    >
                      <View style={styles.matchItemLeft}>
                        <View style={[styles.miniOutcomeBadge, isWin ? styles.badgeWin : styles.badgeLoss]}>
                          <Text style={[styles.miniOutcomeText, isWin ? styles.textWin : styles.textLoss]}>
                            {isWin ? 'W' : 'L'}
                          </Text>
                        </View>
                        <View style={styles.matchItemMeta}>
                          <Text style={styles.matchItemOpponent}>
                            vs {opp}
                            {oppRating !== undefined && oppRating !== null ? (
                              <Text style={styles.matchItemOppRating}> ({Math.round(oppRating)})</Text>
                            ) : null}
                          </Text>
                          <Text style={styles.matchItemMode}>{clockDisplayName(match)}{pts}</Text>
                        </View>
                      </View>

                      <Feather name="chevron-right" size={20} color="#64748B" />
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyRecentBox}>
                <Text style={styles.emptyRecentText}>No recent matches to display.</Text>
              </View>
            )}
            {filteredRecent.length > recentVisible && (
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
  title: {
    fontFamily: THEME.fonts.bold,
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  settingsIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
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
  onlineBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: THEME.colors.tertiary,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  identityInfo: {
    gap: 3,
    flex: 1,
  },
  profileName: {
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
  joinDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  joinDateText: {
    fontFamily: THEME.fonts.regular,
    fontSize: 14,
    color: '#475569',
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
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statNumber: {
    fontFamily: THEME.fonts.bold,
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontFamily: THEME.fonts.medium,
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  statLabelSub: {
    fontFamily: THEME.fonts.regular,
    fontSize: 11,
    fontWeight: '400',
    color: '#475569',
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
  recentPillsRow: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    alignSelf: 'flex-start',
  },
  recentPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
  },
  recentPillActive: {
    backgroundColor: '#131B2E',
  },
  recentPillText: {
    fontFamily: THEME.fonts.medium,
    fontSize: 12,
    fontWeight: '500',
    color: '#475569',
  },
  recentPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  unratedText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 10,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  recentSection: {
    gap: 8,
  },
  sectionHeading: {
    fontFamily: THEME.fonts.bold,
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    letterSpacing: 0.8,
    paddingHorizontal: 2,
  },
  recentList: {
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
  matchItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
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
  matchItemMeta: {
    gap: 1,
    flex: 1,
  },
  matchItemOpponent: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  matchItemOppRating: {
    fontFamily: THEME.fonts.regular,
    fontSize: 14,
    fontWeight: '400',
    color: '#64748B',
  },
  matchItemMode: {
    fontFamily: THEME.fonts.regular,
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  matchItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  matchDelta: {
    fontFamily: THEME.fonts.bold,
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  emptyRecentBox: {
    backgroundColor: THEME.colors.surfaceContainerLowest,
    borderRadius: THEME.radius.lg,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.surfaceContainer,
  },
  emptyRecentText: {
    fontFamily: THEME.fonts.regular,
    fontSize: 12,
    color: THEME.colors.textMuted,
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
