import React, { useEffect, useState, useCallback } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { THEME } from '../theme';
import { api, LeaderboardEntryDto } from '../network/apiClient';
import { PlayerAvatarOrb } from '../components/PlayerIdentity';
import { LoadingState, EmptyState, ErrorState } from '../components/StateViews';

interface LeaderboardScreenProps {
  onBack: () => void;
  onSelectPlayer: (player: { userId: string; username: string }) => void;
}

export const LeaderboardScreen: React.FC<LeaderboardScreenProps> = ({
  onBack,
  onSelectPlayer,
}) => {
  const [entries, setEntries] = useState<LeaderboardEntryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getLeaderboard('CLASSIC_1V1', 50);
      setEntries(data);
    } catch {
      setError('Unable to load leaderboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const renderItem = ({ item }: { item: LeaderboardEntryDto }) => {
    const isTop3 = item.rank <= 3;
    const rankColor =
      item.rank === 1
        ? '#D97706' // Gold
        : item.rank === 2
        ? '#64748B' // Silver
        : item.rank === 3
        ? '#B45309' // Bronze
        : THEME.colors.textMuted;

    return (
      <TouchableOpacity
        style={styles.playerRow}
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

        <View style={styles.ratingWrap}>
          <Text style={styles.ratingValue}>{item.rating}</Text>
          <Feather name="chevron-right" size={16} color={THEME.colors.textMuted} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.screenTitle}>LEADERBOARD</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <LoadingState message="Loading leaderboard…" />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchLeaderboard} />
      ) : entries.length === 0 ? (
        <EmptyState
          title="NO RANKINGS YET"
          description="Play ranked matches to qualify for the global leaderboard."
        />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.userId}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
    paddingTop: 36,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  backButton: {
    paddingVertical: 4,
    minWidth: 40,
  },
  backButtonText: {
    fontFamily: THEME.fonts.regular,
    color: THEME.colors.textSecondary,
    fontSize: 28,
    fontWeight: '300',
  },
  screenTitle: {
    fontFamily: THEME.fonts.extraBold,
    color: THEME.colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
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
});
