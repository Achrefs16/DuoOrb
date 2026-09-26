import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../theme';
import { TIME_CONTROLS, TimeControl } from '../timeControls';
import { GameMode, playerCountForMode } from '@duoorb/game-core';
import { RoomDto } from '@duoorb/protocol';
import { MatchType, modeLabel, resolveMode } from '../matchModes';
import { useMatchmaking } from '../network/useMatchmaking';
import { useRooms } from '../network/useRooms';
import { api } from '../network/apiClient';
import { getCurrentUser } from '../network/auth';

export type OnlineMode = 'quick' | 'rooms';

interface OnlineScreenProps {
  onBack: () => void;
  initialClock: TimeControl;
  initialView: OnlineMode;
  inviteName?: string | null;
  /** Custom Online Match config: enter ranked matchmaking for this exact setup. */
  autoMatch?: { mode: GameMode; clock: TimeControl; wallsEach: number } | null;
  /** Custom Online Match config: create this room immediately on entry. */
  autoRoom?: { mode: GameMode; clock: TimeControl; wallsEach: number } | null;
  initialRoom?: RoomDto | null;
  /**
   * Called after a one-shot entry trigger (autoMatch/autoRoom) fires, so
   * the parent clears it: a later return to this lobby must not replay it.
   */
  onConsumeAutoEntry?: () => void;
  onStartOnlineGame: (
    gameId: string,
    mode: GameMode,
    clock: TimeControl,
    source?: 'quick' | 'custom' | 'room',
    room?: RoomDto | null
  ) => void;
}

