import React, { useEffect, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { OrbIcon } from '../components/OrbIcon';
import {
  BOT_ROSTER,
  botById,
  type BotPersonality,
  type GameMode,
} from '@duoorb/game-core';
import { BotAvatar } from '../components/BotAvatar';
import { SmoothStar } from '../components/SmoothStar';
import { THEME, useStyles } from '../theme';
import { BOTTOM_NAV_HEIGHT } from '../components/BottomNav';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  TIME_CONTROLS,
  TimeControl,
  NO_TIMER_CONTROL,
  formatTimeControlDisplay,
  getTimeControl,
} from '../timeControls';
import { MatchOptionsPicker } from '../components/MatchOptionsPicker';
import { resolveMode } from '../matchModes';
import { useTranslation } from '../i18n';
import {
  isSideAvailable,
  isSideChoice,
  SEAT_COLORS,
  sidesForCount,
  type SeatSide,
  type SideChoice,
} from '../lib/sideChoice';
import {
  getMatchSetupDraft,
  loadBotStars,
  saveMatchSetupDraft,
  type BotStarMap,
} from '../storage/gameStorage';
import type { PlayerCount } from './MatchSetupScreen';

const SIDE_LABEL_KEYS: Record<
  SeatSide,
  'setup.blue' | 'setup.red' | 'setup.green' | 'setup.amber'
> = {
  blue: 'setup.blue',
  red: 'setup.red',
  green: 'setup.green',
  amber: 'setup.amber',
};

export interface BotMatchConfig {
  botId: string;
  botIds?: string[];
  side: SideChoice;
  clock: TimeControl;
  mode: GameMode;
  wallsEach: number;
}

interface BotsScreenProps {
  onSelectBot?: (botId: string) => void;
  onStartGame?: (config: BotMatchConfig) => void;
  onOpenSetup?: () => void;
}

type SetupMode = 'classic' | 'center' | 'race';
type WallsChoice = 10 | 15 | 99;

