import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  AIDifficulty,
  GameMode,
  botById,
  botLadder,
} from '@duoorb/game-core';
import { BotAvatar } from '../components/BotAvatar';
import { THEME, useStyles } from '../theme';
import { useTranslation } from '../i18n';
import { runWhenOnline } from '../components/NoConnection';
import {
  TIME_CONTROLS,
  TimeControl,
  NO_TIMER_CONTROL,
  getTimeControl,
  formatTimeControlDisplay,
} from '../timeControls';
import { MatchOptionsPicker, OptionTile } from '../components/MatchOptionsPicker';
import { resolveMode } from '../matchModes';
import {
  getMatchSetupDraft,
  saveMatchSetupDraft,
} from '../storage/gameStorage';

export type SideChoice = 'blue' | 'red' | 'random';
export type PlayerCount = 2 | 3 | 4;
type SetupMode = 'classic' | 'center' | 'race';
type WallsChoice = 10 | 15 | 99;

export interface MatchSetupPageSelection {
  mode: GameMode;
  vsType: 'ai' | 'local' | 'challenge' | 'online';
  clock: TimeControl;
  difficulty: AIDifficulty;
  botId: string | null;
  side: SideChoice;
  playerCount: PlayerCount;
  wallsEach: number;
}

interface MatchSetupScreenProps {
  initialKind: 'ai' | 'local' | 'challenge' | 'online';
  challengeName?: string;
  initialClock?: TimeControl;
  initialDifficulty?: AIDifficulty;
  incrementEnabled?: boolean;
  onLockedBot?: () => void;
  onOpenRooms?: () => void;
  onSelectBotsTab?: () => void;
  onConfirm: (selection: MatchSetupPageSelection) => void;
  onBack: () => void;
}