export const OnlineScreen: React.FC<OnlineScreenProps> = ({
  onBack,
  initialClock,
  initialView,
  inviteName = null,
  autoMatch = null,
  autoRoom = null,
  initialRoom = null,
  onStartOnlineGame,
  onConsumeAutoEntry,
}) => {
  const [view] = useState<OnlineMode>(initialView);
  const [clock, setClock] = useState<TimeControl>(initialClock);
  const matchConfig = autoMatch ?? { mode: '2p' as GameMode, clock: initialClock, wallsEach: 10 };
  const matchPlayerCount = playerCountForMode(matchConfig.mode);
  const [roomKind, setRoomKind] = useState<MatchType>('classic');
  const [roomCount, setRoomCount] = useState<2 | 3 | 4>(2);
  const [wallsCount, setWallsCount] = useState<10 | 15 | 'unlimited'>(10);
  const roomType: GameMode = resolveMode(roomKind, roomCount);
  const [roomCodeInput, setRoomCodeInput] = useState<string>('');
  const [copiedMsg, setCopiedMsg] = useState<string | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [onlineFriends, setOnlineFriends] = useState<{ id: string; username: string; displayName: string; status: string }[]>([]);
  const [quickAddLoading, setQuickAddLoading] = useState(false);
  const [confirmMode, setConfirmMode] = useState<
    'close' | 'leave' | { kind: 'kick'; userId: string; name: string } | null
  >(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentUser = getCurrentUser();
  const [myRating, setMyRating] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const me = await api.getMe();
        const r = me?.ratings?.CLASSIC_1V1?.rating;
        if (typeof r === 'number') setMyRating(Math.round(r));
      } catch {
        // stay blank
      }
    })();
  }, []);

  const lastRoomRef = useRef<RoomDto | null>(null);

  const handleGameStarted = useCallback(
    (_roomId: string, gameId: string) => {
      onStartOnlineGame(gameId, roomType, clock, 'room', lastRoomRef.current);
    },
    [onStartOnlineGame, roomType, clock]
  );

  const {
    state: mmState,
    findMatch,
    cancelMatch,
  } = useMatchmaking({
    onMatched: (gameId) => {
      // The search spec is snapshotted when the search STARTS: entry props
      // are consumed (cleared) right after firing, so reading matchConfig
      // here would hand the next game the lobby defaults.
      const spec = searchSpec;
      onStartOnlineGame(
        gameId,
        spec?.mode ?? matchConfig.mode,
        spec?.clock ?? matchConfig.clock,
        spec ? (spec.custom ? 'custom' : 'quick') : autoMatch ? 'custom' : 'quick'
      );
    },
  });

  const {
    activeRoom,
    loading: roomLoading,
    error: roomError,
    isHost,
    isReady,
    canStart,
    clearError,
    createRoom,
    inviteToRoom,
    joinRoom,
    setReady,
    startRoom,
    kickPlayer,
    leaveRoom,
  } = useRooms({
    onGameStarted: handleGameStarted,
    initialRoom,
  });

  useEffect(() => {
    if (activeRoom) lastRoomRef.current = activeRoom;
  }, [activeRoom]);

  // Matchmaking pulse animation.
  // The Animated.Value lives in state (not a ref) and the interpolation nodes
  // are derived in an effect, so nothing reads a ref during render.
  const [pulseAnim] = useState(() => new Animated.Value(0.4));
  const pulseStyles = useMemo(
    () => ({
      dotA: pulseAnim.interpolate({ inputRange: [0.4, 1], outputRange: [1, 0.3] }),
      dotB: pulseAnim.interpolate({ inputRange: [0.4, 1], outputRange: [0.3, 1] }),
      dotC: pulseAnim.interpolate({ inputRange: [0.4, 1], outputRange: [0.6, 0.3] }),
      ping: {
        transform: [{ scale: pulseAnim.interpolate({ inputRange: [0.4, 1], outputRange: [1, 1.18] }) }],
        opacity: pulseAnim.interpolate({ inputRange: [0.4, 1], outputRange: [0.7, 0] }),
      },
    }),
    [pulseAnim]
  );

  useEffect(() => {
    if (view === 'quick' && mmState === 'searching') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.4,
            duration: 900,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [view, mmState, pulseAnim]);

  // Automatically start search if entering quick mode
  const autoStarted = useRef(false);
  // Snapshot of the search that is actually running (see onMatched above).
  const [searchSpec, setSearchSpec] = useState<{
    mode: GameMode;
    clock: TimeControl;
    wallsEach: number;
    custom: boolean;
  } | null>(null);
  useEffect(() => {
    if (view === 'quick' && !autoStarted.current && mmState === 'idle') {
      autoStarted.current = true;
      setSearchSpec({
        mode: matchConfig.mode,
        clock: matchConfig.clock,
        wallsEach: matchConfig.wallsEach,
        custom: !!autoMatch,
      });
      findMatch(matchConfig.mode, matchConfig.clock, matchConfig.wallsEach);
      // One-shot entry consumed: returning here later must stay idle.
      onConsumeAutoEntry?.();
    }
  }, [view, mmState, findMatch, matchConfig.mode, matchConfig.clock, matchConfig.wallsEach, autoMatch, onConsumeAutoEntry]);

  useEffect(() => {
    return () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    };
  }, []);

  const flashCopied = (msg: string) => {
    setCopiedMsg(msg);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopiedMsg(null), 2000);
  };

  const copyCode = async (code: string, msg: string) => {
    try {
      await Clipboard.setStringAsync(code);
    } catch {
      // ignore
    }
    flashCopied(msg);
  };

  const inviteHandled = useRef(false);
  useEffect(() => {
    if (!inviteName || inviteHandled.current) return;
    inviteHandled.current = true;
    void createRoom(roomType, clock).then((room) => {
      if (room) {
        void copyCode(room.code, `Room code copied for ${inviteName}!`);
      }
    });
  }, [inviteName, roomType, clock, createRoom]);

  // Custom Online Match: the setup screen already configured mode/clock/
  // walls — land straight in a fresh lobby for those settings.
  const autoRoomHandled = useRef(false);
  useEffect(() => {
    if (!autoRoom || autoRoomHandled.current) return;
    autoRoomHandled.current = true;
    // One-shot entry consumed: a later return must not create a duplicate.
    onConsumeAutoEntry?.();
    void createRoom(autoRoom.mode, autoRoom.clock, autoRoom.wallsEach).then((room) => {
      if (room) {
        void copyCode(room.code, 'Room code copied — invite friends!');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRoom]);

  const openQuickAdd = async () => {
    if (!activeRoom || quickAddLoading) return;
    setQuickAddLoading(true);
    try {
      const list = await api.getFriends();
      const memberIds = new Set(activeRoom.slots.map((s) => s.userId).filter(Boolean) as string[]);
      setOnlineFriends(
        list.filter((f) => (f.status === 'ONLINE' || f.status === 'PLAYING') && !memberIds.has(f.id))
      );
      setShowQuickAdd(true);
    } catch {
      setOnlineFriends([]);
      setShowQuickAdd(true);
    } finally {
      setQuickAddLoading(false);
    }
  };

  const inviteFriend = async (friendId: string) => {
    if (!activeRoom) return;
    const sent = await inviteToRoom(activeRoom.id, friendId);
    if (sent) {
      setShowQuickAdd(false);
    }
  };

  const handleBack = () => {
    // Inside a lobby, back asks to close/leave first (Stitch confirm).
    if (activeRoom) {
      setConfirmMode(isHost ? 'close' : 'leave');
      return;
    }
    if (mmState === 'searching') cancelMatch();
    onBack();
  };

  const confirmLeaveRoom = () => {
    if (confirmMode !== null && typeof confirmMode === 'object') {
      const target = confirmMode;
      setConfirmMode(null);
      kickPlayer(target.userId);
      return;
    }
    const goHome = confirmMode === 'leave';
    setConfirmMode(null);
    leaveRoom();
    if (goHome) onBack();
  };

  const confirmTitle =
    confirmMode !== null && typeof confirmMode === 'object'
      ? 'Kick Player?'
      : confirmMode === 'close'
      ? 'Close room?'
      : 'Leave room?';
  const confirmDesc =
    confirmMode !== null && typeof confirmMode === 'object'
      ? `Are you sure you want to remove ${confirmMode.name} from the room?`
      : confirmMode === 'close'
      ? 'This will remove all players from the room.'
      : 'Are you sure you want to leave this game room?';
  const confirmCTA =
    confirmMode !== null && typeof confirmMode === 'object'
      ? 'Kick Player'
      : confirmMode === 'close'
      ? 'Close Room'
      : 'Leave';

  // -------------------------------------------------------------
  // 1. QUICK MATCH (STITCH RADAR MATCHMAKING LOADING)
  // -------------------------------------------------------------
  if (view === 'quick') {
    const isSearching = mmState === 'searching';
    const isMatched = mmState === 'matched';

    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={handleBack}
            accessibilityLabel="Cancel matchmaking"
          >
            <Feather name="x" size={20} color="#334155" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isMatched
              ? 'Match Found'
              : matchPlayerCount === 2
              ? 'Finding Opponent'
              : `Filling ${matchPlayerCount}-Player Table`}
          </Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          style={styles.mmScroll}
          contentContainerStyle={styles.mmBody}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Configuration card */}
          <View style={styles.mmConfigCard}>
            <View style={styles.mmConfigRow}>
              <Text style={styles.mmConfigLabel}>MODE</Text>
              <Text style={styles.mmConfigValue}>{modeLabel(matchConfig.mode)}</Text>
            </View>
            <View style={styles.mmConfigDivider} />
            <View style={styles.mmConfigRow}>
              <Text style={styles.mmConfigLabel}>TIME</Text>
              <Text style={styles.mmConfigValue}>{matchConfig.clock.short}</Text>
            </View>
            <View style={styles.mmConfigDivider} />
            <View style={styles.mmConfigRow}>
              <Text style={styles.mmConfigLabel}>QUEUE</Text>
              <View style={styles.mmRankedPill}>
                <View style={styles.mmRankedDot} />
                <Text style={styles.mmRankedText}>RANKED</Text>
              </View>
            </View>
          </View>

          {/* Matchup card */}
          <View style={styles.mmMatchCard}>
            <View style={styles.mmPlayerCol}>
              <View style={styles.mmAvatarYou}>
                <Text style={styles.mmAvatarLetterYou}>
                  {(currentUser.displayName || 'Y').charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.mmPlayerTag}>YOU</Text>
              <Text style={styles.mmPlayerName} numberOfLines={1}>
                {currentUser.displayName || 'You'}
              </Text>
              <View style={styles.mmRatingPill}>
                <Text style={styles.mmRatingText}>
                  {myRating !== null ? myRating : '—'}
                </Text>
              </View>
            </View>

            <View style={styles.mmVersusCol}>
              <Text style={styles.mmVersusText}>VS</Text>
              <View style={styles.mmDotsRow}>
                <Animated.View style={[styles.mmDot, { opacity: pulseStyles.dotA }]} />
                <Animated.View style={[styles.mmDot, { opacity: pulseStyles.dotB }]} />
                <Animated.View style={[styles.mmDot, { opacity: pulseStyles.dotC }]} />
              </View>
            </View>

            <View style={styles.mmPlayerCol}>
              <View style={styles.mmAvatarSlot}>
                {isMatched ? (
                  <Text style={styles.mmAvatarLetterOpp}>O</Text>
                ) : (
                  <>
                    <Animated.View style={[styles.mmSlotPing, pulseStyles.ping]} />
                    <Text style={styles.mmSlotDash}>—</Text>
                  </>
                )}
              </View>
              <Text style={styles.mmPlayerTag}>
                {isMatched ? 'READY' : 'OPEN'}
              </Text>
              <Text style={styles.mmPlayerName} numberOfLines={1}>
                {isMatched
                  ? matchPlayerCount === 2
                    ? 'Opponent'
                    : 'Table Ready'
                  : 'Searching'}
              </Text>
              <View style={styles.mmRatingPill}>
                <Text style={styles.mmRatingText}>
                  {isMatched ? 'READY' : '—'}
                </Text>
              </View>
            </View>
          </View>

          {/* Action */}
          <View style={styles.radarActionRow}>
            {isSearching ? (
              <TouchableOpacity
                style={styles.cancelSearchBtn}
                activeOpacity={0.8}
                onPress={() => {
                  cancelMatch();
                  onBack();
                }}
              >
                <Feather name="x" size={16} color={THEME.colors.onSurface} />
                <Text style={styles.cancelSearchText}>Cancel Search</Text>
              </TouchableOpacity>
            ) : !isMatched ? (
              <TouchableOpacity
                style={styles.retrySearchBtn}
                activeOpacity={0.85}
                onPress={() => {
                  setSearchSpec({
                    mode: matchConfig.mode,
                    clock: matchConfig.clock,
                    wallsEach: matchConfig.wallsEach,
                    custom: false,
                  });
                  findMatch(matchConfig.mode, matchConfig.clock, matchConfig.wallsEach);
                }}
              >
                <Feather name="search" size={16} color="#FFFFFF" />
                <Text style={styles.retrySearchText}>Search Again</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </ScrollView>
      </View>
    );
  }

  // -------------------------------------------------------------
  // 2. PRIVATE ROOMS (STITCH LOBBY & JOIN ROOM)
  // -------------------------------------------------------------
  const lobbyModeName =
    activeRoom?.mode === '2p'
      ? 'Classic'
      : activeRoom?.mode === '4p' || activeRoom?.mode === 'center2' || activeRoom?.mode === 'center3'
      ? 'Center Rush'
      : 'Race';
  const lobbyClock = activeRoom
    ? `${activeRoom.timeControlMinutes}+${activeRoom.incrementSeconds}`
    : '';
  const lobbyOccupied = activeRoom?.slots.filter((s) => s.userId !== null).length ?? 0;

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.closeBtn} onPress={handleBack}>
            <Feather name="arrow-left" size={20} color="#334155" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{activeRoom ? 'Private Room' : 'Private Rooms'}</Text>
        </View>
        {activeRoom ? (
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.codePill}
              onPress={() => void copyCode(activeRoom.code, 'Code copied!')}
            >
              <Text style={styles.codePillText}>{activeRoom.code}</Text>
              <Feather name="copy" size={13} color="#2563EB" />
            </TouchableOpacity>
            {isHost && (
              <TouchableOpacity style={styles.closePill} onPress={() => setConfirmMode('close')}>
                <Feather name="log-out" size={14} color="#DC2626" />
                <Text style={styles.closePillText}>Close</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {activeRoom ? (
          /* ACTIVE ROOM LOBBY */
          <>
            {/* Config summary card */}
            <View style={styles.lobbySummary}>
              <View style={styles.lobbySummaryIcon}>
                <Feather name="compass" size={22} color="#2563EB" />
              </View>
              <View>
                <Text style={styles.lobbySummaryTitle}>{lobbyModeName}</Text>
                <Text style={styles.lobbySummarySub}>
                  {activeRoom.slots.length} Players · {lobbyClock}
                </Text>
              </View>
            </View>

            {/* Players header + count */}
            <View style={styles.slotsHeader}>
              <Text style={styles.slotsTitle}>Players</Text>
              <Text style={styles.slotsCount}>
                {lobbyOccupied}/{activeRoom.slots.length}
              </Text>
            </View>

            {/* Participant slots */}
            <View style={styles.slotsList}>
              {activeRoom.slots.map((slot) => {
                const isMe = slot.userId === currentUser.userId;
                const isOccupied = slot.userId !== null;
                const initial = slot.displayName ? slot.displayName.charAt(0).toUpperCase() : '?';

                if (!isOccupied) {
                  const isFirstOpenSlot = activeRoom.slots.findIndex((s) => s.userId === null) === slot.index;
                  return (
                    <View key={slot.index} style={[styles.slotItem, styles.slotEmptyCard]}>
                      <View style={styles.slotLeft}>
                        <View style={[styles.slotAvatar, styles.slotAvatarEmpty]}>
                          <Text style={styles.slotInitialEmpty}>?</Text>
                        </View>
                        <Text style={styles.slotWaiting}>Waiting for player…</Text>
                      </View>
                      {isHost && isFirstOpenSlot ? (
                        <TouchableOpacity style={styles.quickAddBtn} onPress={() => void openQuickAdd()}>
                          <Feather name="user-plus" size={15} color="#2563EB" />
                          <Text style={styles.quickAddText}>Quick Add</Text>
                        </TouchableOpacity>
                      ) : (
                        <Text style={styles.slotOpenTag}>Open slot</Text>
                      )}
                    </View>
                  );
                }

                return (
                  <View key={slot.index} style={styles.slotItem}>
                    <View style={styles.slotLeft}>
                      <View style={styles.slotAvatar}>
                        <Text style={styles.slotInitial}>{initial}</Text>
                      </View>
                      <View>
                        <View style={styles.slotNameRow}>
                          <Text style={styles.slotUsername} numberOfLines={1}>
                            {slot.displayName}
                            {isMe ? ' (You)' : ''}
                          </Text>
                          {slot.isHost && (
                            <View style={styles.hostBadge}>
                              <MaterialCommunityIcons name="crown" size={11} color="#1D4ED8" />
                              <Text style={styles.hostBadgeText}>Host</Text>
                            </View>
                          )}
                        </View>
                        {slot.rating !== undefined && (
                          <Text style={styles.slotRating}>{Math.round(slot.rating)}</Text>
                        )}
                      </View>
                    </View>

                    <View style={styles.slotRight}>
                    {isMe ? (
                      <TouchableOpacity
                        style={[styles.readyPill, slot.isReady ? styles.readyOn : styles.readyOff]}
                        onPress={() => void setReady(!slot.isReady)}
                      >
                        <Feather
                          name="check"
                          size={14}
                          color={slot.isReady ? '#059669' : '#64748B'}
                        />
                        <Text
                          style={[
                            styles.readyPillText,
                            slot.isReady ? styles.readyOnText : styles.readyOffText,
                          ]}
                        >
                          {slot.isReady ? 'Ready' : 'Not ready'}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={[styles.readyPill, slot.isReady ? styles.readyOn : styles.readyOff]}>
                        <Feather
                          name="check"
                          size={14}
                          color={slot.isReady ? '#059669' : '#64748B'}
                        />
                        <Text
                          style={[
                            styles.readyPillText,
                            slot.isReady ? styles.readyOnText : styles.readyOffText,
                          ]}
                        >
                          {slot.isReady ? 'Ready' : 'Not ready'}
                        </Text>
                      </View>
                    )}
                    {isHost && !isMe && slot.userId && (
                      <TouchableOpacity
                        style={styles.kickBtn}
                        onPress={() =>
                          setConfirmMode({
                            kind: 'kick',
                            userId: slot.userId!,
                            name: slot.displayName ?? 'this player',
                          })
                        }
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel={`Remove ${slot.displayName}`}
                      >
                        <Feather name="more-vertical" size={18} color="#94A3B8" />
                      </TouchableOpacity>
                    )}
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Lobby action */}
            {isHost ? (
              <>
                <TouchableOpacity
                  style={[styles.lobbyCta, (!canStart || roomLoading) && styles.btnDisabled]}
                  disabled={!canStart || roomLoading}
                  onPress={() => void startRoom()}
                >
                  {roomLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="play" size={20} color="#FFFFFF" />
                      <Text style={styles.lobbyCtaText}>Start Game</Text>
                    </>
                  )}
                </TouchableOpacity>
                {!canStart && (
                  <Text style={styles.lobbyHint}>Waiting for all players to be ready…</Text>
                )}
              </>
            ) : (
              <TouchableOpacity
                style={[styles.lobbyCta, isReady && styles.lobbyCtaReady]}
                onPress={() => void setReady(!isReady)}
              >
                <Text style={styles.lobbyCtaText}>
                  {isReady ? 'Cancel Ready' : "I'm Ready"}
                </Text>
              </TouchableOpacity>
            )}
            {!!roomError && <Text style={styles.errorText}>{roomError}</Text>}
          </>
        ) : (
          /* CREATE & JOIN CARDS */
          <>
            {/* Create Room Card */}
            <View style={styles.rmCard}>
              {/* Mode Selection */}
              <View style={styles.rmSection}>
                <Text style={styles.rmLabel}>Mode</Text>
                <View style={styles.rmTrack}>
                  {(
                    [
                      { id: 'classic', label: 'Classic' },
                      { id: 'center', label: 'Center Rush' },
                      { id: 'race', label: 'Race' },
                    ] as const
                  ).map((m) => (
                    <TouchableOpacity
                      key={m.id}
                      style={[styles.rmOpt, roomKind === m.id && styles.rmOptActive]}
                      onPress={() => setRoomKind(m.id)}
                    >
                      <Text style={[styles.rmOptText, roomKind === m.id && styles.rmOptTextActive]}>
                        {m.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Dynamic Player Count */}
              {roomKind !== 'classic' && (
                <View style={styles.rmSection}>
                  <Text style={styles.rmLabel}>Players</Text>
                  <View style={styles.rmTrack}>
                    {([2, 3, 4] as const).map((n) => (
                      <TouchableOpacity
                        key={n}
                        style={[styles.rmOpt, roomCount === n && styles.rmOptActive]}
                        onPress={() => setRoomCount(n)}
                      >
                        <Text style={[styles.rmOptText, roomCount === n && styles.rmOptTextActive]}>
                          {n} Players
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Time Control */}
              <View style={styles.rmSection}>
                <Text style={styles.rmLabel}>Time Control</Text>
                <View style={styles.rmTrack}>
                  {TIME_CONTROLS.slice(0, 3).map((tc) => (
                    <TouchableOpacity
                      key={tc.id}
                      style={[styles.rmOpt, clock.id === tc.id && styles.rmOptActive]}
                      onPress={() => setClock(tc)}
                    >
                      <Text style={[styles.rmOptText, clock.id === tc.id && styles.rmOptTextActive]}>
                        {tc.short}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Walls Setting */}
              <View style={styles.rmSection}>
                <Text style={styles.rmLabel}>Walls</Text>
                <View style={styles.rmTrack}>
                  {([10, 15, 'unlimited'] as const).map((w) => (
                    <TouchableOpacity
                      key={w}
                      style={[styles.rmOpt, wallsCount === w && styles.rmOptActive]}
                      onPress={() => setWallsCount(w)}
                    >
                      <Text style={[styles.rmOptText, wallsCount === w && styles.rmOptTextActive]}>
                        {w === 'unlimited' ? 'Unlimited ∞' : `${w} Walls`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Create Room Button */}
              <TouchableOpacity
                style={styles.rmCta}
                activeOpacity={0.88}
                disabled={roomLoading}
                onPress={() =>
                  void createRoom(roomType, clock, wallsCount === 'unlimited' ? 99 : wallsCount)
                }
              >
                {roomLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.rmCtaText}>Create Room</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Join Room Card */}
            <View style={styles.rmCard}>
              <Text style={styles.rmLabel}>Join Room</Text>
              <View style={styles.rmJoinRow}>
                <TextInput
                  style={styles.rmJoinInput}
                  placeholder="Enter room code"
                  placeholderTextColor="#94A3B8"
                  value={roomCodeInput}
                  onChangeText={(t) => setRoomCodeInput(t.toUpperCase())}
                  maxLength={7}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={[
                    styles.rmJoinBtn,
                    (!roomCodeInput.trim() || roomLoading) && styles.joinBtnDisabled,
                  ]}
                  disabled={!roomCodeInput.trim() || roomLoading}
                  onPress={() => void joinRoom(roomCodeInput.trim())}
                >
                  <Text style={styles.rmJoinBtnText}>Join</Text>
                </TouchableOpacity>
              </View>
              {roomError && <Text style={styles.errorText}>{roomError}</Text>}
            </View>
          </>
        )}
      </ScrollView>

      {/* Close / Leave / Kick confirm */}
      {confirmMode && (
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            {confirmMode !== null && typeof confirmMode === 'object' && (
              <View style={styles.kickIconCircle}>
                <MaterialCommunityIcons name="account-remove" size={22} color="#DC2626" />
              </View>
            )}
            <Text style={styles.confirmTitle}>{confirmTitle}</Text>
            <Text style={styles.confirmDesc}>{confirmDesc}</Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.confirmDanger} onPress={confirmLeaveRoom}>
                <Text style={styles.confirmDangerText}>{confirmCTA}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmCancel}
                onPress={() => setConfirmMode(null)}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
      {showQuickAdd && (
        <Modal visible transparent animationType="none">
          <View style={styles.sheetOverlay}>
          <View style={styles.sheetCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Quick Add</Text>
              <TouchableOpacity style={styles.sheetClose} onPress={() => setShowQuickAdd(false)}>
                <Feather name="x" size={20} color={THEME.colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.quickAddSub}>Invite an online friend to this room.</Text>
            <ScrollView style={styles.modalResultsScroll} contentContainerStyle={styles.modalResultsContent}>
              {onlineFriends.length === 0 ? (
                <Text style={styles.searchHint}>No online friends available.</Text>
              ) : (
                onlineFriends.map((friend) => (
                  <View key={friend.id} style={styles.searchResultItem}>
                    <View style={styles.searchResultLeft}>
                      <View style={styles.searchAvatar}>
                        <Text style={styles.searchAvatarText}>
                          {(friend.displayName || friend.username).charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.searchUsername}>{friend.displayName || friend.username}</Text>
                        <Text style={styles.searchHandle}>@{friend.username} · {friend.status === 'PLAYING' ? 'In a match' : 'Online'}</Text>
                      </View>
                    </View>
                    <TouchableOpacity style={styles.quickAddBtn} onPress={() => void inviteFriend(friend.id)}>
                      <Feather name="user-plus" size={15} color="#2563EB" />
                      <Text style={styles.quickAddText}>Invite</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  header: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.colors.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.surfaceContainer,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: THEME.fonts.bold,
    fontSize: 17,
    fontWeight: '700',
    color: THEME.colors.onSurface,
  },
  scrollArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
    gap: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  codePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  codePillText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  closePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  closePillText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
  lobbySummary: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...THEME.shadows.card,
  },
  lobbySummaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lobbySummaryTitle: {
    fontFamily: THEME.fonts.bold,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  lobbySummarySub: {
    fontFamily: THEME.fonts.medium,
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
  },
  slotsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginTop: 2,
  },
  slotsTitle: {
    fontFamily: THEME.fonts.bold,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  slotsCount: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    fontVariant: ['tabular-nums'],
  },
  slotsList: {
    width: '100%',
    gap: 8,
  },
  slotItem: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...THEME.shadows.card,
  },
  slotEmptyCard: {
    borderStyle: 'dashed',
    borderColor: '#E2E8F0',
  },
  slotLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  slotAvatar: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotInitial: {
    fontFamily: THEME.fonts.bold,
    fontSize: 15,
    fontWeight: '700',
    color: '#2563EB',
  },
  slotAvatarEmpty: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  slotInitialEmpty: {
    fontFamily: THEME.fonts.bold,
    fontSize: 15,
    fontWeight: '700',
    color: '#94A3B8',
  },
  slotNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  slotUsername: {
    fontFamily: THEME.fonts.bold,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    maxWidth: 130,
  },
  hostBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#EFF6FF',
  },
  hostBadgeText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 10,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  slotRole: {
    fontFamily: THEME.fonts.regular,
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  slotWaiting: {
    fontFamily: THEME.fonts.medium,
    fontSize: 13,
    fontWeight: '500',
    color: '#94A3B8',
  },
  slotOpenTag: {
    fontFamily: THEME.fonts.medium,
    fontSize: 11,
    fontWeight: '500',
    color: '#94A3B8',
  },
  slotRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  kickBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  slotRating: {
    fontFamily: THEME.fonts.regular,
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
    fontVariant: ['tabular-nums'],
  },
  kickIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  readyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  readyOn: {
    backgroundColor: '#ECFDF5',
  },
  readyOff: {
    backgroundColor: '#F1F5F9',
  },
  readyPillText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 12,
    fontWeight: '700',
  },
  readyOnText: {
    color: '#059669',
  },
  readyOffText: {
    color: '#64748B',
  },
  lobbyCta: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
  },
  lobbyCtaReady: {
    backgroundColor: '#64748B',
  },
  lobbyCtaText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  lobbyHint: {
    fontFamily: THEME.fonts.medium,
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    textAlign: 'center',
  },
  rmCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 16,
    gap: 12,
    ...THEME.shadows.card,
  },
  rmSection: {
    gap: 6,
  },
  rmLabel: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  rmTrack: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  rmOpt: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rmOptActive: {
    backgroundColor: '#FFFFFF',
    ...THEME.shadows.card,
  },
  rmOptText: {
    fontFamily: THEME.fonts.medium,
    fontSize: 12,
    fontWeight: '500',
    color: '#475569',
    textAlign: 'center',
  },
  rmOptTextActive: {
    fontFamily: THEME.fonts.semiBold,
    color: '#2563EB',
    fontWeight: '600',
  },
  rmCta: {
    width: '100%',
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  rmCtaText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  rmJoinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rmJoinInput: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: THEME.fonts.semiBold,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    letterSpacing: 1,
  },
  rmJoinBtn: {
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rmJoinBtnText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  confirmOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  confirmTitle: {
    fontFamily: THEME.fonts.bold,
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  confirmDesc: {
    fontFamily: THEME.fonts.regular,
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    marginTop: 6,
    marginBottom: 20,
  },
  confirmActions: {
    gap: 8,
  },
  confirmDanger: {
    width: '100%',
    backgroundColor: '#DC2626',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  confirmDangerText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  confirmCancel: {
    width: '100%',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  confirmCancelText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  // Matchmaking Styling (DuoOrb card-based, square letter avatars)
  mmScroll: {
    flex: 1,
  },
  mmBody: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 12,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  mmConfigCard: {
    backgroundColor: THEME.colors.backgroundCard,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.outlineVariant,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  mmConfigRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  mmConfigDivider: {
    height: 1,
    backgroundColor: '#EEF1F6',
  },
  mmConfigLabel: {
    fontFamily: THEME.fonts.bold,
    fontSize: 10,
    letterSpacing: 1.2,
    color: THEME.colors.textMuted,
  },
  mmConfigValue: {
    fontFamily: THEME.fonts.bold,
    fontSize: 13,
    color: THEME.colors.textPrimary,
  },
  mmRankedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: THEME.radius.xs,
    backgroundColor: THEME.colors.primaryLight,
  },
  mmRankedDot: {
    width: 5,
    height: 5,
    backgroundColor: THEME.colors.primary,
  },
  mmRankedText: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 9,
    letterSpacing: 1,
    color: THEME.colors.primary,
  },
  mmMatchCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: THEME.colors.backgroundCard,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.outlineVariant,
    paddingVertical: 18,
    paddingHorizontal: 10,
  },
  mmPlayerCol: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  // Square letter avatar (you)
  mmAvatarYou: {
    width: 58,
    height: 58,
    borderRadius: THEME.radius.lg,
    backgroundColor: THEME.colors.primaryLight,
    borderWidth: 1.5,
    borderColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mmAvatarLetterYou: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 24,
    color: THEME.colors.primary,
  },
  // Square empty slot (opponent)
  mmAvatarSlot: {
    width: 58,
    height: 58,
    borderRadius: THEME.radius.lg,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: THEME.colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mmAvatarLetterOpp: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 24,
    color: THEME.colors.secondary,
  },
  mmSlotPing: {
    position: 'absolute',
    width: 58,
    height: 58,
    borderRadius: THEME.radius.lg,
    borderWidth: 1.5,
    borderColor: THEME.colors.primary,
  },
  mmSlotDash: {
    fontFamily: THEME.fonts.bold,
    fontSize: 20,
    color: THEME.colors.outlineVariant,
  },
  mmPlayerTag: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 9,
    letterSpacing: 1.2,
    color: THEME.colors.textMuted,
  },
  mmPlayerName: {
    fontFamily: THEME.fonts.bold,
    fontSize: 13,
    color: THEME.colors.textPrimary,
    textAlign: 'center',
    maxWidth: 120,
  },
  mmRatingPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.radius.xs,
    backgroundColor: '#F1F5F9',
  },
  mmRatingText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 11,
    color: THEME.colors.textSecondary,
  },
  mmVersusCol: {
    width: 58,
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
  },
  mmVersusText: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 12,
    letterSpacing: 1,
    color: THEME.colors.outline,
  },
  mmDotsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  mmDot: {
    width: 4,
    height: 4,
    backgroundColor: THEME.colors.primary,
  },
  radarActionRow: {
    width: '100%',
    alignItems: 'center',
    marginTop: 4,
  },
  cancelSearchBtn: {
    width: '100%',
    height: 46,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.backgroundCard,
    borderWidth: 1,
    borderColor: THEME.colors.outlineVariant,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  cancelSearchText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 14,
    color: THEME.colors.onSurface,
  },
  retrySearchBtn: {
    width: '100%',
    height: 46,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  retrySearchText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  // Card & Private Rooms styling
  card: {
    backgroundColor: THEME.colors.surfaceContainerLowest,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceContainer,
    padding: 16,
    gap: 14,
    ...THEME.shadows.card,
  },
  cardTitle: {
    fontFamily: THEME.fonts.bold,
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.onSurface,
  },
  cardSubtitle: {
    fontFamily: THEME.fonts.medium,
    fontSize: 12,
    color: THEME.colors.onSurfaceVariant,
    marginTop: 2,
  },
  fieldSection: {
    gap: 6,
  },
  fieldLabel: {
    fontFamily: THEME.fonts.bold,
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    letterSpacing: 0.8,
  },
  segRow: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.surfaceContainerLow,
    borderRadius: THEME.radius.md,
    padding: 3,
    gap: 4,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: THEME.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segBtnActive: {
    backgroundColor: THEME.colors.surfaceContainerLowest,
    ...THEME.shadows.card,
  },
  segBtnText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  segBtnTextActive: {
    fontFamily: THEME.fonts.bold,
    color: THEME.colors.primary,
    fontWeight: '700',
  },
  primaryActionBtn: {
    height: 48,
    backgroundColor: THEME.colors.primary,
    borderRadius: THEME.radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: THEME.colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryActionBtnText: {
    fontFamily: THEME.fonts.bold,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  readyBtnActive: {
    backgroundColor: THEME.colors.tertiary,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  joinInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  joinInput: {
    fontFamily: THEME.fonts.bold,
    flex: 1,
    height: 44,
    backgroundColor: THEME.colors.surfaceContainerLow,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: THEME.colors.onSurface,
  },
  joinBtn: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinBtnDisabled: {
    opacity: 0.45,
  },
  joinBtnText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.onSurface,
  },
  quickAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
  },
  quickAddText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 11,
    color: '#2563EB',
  },
  quickAddSub: {
    fontFamily: THEME.fonts.regular,
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 2,
    marginBottom: 6,
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: THEME.colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: THEME.colors.surfaceContainer,
    padding: 20,
    paddingBottom: 32,
    width: '100%',
    ...THEME.shadows.modal,
  },
  sheetClose: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  modalTitle: {
    fontFamily: THEME.fonts.bold,
    fontSize: 17,
    fontWeight: '700',
    color: THEME.colors.onSurface,
  },
  modalResultsScroll: { maxHeight: 260, marginTop: 4 },
  modalResultsContent: { gap: 2, paddingBottom: 4 },
  searchHint: {
    fontFamily: THEME.fonts.regular,
    fontSize: 12,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    paddingVertical: 18,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.surfaceContainerLow,
  },
  searchResultLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  searchAvatar: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: THEME.colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchAvatarText: { fontFamily: THEME.fonts.bold, fontSize: 12, fontWeight: '700', color: THEME.colors.primary },
  searchUsername: { fontFamily: THEME.fonts.semiBold, fontSize: 14, fontWeight: '600', color: THEME.colors.onSurface },
  searchHandle: { fontFamily: THEME.fonts.regular, fontSize: 11, color: THEME.colors.textMuted },
  sendRequestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.colors.boardBorder,
    backgroundColor: THEME.colors.surfaceContainerLow,
  },
  sendRequestBtnText: {
    fontFamily: THEME.fonts.semiBold,
    color: THEME.colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  errorText: {
    fontFamily: THEME.fonts.medium,
    fontSize: 12,
    color: THEME.colors.danger,
    marginTop: 2,
  },
  lobbyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leavePill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: THEME.colors.surfaceContainerLow,
  },
  leavePillText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.secondary,
  },
  roomCodeBox: {
    backgroundColor: THEME.colors.surfaceContainerLow,
    borderRadius: THEME.radius.md,
    padding: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceContainer,
  },
  roomCodeLabel: {
    fontFamily: THEME.fonts.bold,
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    letterSpacing: 1,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.colors.surfaceContainerLowest,
    borderRadius: THEME.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  roomCodeText: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.colors.onSurface,
    fontFamily: 'monospace',
    letterSpacing: 1.5,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: THEME.colors.surfaceContainerHigh,
  },
  copyBtnText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.onSurface,
  },
  slotOccupied: {
    backgroundColor: THEME.colors.primaryLight,
  },
  slotEmpty: {
    backgroundColor: THEME.colors.surfaceContainerLow,
  },
  slotTextOccupied: {
    color: THEME.colors.primary,
  },
  slotTextEmpty: {
    color: THEME.colors.textMuted,
  },
  readyTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  readyActive: {
    backgroundColor: THEME.colors.tertiaryLight,
  },
  readyWaiting: {
    backgroundColor: THEME.colors.surfaceContainerLow,
  },
  readyTagText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 10,
    fontWeight: '700',
  },
  readyTextActive: {
    color: THEME.colors.tertiary,
  },
  readyTextWaiting: {
    color: THEME.colors.textMuted,
  },
  lobbyActionRow: {
    marginTop: 6,
  },
});
