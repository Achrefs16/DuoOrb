import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { GameState, PlayerState } from '@duoorb/game-core';
import { THEME, hexToRgba, playerColor } from '../theme';
import { nameInitial } from '../displayName';

function formatTimer(seconds?: number): string {
  if (seconds === undefined || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

/**
 * Visual low-time urgency, independent of audio: the 30s sound has a muted
 * audience, and opponents get no cue at all. ≤30s warns, ≤10s alarms — on
 * every layout (chip, grid, strip), computed from the same seconds the chip
 * already renders.
 */
function urgencyColor(seconds?: number): string | null {
  if (seconds === undefined || seconds <= 0) return null;
  if (seconds <= 10) return THEME.colors.danger;
  if (seconds <= 30) return THEME.colors.warning;
  return null;
}

/**
 * Connection/attention state of a seat, shown on its card.
 *
 * `disconnected` and `afk` are deliberately different values with different
 * copy: one player has lost their socket and is inside a reconnect window,
 * the other is connected and simply has not moved. Collapsing them would tell
 * a player their opponent is disconnected while they are watching them play.
 *
 * `reconnecting` is the player's OWN transport state (their socket dropped)
 * — shown on their own card, never on an opponent's. `rejected` is a
 * terminal join failure, shown where it happened.
 */
export type SeatStatus =
  | { kind: 'disconnected'; secondsLeft: number; mine?: boolean }
  | { kind: 'afk'; secondsLeft: number; mine?: boolean }
  | { kind: 'reconnecting'; pendingCount: number; offline?: boolean }
  | { kind: 'rejected'; message: string };

/**
 * One-line card copy for a seat state. Compact cards truncate (`numberOfLines`)
 * at the call site, so server messages stay short on the wire already.
 *
 * `mine` states name the consequence, not just the condition: the one human
 * who can act on the deadline is the one racing it. `offline` distinguishes
 * a known-dead link from a mere dropped socket.
 */
export function seatStatusLabel(status: SeatStatus): string {
  switch (status.kind) {
    case 'disconnected':
      return status.mine
        ? `You forfeit in ${status.secondsLeft}s`
        : `Disconnected · ${status.secondsLeft}s`;
    case 'afk':
      return status.mine
        ? `Move or forfeit · ${status.secondsLeft}s`
        : `No move · ${status.secondsLeft}s`;
    case 'reconnecting':
      if (status.offline) return "You're offline · retrying";
      return status.pendingCount > 0
        ? `Reconnecting… · ${status.pendingCount} to send`
        : 'Reconnecting…';
    case 'rejected':
      return status.message;
  }
}

/** Pill severity for the large card; compact cards use the text equivalent. */
function seatStatusTone(status: SeatStatus): 'danger' | 'warn' {
  switch (status.kind) {
    case 'disconnected':
    case 'reconnecting':
    case 'rejected':
      return 'danger';
    case 'afk':
      return 'warn';
  }
}

/** Compact-card text color matching the large-card pill severity. */
function seatStatusCompactColor(status: SeatStatus): string {
  switch (seatStatusTone(status)) {
    case 'danger':
      return THEME.colors.danger;
    case 'warn':
      return THEME.colors.warning;
  }
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
   * Reconnect grace or inactivity, whichever applies to this seat. While set,
   * the card says so instead of pretending everything is normal.
   */
  status?: SeatStatus | null;
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
  status = null,
  onPressIdentity,
}) => {
  const ball = playerColor(player.index, player.color);
  const tint = avatarTint(ball);
  const initial = nameInitial(player.displayName);
  const identityLabel = onPressIdentity
    ? `View ${player.displayName}'s profile`
    : undefined;
  // While a seat is unreachable, idle, syncing or rejected, its numbers are
  // stale: a rating and wall count frozen at that moment would read as
  // current truth, so both are hidden until the seat is back.
  const hideStats = status !== null;
  const tone = status ? seatStatusTone(status) : null;
  const urgent = urgencyColor(timeLeft);
  const statusIcon =
    status?.kind === 'disconnected' || status?.kind === 'reconnecting'
      ? 'wifi-off'
      : status?.kind === 'afk'
      ? 'clock'
      : status?.kind === 'rejected'
      ? 'alert-circle'
      : null;

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
            {rating !== undefined && !hideStats && (
              <View style={styles.ratingBadge}>
                <Text style={styles.ratingText}>{Math.round(rating)}</Text>
              </View>
            )}
            {/* Wall inventory pill — same line as the name, like Stitch. */}
            {!hideWallsBadge && !hideStats && (
              <View style={[styles.wallsBadge, { borderColor: tint.border, backgroundColor: tint.bg }]}>
                <MaterialIcons name="fence" size={14} color={ball} />
                <Text style={[styles.wallsText, { color: ball }]}>
                  {player.wallsRemaining}
                </Text>
              </View>
            )}
            {isActive && <View style={[styles.turnDot, { backgroundColor: ball }]} />}
          </View>

          {/* Connection / attention state, under the name line. Replaces the
              stats above rather than stacking on them: a card that is already
              saying "Disconnected · 31s" has nothing useful to add with a
              stale rating. */}
          {status && statusIcon && tone && (
            <View
              style={[
                styles.statusPill,
                tone === 'danger' ? styles.statusPillDanger : styles.statusPillWarn,
              ]}
            >
              <Feather name={statusIcon} size={11} color={THEME.colors.onPrimary} />
              <Text style={styles.statusText} numberOfLines={1} ellipsizeMode="tail">
                {seatStatusLabel(status)}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Right: timer chip — identical on both cards, every turn. */}
      {timeLeft !== undefined && (
        <View style={styles.timerBox}>
          <MaterialCommunityIcons
            name="timer-outline"
            size={17}
            color={urgent ?? THEME.colors.textSecondaryStrong}
          />
          <Text style={[styles.timerText, urgent !== null && { color: urgent }]}>
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
  /** Per-seat connection/attention state, keyed by seat id. */
  seatStatus?: Record<string, SeatStatus>;
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
  seatStatus,
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
          const seat = seatStatus?.[p.id] ?? null;
          // Stale while the seat is unreachable: hide rather than freeze.
          const showWalls = !hideWallsBadge && hideWallsForPlayerId !== p.id && seat === null;
          const playerBonus = bonus?.playerId === p.id ? bonus.amount : null;
          const urgent = urgencyColor(timers?.[p.id]);
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
                  {seat ? (
                    <Text
                      style={[styles.compactStatus, { color: seatStatusCompactColor(seat) }]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {seatStatusLabel(seat)}
                    </Text>
                  ) : (
                    <>
                      {ratings?.[p.id] !== undefined && (
                        <Text style={styles.compactRating}>{Math.round(ratings[p.id])}</Text>
                      )}
                    </>
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
                    <Text style={[styles.compactTime, urgent !== null && { color: urgent }]}>
                      {formatTimer(timers[p.id])}
                    </Text>
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
          const seat = seatStatus?.[p.id] ?? null;
          const urgent = urgencyColor(timers?.[p.id]);
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
                  {seat ? (
                    <Text
                      style={[styles.compactStatus, { color: seatStatusCompactColor(seat) }]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {seatStatusLabel(seat)}
                    </Text>
                  ) : (
                    ratings?.[p.id] !== undefined && (
                      <Text style={styles.compactRating}>{Math.round(ratings[p.id])}</Text>
                    )
                  )}
                  {p.place !== null && p.place !== undefined && (
                    <Text style={[styles.compactPlace, { color: ball }]}>
                      {p.place === 1 ? '1ST' : p.place === 2 ? '2ND' : p.place === 3 ? '3RD' : `${p.place}TH`}
                    </Text>
                  )}
                  {!seat && p.wallsRemaining !== undefined && (
                    <View style={[styles.gridWalls, { borderColor: tint.border, backgroundColor: tint.bg }]}>
                      <MaterialIcons name="fence" size={12} color={ball} />
                      <Text style={[styles.gridWallsText, { color: ball }]}>
                        {p.wallsRemaining}
                      </Text>
                    </View>
                  )}
                  {timers?.[p.id] !== undefined && (
                    <Text style={[styles.compactTime, urgent !== null && { color: urgent }]}>
                      {formatTimer(timers[p.id])}
                    </Text>
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
            status={seatStatus?.[p.id] ?? null}
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
  // Connection/attention state on the compact cards: no pill, the sub line IS
  // the message, so it can never overflow the narrow grid cell.
  compactStatus: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 10,
    fontWeight: '700',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    borderRadius: THEME.radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statusPillDanger: {
    backgroundColor: THEME.colors.danger,
  },
  statusPillWarn: {
    backgroundColor: THEME.colors.warning,
  },
  statusText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.onPrimary,
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
