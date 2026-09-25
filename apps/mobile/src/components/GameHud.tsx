import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { GameState, PlayerState } from '@duoorb/game-core';
import { THEME, hexToRgba, playerColor } from '../theme';

function formatTimer(seconds?: number): string {
  if (seconds === undefined || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

interface InGamePlayerChipProps {
  player: PlayerState;
  isActive: boolean;
  timeLeft?: number;
  rating?: number;
  bonus?: number | null;
  /** Bottom (own) card hides the wall pill — the count lives in the tray. */
  hideWallsBadge?: boolean;
}

/** Avatar tint per ball color, matching the Stitch active-match design. */
function avatarTint(ball: string): { bg: string; border: string; text: string } {
  const b = ball.toUpperCase();
  if (b === '#2563EB') return { bg: '#DBEAFE', border: '#BFDBFE', text: '#2563EB' };
  if (b === '#E5484D' || b === '#EF4444') return { bg: '#FEE2E2', border: '#FECACA', text: '#BA1A1A' };
  if (b === '#0E9F6E') return { bg: '#DCFCE7', border: '#BBF7D0', text: '#15803D' };
  if (b === '#D9930D') return { bg: '#FEF3C7', border: '#FDE68A', text: '#B45309' };
  return { bg: hexToRgba(ball, 0.12), border: hexToRgba(ball, 0.3), text: ball };
}

/**
 * Stitch active-match player card (duoorb_active_match_wall_inventory_1):
 * white rounded-xl card, letter avatar box tinted by player color, name +
 * rating pill + turn dot, fence wall-count pill, plain timer chip.
 * No turn border, no timer highlight — both cards always look the same.
 */
export const InGamePlayerChip: React.FC<InGamePlayerChipProps> = ({
  player,
  isActive,
  timeLeft,
  rating,
  bonus,
  hideWallsBadge = false,
}) => {
  const ball = playerColor(player.index, player.color);
  const tint = avatarTint(ball);
  const initial = player.displayName ? player.displayName.charAt(0).toUpperCase() : 'P';

  return (
    <View style={styles.playerCard}>
      {/* Left: letter avatar + name + rating + walls */}
      <View style={styles.playerLeft}>
        <View style={[styles.avatarBox, { backgroundColor: tint.bg, borderColor: tint.border }]}>
          <Text style={[styles.avatarLetter, { color: tint.text }]}>{initial}</Text>
        </View>

        <View style={styles.playerMeta}>
          <View style={styles.nameRow}>
            <Text style={[styles.playerName, isActive && styles.playerNameActive]} numberOfLines={1}>
              {player.displayName}
            </Text>
            {rating !== undefined && (
              <View style={styles.ratingBadge}>
                <Text style={styles.ratingText}>{Math.round(rating)}</Text>
              </View>
            )}
            {/* Wall inventory pill — same line as the name, like Stitch. */}
            {!hideWallsBadge && (
              <View style={[styles.wallsBadge, { borderColor: tint.border, backgroundColor: tint.bg }]}>
                <MaterialIcons name="fence" size={14} color={ball} />
                <Text style={[styles.wallsText, { color: ball }]}>
                  {player.wallsRemaining}
                </Text>
              </View>
            )}
            {isActive && <View style={[styles.turnDot, { backgroundColor: ball }]} />}
          </View>
        </View>
      </View>

      {/* Right: timer chip — identical on both cards, every turn. */}
      {timeLeft !== undefined && (
        <View style={styles.timerBox}>
          <MaterialCommunityIcons name="timer-outline" size={17} color="#64748B" />
          <Text style={styles.timerText}>
            {formatTimer(timeLeft)}
          </Text>
          {bonus !== undefined && bonus !== null && bonus > 0 && (
            <Text style={styles.bonusText}>+{bonus}</Text>
          )}
        </View>
      )}
    </View>
  );
};

export const PlayerStrip: React.FC<{
  state: GameState;
  timers?: Record<string, number>;
  compact?: boolean;
  ratings?: Record<string, number>;
  bonus?: { playerId: string; amount: number } | null;
  hideWallsBadge?: boolean;
}> = ({ state, timers, ratings, bonus = null, hideWallsBadge = false }) => {
  // 3-4 player tables use one compact horizontal strip (scrolls when
  // narrow) instead of tall stacked cards. Same information, compressed.
  if (state.players.length > 2) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.compactRow}
      >
        {state.players.map((p) => {
          const isActive = state.players[state.currentPlayerIndex]?.id === p.id;
          const ball = playerColor(p.index, p.color);
          const tint = avatarTint(ball);
          const initial = p.displayName ? p.displayName.charAt(0).toUpperCase() : 'P';
          return (
            <View
              key={p.id}
              style={[
                styles.compactItem,
                isActive && { borderColor: ball, backgroundColor: tint.bg },
              ]}
            >
              <View style={[styles.compactAvatar, { backgroundColor: tint.bg, borderColor: tint.border }]}>
                <Text style={[styles.compactLetter, { color: tint.text }]}>{initial}</Text>
              </View>
              <View style={styles.compactMeta}>
                <Text style={styles.compactName} numberOfLines={1}>
                  {p.displayName}
                </Text>
                <View style={styles.compactSub}>
                  {ratings?.[p.id] !== undefined && (
                    <Text style={styles.compactRating}>{Math.round(ratings[p.id])}</Text>
                  )}
                  {p.place !== null && p.place !== undefined && (
                    <Text style={[styles.compactPlace, { color: ball }]}>
                      {p.place === 1 ? '1ST' : p.place === 2 ? '2ND' : p.place === 3 ? '3RD' : `${p.place}TH`}
                    </Text>
                  )}
                  {timers?.[p.id] !== undefined && (
                    <Text style={styles.compactTime}>{formatTimer(timers[p.id])}</Text>
                  )}
                </View>
              </View>
              {isActive && <View style={[styles.turnDot, { backgroundColor: ball }]} />}
            </View>
          );
        })}
      </ScrollView>
    );
  }
  return (
    <View style={styles.strip}>
      {state.players.map((p) => {
        const isActive = state.players[state.currentPlayerIndex]?.id === p.id;
        const timeLeft = timers?.[p.id];
        const playerRating = ratings?.[p.id];
        const playerBonus = bonus?.playerId === p.id ? bonus.amount : null;

        return (
          <InGamePlayerChip
            key={p.id}
            player={p}
            isActive={isActive}
            timeLeft={timeLeft}
            rating={playerRating}
            bonus={playerBonus}
            hideWallsBadge={hideWallsBadge}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  strip: {
    width: '100%',
    gap: 8,
  },
  compactRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  compactItem: {
    minWidth: 116,
    maxWidth: 150,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 5,
    paddingHorizontal: 7,
    ...THEME.shadows.card,
  },
  compactAvatar: {
    width: 26,
    height: 26,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactLetter: {
    fontFamily: THEME.fonts.bold,
    fontSize: 13,
    fontWeight: '700',
  },
  compactMeta: {
    flexDirection: 'column',
    gap: 1,
  },
  compactName: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 11,
    fontWeight: '600',
    color: '#0F172A',
    maxWidth: 68,
  },
  compactSub: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compactRating: {
    fontFamily: THEME.fonts.medium,
    fontSize: 10,
    fontWeight: '500',
    color: '#64748B',
  },
  compactPlace: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  compactTime: {
    fontFamily: THEME.fonts.bold,
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: '#1E293B',
  },
  playerCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...THEME.shadows.card,
  },
  playerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  avatarBox: {
    width: 36,
    height: 36,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontFamily: THEME.fonts.bold,
    fontSize: 15,
    fontWeight: '700',
  },
  playerMeta: {
    flexDirection: 'column',
    gap: 2,
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  playerName: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    maxWidth: 120,
  },
  playerNameActive: {
    fontFamily: THEME.fonts.bold,
    fontWeight: '700',
  },
  ratingBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
    backgroundColor: '#F1F5F9',
  },
  ratingText: {
    fontFamily: THEME.fonts.medium,
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
  },
  turnDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  wallsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  wallsText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 11,
    fontWeight: '700',
  },
  timerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  timerText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: '#1E293B',
  },
  bonusText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.tertiary,
    marginLeft: 2,
  },
});
