import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { GameState, PlayerState } from '@duoorb/game-core';
import { THEME, hexToRgba, playerColor } from '../theme';
import { nameInitial } from '../displayName';

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
  /**
   * Opens this seat's profile. Present for opponents with a real account and
   * absent for your own seat, AI and local play, so the avatar and the name
   * are the only tappable parts of the card.
   */
  onPressIdentity?: () => void;
}

/** Avatar tint per ball color, matching the Stitch active-match design. */
function avatarTint(ball: string): { bg: string; border: string; text: string } {
  // Compared against the tokens, not literals: the ball colours come from
  // THEME.colors.player1..4, so hardcoding the same hex here meant a palette
  // change silently stopped tinting avatars.
  const b = ball.toUpperCase();
  if (b === THEME.colors.primary.toUpperCase()) {
    return {
      bg: THEME.colors.surfacePrimaryTintBorderSoft,
      border: THEME.colors.surfacePrimaryTintBorder,
      text: THEME.colors.primary,
    };
  }
  if (b === THEME.colors.player2.toUpperCase() || b === THEME.colors.dangerBright.toUpperCase()) {
    return { bg: THEME.colors.dangerLight, border: THEME.colors.dangerBorder, text: THEME.colors.error };
  }
  if (b === THEME.colors.player3.toUpperCase()) {
    return { bg: THEME.colors.successTint, border: THEME.colors.winBorder, text: THEME.colors.win };
  }
  if (b === THEME.colors.player4.toUpperCase()) {
    return { bg: THEME.colors.warningLight, border: THEME.colors.warningBorder, text: THEME.colors.warning };
  }
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
  onPressIdentity,
}) => {
  const ball = playerColor(player.index, player.color);
  const tint = avatarTint(ball);
  const initial = nameInitial(player.displayName);
  const identityLabel = onPressIdentity
    ? `View ${player.displayName}'s profile`
    : undefined;

  return (
    <View style={styles.playerCard}>
      {/* Left: letter avatar + name + rating + walls */}
      <View style={styles.playerLeft}>
        <Pressable
          onPress={onPressIdentity}
          disabled={!onPressIdentity}
          hitSlop={6}
          accessibilityRole={onPressIdentity ? 'button' : undefined}
          accessibilityLabel={identityLabel}
        >
          <View style={[styles.avatarBox, { backgroundColor: tint.bg, borderColor: tint.border }]}>
            <Text style={[styles.avatarLetter, { color: tint.text }]}>{initial}</Text>
          </View>
        </Pressable>

        <View style={styles.playerMeta}>
          <View style={styles.nameRow}>
            <Text
              onPress={onPressIdentity}
              suppressHighlighting
              accessibilityRole={onPressIdentity ? 'button' : undefined}
              accessibilityLabel={identityLabel}
              style={[styles.playerName, isActive && styles.playerNameActive]}
              numberOfLines={1}
            >
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
          <MaterialCommunityIcons name="timer-outline" size={17} color={THEME.colors.textSecondaryStrong} />
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
  /**
   * Split-table layout: compact cards in a wrapping 2-column grid (two
   * above the board, two below) instead of one scrolling strip, so every
   * seat keeps its avatar, truncated name, wall count and clock visible
   * on narrow screens with no overlap.
   */
  grid?: boolean;
  /** Hides the wall pill for a single seat (your own — the tray shows it). */
  hideWallsForPlayerId?: string;
  /**
   * Called with the seat id of the tapped opponent. Omitted entirely when
   * the seats have no account behind them, which keeps every chip inert
   * without a per-player "is this tappable" map.
   */
  onPressPlayer?: (playerId: string) => void;
}> = ({
  state,
  timers,
  ratings,
  bonus = null,
  hideWallsBadge = false,
  grid = false,
  hideWallsForPlayerId,
  onPressPlayer,
}) => {
  // Split multiplayer tables (2 up / 2 down): side-by-side compact cards
  // that flex with the row width. Long names truncate (numberOfLines +
  // minWidth 0) while the wall pill and clock are shrink-proof, so the
  // clock can never cover the wall count, even on narrow screens.
  if (grid) {
    return (
      <View style={styles.gridRow}>
        {state.players.map((p) => {
          const isActive = state.players[state.currentPlayerIndex]?.id === p.id;
          const ball = playerColor(p.index, p.color);
          const tint = avatarTint(ball);
          const initial = nameInitial(p.displayName);
          const onPressIdentity = onPressPlayer ? () => onPressPlayer(p.id) : undefined;
          const identityLabel = onPressIdentity ? `View ${p.displayName}'s profile` : undefined;
          const showWalls = !hideWallsBadge && hideWallsForPlayerId !== p.id;
          const playerBonus = bonus?.playerId === p.id ? bonus.amount : null;
          return (
            <View
              key={p.id}
              style={[
                styles.compactItem,
                styles.gridItem,
                isActive && { borderColor: ball, backgroundColor: tint.bg },
              ]}
            >
              <Pressable
                onPress={onPressIdentity}
                disabled={!onPressIdentity}
                hitSlop={6}
                accessibilityRole={onPressIdentity ? 'button' : undefined}
                accessibilityLabel={identityLabel}
                style={styles.gridAvatarPress}
              >
                <View style={[styles.compactAvatar, { backgroundColor: tint.bg, borderColor: tint.border }]}>
                  <Text style={[styles.compactLetter, { color: tint.text }]}>{initial}</Text>
                </View>
              </Pressable>
              <View style={styles.gridMeta}>
                <Text
                  onPress={onPressIdentity}
                  suppressHighlighting
                  accessibilityRole={onPressIdentity ? 'button' : undefined}
                  accessibilityLabel={identityLabel}
                  style={styles.gridName}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
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
                  {showWalls && (
                    <View style={[styles.gridWalls, { borderColor: tint.border, backgroundColor: tint.bg }]}>
                      <MaterialIcons name="fence" size={12} color={ball} />
                      <Text style={[styles.gridWallsText, { color: ball }]}>
                        {p.wallsRemaining}
                      </Text>
                    </View>
                  )}
                  {timers?.[p.id] !== undefined && (
                    <Text style={styles.compactTime}>{formatTimer(timers[p.id])}</Text>
                  )}
                  {playerBonus !== null && playerBonus > 0 && (
                    <Text style={styles.bonusText}>+{playerBonus}</Text>
                  )}
                </View>
              </View>
              {isActive && <View style={[styles.turnDot, { backgroundColor: ball }]} />}
            </View>
          );
        })}
      </View>
    );
  }
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
          const initial = nameInitial(p.displayName);
          const onPressIdentity = onPressPlayer ? () => onPressPlayer(p.id) : undefined;
          const identityLabel = onPressIdentity ? `View ${p.displayName}'s profile` : undefined;
          return (
            <View
              key={p.id}
              style={[
                styles.compactItem,
                isActive && { borderColor: ball, backgroundColor: tint.bg },
              ]}
            >
              <Pressable
                onPress={onPressIdentity}
                disabled={!onPressIdentity}
                hitSlop={6}
                accessibilityRole={onPressIdentity ? 'button' : undefined}
                accessibilityLabel={identityLabel}
              >
                <View style={[styles.compactAvatar, { backgroundColor: tint.bg, borderColor: tint.border }]}>
                  <Text style={[styles.compactLetter, { color: tint.text }]}>{initial}</Text>
                </View>
              </Pressable>
              <View style={styles.compactMeta}>
                <Text
                  onPress={onPressIdentity}
                  suppressHighlighting
                  accessibilityRole={onPressIdentity ? 'button' : undefined}
                  accessibilityLabel={identityLabel}
                  style={styles.compactName}
                  numberOfLines={1}
                >
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
            onPressIdentity={onPressPlayer ? () => onPressPlayer(p.id) : undefined}
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
    backgroundColor: THEME.colors.backgroundCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceHairline,
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
    color: THEME.colors.inverseLabel,
    maxWidth: 68,
  },
  compactSub: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  compactRating: {
    fontFamily: THEME.fonts.medium,
    fontSize: 10,
    fontWeight: '500',
    color: THEME.colors.textSecondaryStrong,
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
    color: THEME.colors.slate[800],
    flexShrink: 0,
  },
  gridRow: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gridItem: {
    flex: 1,
    minWidth: 0,
    maxWidth: '100%',
    flexShrink: 1,
  },
  gridAvatarPress: {
    flexShrink: 0,
  },
  gridMeta: {
    flexDirection: 'column',
    gap: 1,
    flex: 1,
    minWidth: 0,
  },
  gridName: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.inverseLabel,
    flexShrink: 1,
    minWidth: 0,
  },
  gridWalls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
    flexShrink: 0,
  },
  gridWallsText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  playerCard: {
    width: '100%',
    backgroundColor: THEME.colors.backgroundCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceHairline,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    ...THEME.shadows.card,
  },
  playerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
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
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  playerName: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.inverseLabel,
    maxWidth: 120,
    flexShrink: 1,
    minWidth: 0,
  },
  playerNameActive: {
    fontFamily: THEME.fonts.bold,
    fontWeight: '700',
  },
  ratingBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
    backgroundColor: THEME.colors.surfaceMuted,
    flexShrink: 0,
  },
  ratingText: {
    fontFamily: THEME.fonts.medium,
    fontSize: 11,
    fontWeight: '500',
    color: THEME.colors.textSecondaryStrong,
  },
  turnDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  wallsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    flexShrink: 0,
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
    backgroundColor: THEME.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceHairline,
    flexShrink: 0,
    marginLeft: 8,
  },
  timerText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: THEME.colors.slate[800],
  },
  bonusText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.tertiary,
    marginLeft: 2,
  },
});