export const MatchSetupScreen: React.FC<MatchSetupScreenProps> = ({
  initialKind,
  challengeName,
  initialClock,
  initialDifficulty = 'normal',
  onLockedBot,
  onOpenRooms,
  onSelectBotsTab,
  onConfirm,
  onBack,
}) => {
  const styles = useStyles(createStyles);
  const { t } = useTranslation();

  const [vsType, setVsType] = useState<'ai' | 'local' | 'challenge' | 'online'>(
    initialKind === 'ai' ? 'online' : initialKind
  );
  const [optionsOpen, setOptionsOpen] = useState<boolean>(false);

  // Load last-used picks from draft
  const draft = getMatchSetupDraft(vsType);
  const [modeSel, setModeSel] = useState<SetupMode>(
    draft.mode === 'center' || draft.mode === 'race' ? draft.mode : 'classic'
  );
  const [difficulty, setDifficulty] = useState<AIDifficulty>(
    initialDifficulty !== 'normal'
      ? initialDifficulty
      : draft.difficulty === 'easy' || draft.difficulty === 'hard'
      ? draft.difficulty
      : 'normal'
  );
  const [botId, setBotId] = useState<string | null>(
    draft.botId && botById(draft.botId) ? draft.botId : null
  );

  const [side, setSide] = useState<SideChoice>(
    draft.side === 'red' || draft.side === 'random' ? draft.side : 'blue'
  );
  const [playerCount, setPlayerCount] = useState<PlayerCount>(
    draft.playerCount === 3 || draft.playerCount === 4 ? draft.playerCount : 2
  );
  const [clock, setClock] = useState<TimeControl>(
    initialClock ??
      (draft.clockId === 'no-timer'
        ? NO_TIMER_CONTROL
        : getTimeControl(draft.clockId))
  );
  const [walls, setWalls] = useState<WallsChoice>(
    draft.wallsEach === 15 || draft.wallsEach === 99 ? draft.wallsEach : 10
  );

  const selectedBot = botId ? botById(botId) : null;
  const botRoster = botLadder();

  useEffect(() => {
    saveMatchSetupDraft(vsType, {
      mode: modeSel,
      playerCount,
      difficulty,
      botId,
      side,
      wallsEach: walls,
      clockId: clock.id,
    });
  }, [vsType, modeSel, playerCount, difficulty, botId, side, walls, clock]);

  const resolvedMode: GameMode = resolveMode(
    modeSel === 'race' ? 'race' : modeSel === 'center' ? 'center' : 'classic',
    playerCount
  );

  const handleLaunchGame = () => {
    const confirm = () =>
      onConfirm({
        mode: resolvedMode,
        vsType,
        clock,
        difficulty,
        botId,
        side,
        playerCount,
        wallsEach: walls,
      });

    if (vsType === 'online') runWhenOnline(confirm);
    else confirm();
  };

  // Human readable labels
  const modeName =
    modeSel === 'classic'
      ? 'Classic'
      : modeSel === 'center'
      ? 'Center Rush'
      : 'Race';

  const wallsLabel = walls === 99 ? '∞ Walls' : `${walls} Walls`;
  const timeLabel = formatTimeControlDisplay(clock);

  const summaryText = `${timeLabel} · ${modeName} (${wallsLabel})`;


  // Header Title
  const getHeaderTitle = () => {
    if (optionsOpen) return 'Time & Options';
    if (vsType === 'challenge') return `Challenge ${challengeName ?? ''}`;
    if (vsType === 'local') return 'Pass & Play';
    return 'New Game';
  };

  return (
    <View style={styles.screen}>
      {/* Top Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (optionsOpen) {
              setOptionsOpen(false);
            } else {
              onBack();
            }
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.backBtn}
          accessibilityLabel="Go back"
        >
          <Feather name="arrow-left" size={24} color={THEME.colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          {!optionsOpen && (
            vsType === 'challenge' ? (
              <Feather
                name="shield"
                size={20}
                color={THEME.colors.primary}
                style={styles.headerIcon}
              />
            ) : vsType === 'local' ? (
              <Feather
                name="smartphone"
                size={20}
                color={THEME.colors.primary}
                style={styles.headerIcon}
              />
            ) : vsType === 'ai' ? (
              <MaterialCommunityIcons
                name="robot-outline"
                size={22}
                color={THEME.colors.primary}
                style={styles.headerIcon}
              />
            ) : (
              <MaterialCommunityIcons
                name="chess-pawn"
                size={22}
                color={THEME.colors.primary}
                style={styles.headerIcon}
              />
            )
          )}
          <Text style={styles.headerTitle} numberOfLines={1}>
            {getHeaderTitle()}
          </Text>
        </View>

        <View style={{ width: 40 }} />
      </View>

      {/* View A: New Game Hub (matching newgameafter clcik on play button.jpeg) */}
      {!optionsOpen ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.hubContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 1. Time & Match Options Selector Button */}
          <TouchableOpacity
            style={styles.selectorButton}
            activeOpacity={0.8}
            onPress={() => setOptionsOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`Match options: ${summaryText}`}
          >
            <View style={styles.selectorLeft}>
              <Feather
                name="clock"
                size={20}
                color={THEME.colors.primary}
              />
              <Text style={styles.selectorSummaryText}>{summaryText}</Text>
            </View>
            <Feather name="chevron-down" size={20} color={THEME.colors.textMuted} />
          </TouchableOpacity>

          {/* 2. Primary 3D Green CTA: Start Game */}
          <TouchableOpacity
            style={styles.primaryCta}
            activeOpacity={0.85}
            onPress={handleLaunchGame}
          >
            <Text style={styles.primaryCtaText}>
              {vsType === 'challenge'
                ? 'Send Challenge'
                : vsType === 'online'
                ? 'Start Game'
                : vsType === 'local'
                ? 'Start Match'
                : 'Play'}
            </Text>
          </TouchableOpacity>

          {/* 3. Secondary Navigation Stack (When in Online / New Game Hub) */}
          {vsType === 'online' && (
            <View style={styles.secondaryStack}>
              {/* Play a Friend Button - Centered icon + text matching Chess.com */}
              <TouchableOpacity
                style={styles.secondaryRowBtn}
                activeOpacity={0.8}
                onPress={() => onOpenRooms?.()}
              >
                <Feather name="users" size={20} color="#3B82F6" />
                <Text style={styles.secRowText}>Play a Friend</Text>
              </TouchableOpacity>

              {/* Play Bots Button - Centered icon + text matching Chess.com */}
              <TouchableOpacity
                style={styles.secondaryRowBtn}
                activeOpacity={0.8}
                onPress={() => onSelectBotsTab?.()}
              >
                <MaterialCommunityIcons
                  name="robot-outline"
                  size={20}
                  color={THEME.colors.primary}
                />
                <Text style={styles.secRowText}>Play Bots</Text>
              </TouchableOpacity>

              {/* Pass & Play Button - Centered icon + text matching Chess.com */}
              <TouchableOpacity
                style={styles.secondaryRowBtn}
                activeOpacity={0.8}
                onPress={() => setVsType('local')}
              >
                <Feather name="smartphone" size={20} color="#D97706" />
                <Text style={styles.secRowText}>Pass & Play</Text>
              </TouchableOpacity>

              {/* Centered Expand Chevron Button matching row 7 in Chess.com screenshot */}
              <TouchableOpacity
                style={styles.chevronExpandBtn}
                activeOpacity={0.8}
                onPress={() => setOptionsOpen(true)}
                accessibilityLabel="More match options"
              >
                <Feather name="chevron-down" size={22} color={THEME.colors.textMuted} />
              </TouchableOpacity>
            </View>
          )}

          {/* If In Local Pass & Play */}
          {vsType === 'local' && (
            <View style={styles.secondaryStack}>
              {/* Quick Player Count Picker */}
              <View style={styles.quickPlayerSection}>
                <Text style={styles.quickPlayerLabel}>Players on this device</Text>
                <View style={styles.threeColGrid}>
                  {([2, 3, 4] as const).map((cnt) => {
                    const isSelected = playerCount === cnt;
                    return (
                      <TouchableOpacity
                        key={cnt}
                        style={[
                          styles.timeTile,
                          isSelected && styles.timeTileSelected,
                        ]}
                        activeOpacity={0.75}
                        onPress={() => setPlayerCount(cnt)}
                      >
                        <Text
                          style={[
                            styles.timeTileText,
                            isSelected && styles.timeTileTextSelected,
                          ]}
                        >
                          {cnt} Players
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <TouchableOpacity
                style={styles.secondaryRowBtn}
                activeOpacity={0.8}
                onPress={() => setVsType('online')}
              >
                <Feather name="globe" size={20} color={THEME.colors.primary} />
                <Text style={styles.secRowText}>Switch to Online Match</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryRowBtn}
                activeOpacity={0.8}
                onPress={() => onSelectBotsTab?.()}
              >
                <MaterialCommunityIcons
                  name="robot-outline"
                  size={20}
                  color={THEME.colors.primary}
                />
                <Text style={styles.secRowText}>Play Bots</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* If In Challenge Mode */}
          {vsType === 'challenge' && challengeName && (
            <View style={styles.challengeBox}>
              <View style={styles.challengeAvatar}>
                <Feather name="user" size={24} color={THEME.colors.primary} />
              </View>
              <Text style={styles.challengePrompt}>
                Live 1v1 challenge ready for <Text style={styles.challengeTargetName}>{challengeName}</Text>
              </Text>
            </View>
          )}

        </ScrollView>
      ) : (
        /* View B: Time & Match Options (exact same settings & UI as BotsScreen) */
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.optionsContent}
          showsVerticalScrollIndicator={false}
        >
          <MatchOptionsPicker
            mode={modeSel}
            onModeChange={setModeSel}
            playerCount={playerCount}
            onPlayerCountChange={setPlayerCount}
            walls={walls}
            onWallsChange={setWalls}
            clock={clock}
            onClockChange={setClock}
          />

          {/* Done / Apply Button */}
          <TouchableOpacity
            style={styles.doneBtn}
            activeOpacity={0.88}
            onPress={() => setOptionsOpen(false)}
          >
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
};

const createStyles = () =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: THEME.colors.background,
    },
    header: {
      height: 52,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: THEME.colors.background,
      borderBottomWidth: 0,
      zIndex: 10,
    },
    backBtn: {
      width: 40,
      height: 40,
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
    headerCenter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerIcon: {
      marginRight: 8,
    },
    headerTitle: {
      fontFamily: THEME.fonts.extraBold,
      fontSize: 19,
      fontWeight: '800',
      color: THEME.colors.textPrimary,
      letterSpacing: -0.2,
    },
    scroll: {
      flex: 1,
    },
    // New Game Hub Layout (matching newgameafter clcik on play button.jpeg)
    hubContent: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 40,
      maxWidth: 440,
      width: '100%',
      alignSelf: 'center',
      gap: 12,
    },
    selectorButton: {
      height: 54,
      backgroundColor: THEME.colors.surfaceMuted,
      borderRadius: 10,
      borderBottomWidth: 3,
      borderBottomColor: THEME.colors.secondaryBevel,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
    },
    selectorLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    selectorSummaryText: {
      fontFamily: THEME.fonts.bold,
      fontSize: 15,
      fontWeight: '700',
      color: THEME.colors.textPrimary,
    },
    primaryCta: {
      height: 54,
      backgroundColor: THEME.colors.primary,
      borderRadius: 10,
      borderBottomWidth: 4,
      borderBottomColor: THEME.colors.primaryBevel,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryCtaText: {
      fontFamily: THEME.fonts.extraBold,
      fontSize: 19,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: 0.3,
    },
    secondaryStack: {
      gap: 10,
      marginTop: 4,
    },
    // Centered layout matching Chess.com newgameafter clcik on play button.jpeg
    secondaryRowBtn: {
      height: 52,
      backgroundColor: THEME.colors.surfaceMuted,
      borderRadius: 10,
      borderBottomWidth: 3,
      borderBottomColor: THEME.colors.secondaryBevel,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingHorizontal: 16,
    },
    secRowText: {
      fontFamily: THEME.fonts.bold,
      fontSize: 16,
      fontWeight: '700',
      color: THEME.colors.textPrimary,
    },
    chevronExpandBtn: {
      height: 44,
      backgroundColor: THEME.colors.surfaceMuted,
      borderRadius: 10,
      borderBottomWidth: 3,
      borderBottomColor: THEME.colors.secondaryBevel,
      alignItems: 'center',
      justifyContent: 'center',
    },
    quickPlayerSection: {
      gap: 6,
      marginBottom: 4,
    },
    quickPlayerLabel: {
      fontFamily: THEME.fonts.bold,
      fontSize: 13,
      fontWeight: '700',
      color: THEME.colors.textSecondary,
      marginLeft: 2,
    },
    challengeBox: {
      alignItems: 'center',
      gap: 10,
      paddingVertical: 16,
    },
    challengeAvatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: THEME.colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: THEME.colors.primary,
    },
    challengePrompt: {
      fontFamily: THEME.fonts.medium,
      fontSize: 14,
      color: THEME.colors.textSecondary,
      textAlign: 'center',
    },
    challengeTargetName: {
      fontFamily: THEME.fonts.extraBold,
      color: THEME.colors.textPrimary,
      fontWeight: '800',
    },
    // Options view layout (matching chosing time.jpeg)
    optionsContent: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 40,
      maxWidth: 440,
      width: '100%',
      alignSelf: 'center',
      gap: 16,
    },
    optionsSection: {
      gap: 8,
    },
    categoryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 4,
      marginBottom: 2,
    },
    categoryTitle: {
      fontFamily: THEME.fonts.extraBold,
      fontSize: 15.5,
      fontWeight: '800',
      color: THEME.colors.textPrimary,
      letterSpacing: -0.2,
    },
    threeColGrid: {
      flexDirection: 'row',
      gap: 8,
    },
    timeTile: {
      flex: 1,
      height: 48,
      backgroundColor: THEME.colors.surfaceMuted,
      borderRadius: 8,
      borderBottomWidth: 3,
      borderBottomColor: THEME.colors.secondaryBevel,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    // Selected tile matching Chess.com chosing time.jpeg
    timeTileSelected: {
      borderColor: THEME.colors.primary,
      borderWidth: 2.5,
      borderBottomWidth: 3,
      borderBottomColor: THEME.colors.primaryBevel,
      backgroundColor: THEME.colors.surfaceMuted,
    },
    timeTileText: {
      fontFamily: THEME.fonts.bold,
      fontSize: 14.5,
      fontWeight: '700',
      color: THEME.colors.textPrimary,
      textAlign: 'center',
    },
    timeTileTextSelected: {
      color: THEME.colors.textPrimary,
      fontWeight: '800',
    },
    untimedRow: {
      marginTop: 6,
    },
    noTimerBtn: {
      width: '100%',
      height: 48,
      backgroundColor: THEME.colors.surfaceMuted,
      borderRadius: 8,
      borderBottomWidth: 3,
      borderBottomColor: THEME.colors.secondaryBevel,
      alignItems: 'center',
      justifyContent: 'center',
    },
    doneBtn: {
      height: 52,
      backgroundColor: THEME.colors.primary,
      borderRadius: 10,
      borderBottomWidth: 4,
      borderBottomColor: THEME.colors.primaryBevel,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 12,
      marginBottom: 32,
    },
    doneBtnText: {
      fontFamily: THEME.fonts.extraBold,
      fontSize: 18,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: 0.3,
    },
  });