export const BotsScreen: React.FC<BotsScreenProps> = ({
  onSelectBot,
  onStartGame,
}) => {
  const styles = useStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  // Load last-used picks from AI draft
  const draft = getMatchSetupDraft('ai');
  const initialMode: SetupMode =
    draft.mode === 'center' || draft.mode === 'race' ? draft.mode : 'classic';
  const initialPlayerCount: PlayerCount =
    draft.playerCount === 3 || draft.playerCount === 4 ? draft.playerCount : 2;
  const [modeSel, setModeSel] = useState<SetupMode>(initialMode);
  const [playerCount, setPlayerCount] = useState<PlayerCount>(initialPlayerCount);
  const [walls, setWalls] = useState<WallsChoice>(
    draft.wallsEach === 15 || draft.wallsEach === 99 ? draft.wallsEach : 10
  );
  const [side, setSide] = useState<SideChoice>(() => {
    const saved = isSideChoice(draft.side) ? draft.side : 'random';
    const seats = initialMode === 'classic' ? 2 : initialPlayerCount;
    return isSideAvailable(saved, seats) ? saved : 'random';
  });
  const [optionsOpen, setOptionsOpen] = useState<boolean>(false);
  const [sidePickerOpen, setSidePickerOpen] = useState<boolean>(false);

  const [clock, setClock] = useState<TimeControl>(
    draft.clockId === 'no-timer'
      ? NO_TIMER_CONTROL
      : draft.clockId
      ? getTimeControl(draft.clockId)
      : NO_TIMER_CONTROL
  );

  const effectivePlayerCount: PlayerCount = modeSel === 'classic' ? 2 : playerCount;
  const availableSides = sidesForCount(effectivePlayerCount);
  const sideOptions: SideChoice[] = [...availableSides, 'random'];
  const neededBots = Math.max(1, effectivePlayerCount - 1);
  const [selectedBotIds, setSelectedBotIds] = useState<string[]>(() => {
    const initial = draft.botId && botById(draft.botId) ? draft.botId : 'martin';
    return [initial];
  });

  // Re-sync selected bots when effectivePlayerCount / neededBots changes
  useEffect(() => {
    setSelectedBotIds((prev) => {
      const valid = prev.filter((id) => botById(id));
      if (valid.length >= neededBots) return valid.slice(0, neededBots);
      const remaining = BOT_ROSTER.filter((b) => !valid.includes(b.id));
      const toAdd = remaining.slice(0, neededBots - valid.length).map((b) => b.id);
      return [...valid, ...toAdd].slice(0, neededBots);
    });
  }, [neededBots]);

  const [botStars, setBotStars] = useState<BotStarMap>({});

  const [focusedBotId, setFocusedBotId] = useState<string>(() => {
    return draft.botId && botById(draft.botId) ? draft.botId : 'martin';
  });

  const selectedBotId = selectedBotIds[0] || 'martin';
  const displayBot: BotPersonality =
    botById(focusedBotId) ?? botById(selectedBotId) ?? BOT_ROSTER[0];
  const selectedBot: BotPersonality = displayBot;
  const currentStars = botStars[displayBot.id]?.stars ?? 0;

  const handleBotTilePress = (botId: string) => {
    setFocusedBotId(botId);

    if (neededBots === 1) {
      setSelectedBotIds([botId]);
      onSelectBot?.(botId);
      return;
    }
    if (selectedBotIds.includes(botId)) {
      if (selectedBotIds.length > 1) {
        setSelectedBotIds(selectedBotIds.filter((id) => id !== botId));
      }
    } else {
      if (selectedBotIds.length < neededBots) {
        setSelectedBotIds([...selectedBotIds, botId]);
      } else {
        setSelectedBotIds([...selectedBotIds.slice(1), botId]);
      }
    }
    onSelectBot?.(botId);
  };

  useEffect(() => {
    let live = true;
    void loadBotStars().then((stars) => {
      if (live) setBotStars(stars);
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    saveMatchSetupDraft('ai', {
      mode: modeSel,
      playerCount,
      difficulty: selectedBot.profile.difficulty,
      botId: selectedBotId,
      side,
      wallsEach: walls,
      clockId: clock.id,
    });
  }, [selectedBotId, side, clock, modeSel, playerCount, walls, selectedBot]);

  // Categorize bots by tier
  const beginnerBots = BOT_ROSTER.filter((b) => b.tier === 'beginner');
  const intermediateBots = BOT_ROSTER.filter((b) => b.tier === 'intermediate');
  const masterBots = BOT_ROSTER.filter((b) => b.tier === 'master');
  const grandmasterBots = BOT_ROSTER.filter((b) => b.tier === 'grandmaster');

  const BOT_TIERS = [
    { key: 'beginner', title: 'Beginner', bots: beginnerBots },
    { key: 'intermediate', title: 'Intermediate', bots: intermediateBots },
    { key: 'master', title: 'Master', bots: masterBots },
    { key: 'grandmaster', title: 'Grandmaster', bots: grandmasterBots },
  ];

  const modeName =
    modeSel === 'classic'
      ? 'Classic'
      : modeSel === 'center'
      ? 'Center Rush'
      : 'Race';
  const timeLabel = formatTimeControlDisplay(clock);

  const handlePlayerCountChange = (count: PlayerCount) => {
    setPlayerCount(count);
    if (!isSideAvailable(side, count)) {
      setSide('random');
    }
  };

  const handleLaunch = () => {
    const resolvedMode = resolveMode(
      modeSel === 'race' ? 'race' : modeSel === 'center' ? 'center' : 'classic',
      effectivePlayerCount
    );
    let finalBotIds = [...selectedBotIds].slice(0, neededBots);
    if (finalBotIds.length < neededBots) {
      const remaining = BOT_ROSTER.filter((b) => !finalBotIds.includes(b.id));
      const toAdd = remaining.slice(0, neededBots - finalBotIds.length).map((b) => b.id);
      finalBotIds = [...finalBotIds, ...toAdd].slice(0, neededBots);
    }
    onStartGame?.({
      botId: finalBotIds[0],
      botIds: finalBotIds,
      side: isSideAvailable(side, effectivePlayerCount) ? side : 'random',
      clock,
      mode: resolvedMode,
      wallsEach: walls,
    });
  };

  if (optionsOpen) {
    return (
      <View style={styles.screen}>
        {/* Top Header Bar */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => setOptionsOpen(false)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.backBtn}
            accessibilityLabel="Go back"
          >
            <OrbIcon name="arrow-left" size={24} color={THEME.colors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <OrbIcon
              name="sliders"
              size={18}
              color={THEME.colors.primary}
              style={{ marginRight: 8 }}
            />
            <Text style={styles.headerTitle}>Time & Options</Text>
          </View>

          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={[
            styles.optionsPageContent,
            { paddingBottom: BOTTOM_NAV_HEIGHT + 32 + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <MatchOptionsPicker
            mode={modeSel}
            onModeChange={(m) => {
              setModeSel(m);
              if (m === 'classic') {
                handlePlayerCountChange(2);
              }
            }}
            playerCount={effectivePlayerCount}
            onPlayerCountChange={handlePlayerCountChange}
            walls={walls}
            onWallsChange={setWalls}
            clock={clock}
            onClockChange={setClock}
          />

          <TouchableOpacity
            style={styles.doneBtn}
            activeOpacity={0.88}
            onPress={() => setOptionsOpen(false)}
          >
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Pinned Top Container: Header Bar + Chosen Bot Hero Showcase */}
      <View style={styles.topContainer}>
        {/* 1. Header Bar — Always visible at top */}
        <View style={styles.header}>
          <View style={styles.headerCenter}>
            <OrbIcon
              name="robot-outline"
              size={22}
              color={THEME.colors.primary}
              style={{ marginRight: 8 }}
            />
            <Text style={styles.headerTitle}>Bots</Text>
          </View>
        </View>

        {/* 2. Hero Showcase — Always the classic hero with comic speech bubble */}
        <View style={styles.heroSection}>
          <View style={styles.heroTopRow}>
            <BotAvatar avatarKey={displayBot.avatarKey} size={76} noBg />
            <View style={styles.speechBubble}>
              <View style={styles.speechTail} />
              <Text style={styles.speechText} numberOfLines={2}>
                {displayBot.quote ||
                  displayBot.dialogue?.greetings?.[0] ||
                  `Hi, I'm ${displayBot.name}! Let's play!`}
              </Text>
            </View>
          </View>

          <View style={styles.heroMetaRow}>
            <View style={styles.heroMetaLeft}>
              <Text style={styles.heroName}>{displayBot.name}</Text>
              <Text style={styles.heroElo}>{displayBot.elo}</Text>
              <Text style={styles.heroRoleBadge} numberOfLines={1}>
                {displayBot.title}
              </Text>
            </View>
            <View style={styles.heroStarsRow}>
              {[1, 2, 3].map((starIdx) => (
                <SmoothStar
                  key={starIdx}
                  size={20}
                  color={starIdx <= currentStars ? '#FBBF24' : '#D1D5DB'}
                />
              ))}
            </View>
          </View>
        </View>
      </View>

      {/* 3. Middle Area: Clean Avatar Grid */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[
          styles.gridContent,
          { paddingBottom: BOTTOM_NAV_HEIGHT + 130 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {BOT_TIERS.map(({ key, title, bots }) => (
          <View key={key} style={styles.tierSection}>
            <Text style={styles.categoryTitle}>
              {title} <Text style={styles.categoryCount}>{bots.length}</Text>
            </Text>
            <View style={styles.avatarGrid}>
              {bots.map((bot) => {
                const isSelected = neededBots === 1
                  ? (selectedBotIds[0] ?? selectedBotId) === bot.id
                  : selectedBotIds.includes(bot.id);
                const selIndex = selectedBotIds.indexOf(bot.id);
                const stars = botStars[bot.id]?.stars ?? 0;
                return (
                  <TouchableOpacity
                    key={bot.id}
                    style={styles.avatarTile}
                    activeOpacity={0.8}
                    onPress={() => handleBotTilePress(bot.id)}
                  >
                    <BotAvatar
                      avatarKey={bot.avatarKey}
                      size={58}
                      selected={isSelected}
                    />
                    {neededBots > 1 && isSelected && (
                      <View style={styles.gridSlotBadge} pointerEvents="none">
                        <Text style={styles.gridSlotBadgeText}>
                          {selIndex + 2}/{effectivePlayerCount}
                        </Text>
                      </View>
                    )}
                    {stars > 0 && (
                      <View style={styles.avatarStarsRow} pointerEvents="none">
                        {[1, 2, 3].map((starIdx) => (
                          <SmoothStar
                            key={starIdx}
                            size={16}
                            color={starIdx <= stars ? '#FBBF24' : '#D1D5DB'}
                          />
                        ))}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* 4. Bottom Sticky Dock: Control Strip + Unified Play Button */}
      <View style={[styles.bottomDock, { bottom: BOTTOM_NAV_HEIGHT + insets.bottom }]}>
        <View style={styles.controlStrip}>
          <TouchableOpacity
            style={styles.optionsBtn}
            activeOpacity={0.8}
            onPress={() => setOptionsOpen(true)}
            accessibilityLabel="Open options"
          >
            <View style={styles.optionsBtnContent}>
              <OrbIcon
                name="sliders"
                size={15}
                color={THEME.colors.textPrimary}
              />
              <Text
                style={styles.optionsBtnText}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                ellipsizeMode="tail"
              >
                {timeLabel} · {modeName}
              </Text>
            </View>
            <OrbIcon
              name="chevron-right"
              size={16}
              color={THEME.colors.textMuted}
              style={styles.optionsChevron}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sideChip}
            activeOpacity={0.8}
            onPress={() => setSidePickerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`${t('setup.yourSide')}: ${
              side === 'random' ? t('setup.random') : t(SIDE_LABEL_KEYS[side])
            }`}
            accessibilityHint="Opens the side picker"
          >
            {side === 'random' ? (
              <View style={styles.sideRandomChipOrb}>
                <OrbIcon
                  name="shuffle"
                  size={11}
                  color={THEME.colors.textPrimary}
                />
              </View>
            ) : (
              <View
                style={[styles.sideOrb, { backgroundColor: SEAT_COLORS[side] }]}
              />
            )}
            <OrbIcon
              name="chevron-down"
              size={13}
              color={THEME.colors.textMuted}
            />
          </TouchableOpacity>
        </View>

        {/* 3D Green Play Button */}
        <TouchableOpacity
          style={styles.stickyPlayButton}
          activeOpacity={0.88}
          onPress={handleLaunch}
        >
          <Text style={styles.stickyPlayButtonText}>Play</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={sidePickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSidePickerOpen(false)}
      >
        <View style={styles.sideSheetBackdrop}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setSidePickerOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Close side picker"
          />
          <View
            style={[
              styles.sideSheet,
              { paddingBottom: 18 + insets.bottom },
            ]}
          >
            <View style={styles.sideSheetHandle} />
            <View style={styles.sideSheetHeader}>
              <Text style={styles.sideSheetTitle}>{t('setup.yourSide')}</Text>
              <TouchableOpacity
                style={styles.sideSheetClose}
                activeOpacity={0.75}
                onPress={() => setSidePickerOpen(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Close side picker"
              >
                <OrbIcon name="x" size={18} color={THEME.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.sideSheetRow}>
              {sideOptions.map((option) => {
                const selected = side === option;
                const label =
                  option === 'random'
                    ? t('setup.random')
                    : t(SIDE_LABEL_KEYS[option]);
                return (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.sideOption,
                      selected && styles.sideOptionSelected,
                    ]}
                    activeOpacity={0.8}
                    onPress={() => {
                      setSide(option);
                      setSidePickerOpen(false);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={label}
                  >
                    {option === 'random' ? (
                      <View
                        style={[styles.sideOptionOrb, styles.sideOptionRandom]}
                      >
                        <OrbIcon
                          name="shuffle"
                          size={12}
                          color={THEME.colors.textPrimary}
                        />
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.sideOptionOrb,
                          { backgroundColor: SEAT_COLORS[option] },
                        ]}
                      />
                    )}
                    <Text
                      style={[
                        styles.sideOptionLabel,
                        selected && styles.sideOptionLabelSelected,
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.7}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const createStyles = () =>
  StyleSheet.create({
    screen: {
      flex: 1,
      position: 'relative',
      backgroundColor: THEME.colors.background,
    },
    header: {
      height: 48,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: THEME.colors.background,
      zIndex: 10,
    },
    backBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerCenter: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerTitle: {
      fontFamily: THEME.fonts.extraBold,
      fontSize: 19,
      fontWeight: '800',
      color: THEME.colors.textPrimary,
      letterSpacing: -0.2,
    },
    // Selected Bot Hero Showcase (Pinned at top, cutout avatar with NO background)
    heroSection: {
      paddingHorizontal: 16,
      paddingTop: 6,
      paddingBottom: 10,
      maxWidth: 480,
      width: '100%',
      alignSelf: 'center',
      gap: 10,
    },
    heroTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    gridSlotBadge: {
      position: 'absolute',
      top: -4,
      right: -4,
      backgroundColor: THEME.colors.primary,
      borderRadius: 8,
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderWidth: 1.5,
      borderColor: '#FFFFFF',
      zIndex: 15,
    },
    gridSlotBadgeText: {
      fontFamily: THEME.fonts.extraBold,
      fontSize: 10,
      color: '#FFFFFF',
      fontWeight: '800',
    },
    // Comic speech bubble - Pure white with pointer tail
    speechBubble: {
      flex: 1,
      backgroundColor: '#FFFFFF',
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: '#E2E0D8',
      position: 'relative',
      minHeight: 48,
      justifyContent: 'center',
    },
    speechTail: {
      position: 'absolute',
      left: -6,
      top: 18,
      width: 10,
      height: 10,
      backgroundColor: '#FFFFFF',
      borderLeftWidth: 1,
      borderBottomWidth: 1,
      borderColor: '#E2E0D8',
      transform: [{ rotate: '45deg' }],
    },
    speechText: {
      fontFamily: THEME.fonts.bold,
      fontSize: 13.5,
      fontWeight: '700',
      color: '#262421',
      lineHeight: 18,
    },
    heroMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
    },
    heroMetaLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
    },
    heroName: {
      fontFamily: THEME.fonts.extraBold,
      fontSize: 19,
      fontWeight: '800',
      color: THEME.colors.textPrimary,
    },
    heroElo: {
      fontFamily: THEME.fonts.bold,
      fontSize: 14,
      fontWeight: '700',
      color: THEME.colors.textMuted,
    },
    heroRoleBadge: {
      fontFamily: THEME.fonts.medium,
      fontSize: 12,
      color: THEME.colors.textSecondary,
      flexShrink: 1,
    },
    heroStarsRow: {
      flexDirection: 'row',
      gap: 3,
    },
    starGlyph: {
      fontSize: 17,
      color: THEME.colors.secondaryBevel,
    },
    starGlyphEarned: {
      color: '#F59E0B',
    },
    // Middle Bot Grid — Clean square avatars, NO CARDS!
    scrollArea: {
      flex: 1,
    },
    gridContent: {
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: BOTTOM_NAV_HEIGHT + 130, // Space for bottom dock
      maxWidth: 480,
      width: '100%',
      alignSelf: 'center',
      gap: 12,
    },
    categoryTitle: {
      fontFamily: THEME.fonts.extraBold,
      fontSize: 15,
      fontWeight: '800',
      color: THEME.colors.textPrimary,
      marginTop: 8,
    },
    categoryCount: {
      fontFamily: THEME.fonts.medium,
      fontSize: 13,
      color: THEME.colors.textMuted,
    },
    avatarGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 4,
    },
    topContainer: {
      backgroundColor: THEME.colors.background,
      zIndex: 10,
    },
    // Framed tile
    avatarTile: {
      borderRadius: 10,
      position: 'relative',
    },
    avatarStarsRow: {
      position: 'absolute',
      bottom: -5,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 2,
      zIndex: 10,
    },
    // Bottom Sticky Dock — ATTACHED AT THE BOTTOM directly above BottomNav!
    // Bottom Sticky Dock — ATTACHED AT THE BOTTOM directly above BottomNav!
    bottomDock: {
      position: 'absolute',
      left: 0,
      right: 0,
      marginHorizontal: 'auto',
      bottom: BOTTOM_NAV_HEIGHT,
      backgroundColor: THEME.colors.background,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 4,
      borderTopWidth: 0,
      borderBottomWidth: 0,
      zIndex: 40,
      gap: 8,
      maxWidth: 480,
      width: '100%',
      alignSelf: 'center',
    },
    controlStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    optionsBtn: {
      flex: 1,
      height: 42,
      backgroundColor: THEME.colors.surfaceMuted,
      borderRadius: 8,
      borderWidth: 2.5,
      borderColor: 'transparent',
      borderBottomWidth: 3,
      borderBottomColor: THEME.colors.secondaryBevel,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 10,
    },
    optionsBtnContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flex: 1,
      minWidth: 0,
      overflow: 'hidden',
    },
    optionsBtnText: {
      fontFamily: THEME.fonts.extraBold,
      fontSize: 12.5,
      fontWeight: '800',
      color: THEME.colors.textPrimary,
      flexShrink: 1,
      minWidth: 0,
    },
    optionsChevron: {
      marginLeft: 4,
      flexShrink: 0,
    },
    sideChip: {
      width: 64,
      height: 42,
      backgroundColor: THEME.colors.surfaceMuted,
      borderRadius: 8,
      borderWidth: 2.5,
      borderColor: 'transparent',
      borderBottomWidth: 3,
      borderBottomColor: THEME.colors.secondaryBevel,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
    },
    sideOrb: {
      width: 18,
      height: 18,
      borderRadius: 9,
    },
    sideRandomChipOrb: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: THEME.colors.backgroundCard,
      borderWidth: 1.5,
      borderColor: THEME.colors.outlineVariant,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sideSheetBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(15, 23, 42, 0.55)',
      justifyContent: 'flex-end',
    },
    sideSheet: {
      backgroundColor: THEME.colors.backgroundCard,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      paddingHorizontal: 16,
      paddingTop: 10,
      maxWidth: 480,
      width: '100%',
      alignSelf: 'center',
      shadowColor: '#000000',
      shadowOpacity: 0.18,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: -4 },
      elevation: 24,
    },
    sideSheetHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: THEME.colors.outlineVariant,
      alignSelf: 'center',
      marginBottom: 12,
    },
    sideSheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    sideSheetTitle: {
      fontFamily: THEME.fonts.extraBold,
      fontSize: 17,
      fontWeight: '800',
      color: THEME.colors.textPrimary,
    },
    sideSheetClose: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sideSheetRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
    },
    sideOption: {
      flex: 1,
      maxWidth: 64,
      minWidth: 44,
      height: 68,
      backgroundColor: THEME.colors.surfaceMuted,
      borderRadius: 10,
      borderWidth: 2.5,
      borderColor: 'transparent',
      borderBottomWidth: 3,
      borderBottomColor: THEME.colors.secondaryBevel,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      paddingHorizontal: 2,
    },
    sideOptionSelected: {
      borderColor: THEME.colors.primary,
      borderBottomWidth: 3,
      borderBottomColor: THEME.colors.primaryBevel,
    },
    sideOptionOrb: {
      width: 20,
      height: 20,
      borderRadius: 10,
    },
    sideOptionRandom: {
      backgroundColor: THEME.colors.backgroundCard,
      borderWidth: 1.5,
      borderColor: THEME.colors.outlineVariant,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sideOptionLabel: {
      fontFamily: THEME.fonts.bold,
      fontSize: 11.5,
      fontWeight: '700',
      color: THEME.colors.textSecondary,
      textAlign: 'center',
      maxWidth: '100%',
    },
    sideOptionLabelSelected: {
      color: THEME.colors.textPrimary,
    },
    // Exact same 3D tactile Play button styling & metrics as HomeScreen.tsx!
    stickyPlayButton: {
      width: '100%',
      maxWidth: 480,
      alignSelf: 'center',
      height: 52,
      backgroundColor: THEME.colors.primary,
      borderRadius: 10,
      borderBottomWidth: 4,
      borderBottomColor: THEME.colors.primaryBevel,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stickyPlayButtonText: {
      fontFamily: THEME.fonts.extraBold,
      fontSize: 19,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: 0.3,
    },
    tierSection: {
      gap: 4,
    },
    // Time & Options Full-Page Layout (identical to MatchSetupScreen)
    optionsPageContent: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: BOTTOM_NAV_HEIGHT + 32,
      maxWidth: 440,
      width: '100%',
      alignSelf: 'center',
      gap: 16,
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
