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
import {
  getMatchSetupDraft,
  loadBotStars,
  saveMatchSetupDraft,
  type BotStarMap,
} from '../storage/gameStorage';
import type { SideChoice, PlayerCount } from './MatchSetupScreen';

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

  // Load last-used picks from AI draft
  const draft = getMatchSetupDraft('ai');
  const [modeSel, setModeSel] = useState<SetupMode>(
    draft.mode === 'center' || draft.mode === 'race' ? draft.mode : 'classic'
  );
  const [playerCount, setPlayerCount] = useState<PlayerCount>(
    draft.playerCount === 3 || draft.playerCount === 4 ? draft.playerCount : 2
  );
  const [walls, setWalls] = useState<WallsChoice>(
    draft.wallsEach === 15 || draft.wallsEach === 99 ? draft.wallsEach : 10
  );
  const [side, setSide] = useState<SideChoice>(
    draft.side === 'red' || draft.side === 'random' ? draft.side : 'random'
  );
  const [optionsOpen, setOptionsOpen] = useState<boolean>(false);

  const [clock, setClock] = useState<TimeControl>(
    draft.clockId === 'no-timer'
      ? NO_TIMER_CONTROL
      : draft.clockId
      ? getTimeControl(draft.clockId)
      : NO_TIMER_CONTROL
  );

  const neededBots = Math.max(1, playerCount - 1);
  const [selectedBotIds, setSelectedBotIds] = useState<string[]>(() => {
    const initial = draft.botId && botById(draft.botId) ? draft.botId : 'martin';
    return [initial];
  });

  // Re-sync selected bots when playerCount changes
  useEffect(() => {
    setSelectedBotIds((prev) => {
      const valid = prev.filter((id) => botById(id));
      if (valid.length >= neededBots) return valid.slice(0, neededBots);
      const remaining = BOT_ROSTER.filter((b) => !valid.includes(b.id));
      const toAdd = remaining.slice(0, neededBots - valid.length).map((b) => b.id);
      return [...valid, ...toAdd];
    });
  }, [neededBots]);

  const [botStars, setBotStars] = useState<BotStarMap>({});

  const selectedBotId = selectedBotIds[0] || 'martin';
  const selectedBot: BotPersonality =
    botById(selectedBotId) ?? BOT_ROSTER[0];
  const selectedBots: BotPersonality[] = selectedBotIds
    .map((id) => botById(id))
    .filter(Boolean) as BotPersonality[];

  const handleBotTilePress = (botId: string) => {
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
        setSelectedBotIds([...selectedBotIds.slice(0, neededBots - 1), botId]);
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

  const BOT_TIERS = [
    { key: 'beginner', title: 'Beginner', bots: beginnerBots },
    { key: 'intermediate', title: 'Intermediate', bots: intermediateBots },
    { key: 'master', title: 'Master', bots: masterBots },
  ];

  // Total stars
  const totalStars = Object.values(botStars).reduce((sum, rec) => sum + (rec?.stars || 0), 0);
  const maxPossibleStars = BOT_ROSTER.length * 3;

  const modeName =
    modeSel === 'classic'
      ? 'Classic'
      : modeSel === 'center'
      ? 'Center Rush'
      : 'Race';
  const timeLabel = formatTimeControlDisplay(clock);

  const handleLaunch = () => {
    const resolvedMode = resolveMode(
      modeSel === 'race' ? 'race' : modeSel === 'center' ? 'center' : 'classic',
      playerCount
    );
    let finalBotIds = [...selectedBotIds];
    if (finalBotIds.length < neededBots) {
      const remaining = BOT_ROSTER.filter((b) => !finalBotIds.includes(b.id));
      const toAdd = remaining.slice(0, neededBots - finalBotIds.length).map((b) => b.id);
      finalBotIds = [...finalBotIds, ...toAdd];
    }
    onStartGame?.({
      botId: finalBotIds[0],
      botIds: finalBotIds,
      side,
      clock,
      mode: resolvedMode,
      wallsEach: walls,
    });
  };

  const currentStars = botStars[selectedBot.id]?.stars ?? 0;

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
            <Feather name="arrow-left" size={24} color={THEME.colors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Feather
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
            onModeChange={setModeSel}
            playerCount={playerCount}
            onPlayerCountChange={setPlayerCount}
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
            <MaterialCommunityIcons
              name="robot-outline"
              size={22}
              color={THEME.colors.primary}
              style={{ marginRight: 8 }}
            />
            <Text style={styles.headerTitle}>Bots</Text>
          </View>
          <View style={styles.masteryPill}>
            <SmoothStar
              size={14}
              color="#F59E0B"
              style={{ marginRight: 4 }}
            />
            <Text style={styles.masteryPillText}>
              {totalStars} / {maxPossibleStars}
            </Text>
          </View>
        </View>

        {/* 2. Hero Showcase */}
        {neededBots === 1 ? (
          <View style={styles.heroSection}>
            <View style={styles.heroTopRow}>
              <BotAvatar avatarKey={selectedBot.avatarKey} size={76} noBg />
              <View style={styles.speechBubble}>
                <View style={styles.speechTail} />
                <Text style={styles.speechText} numberOfLines={2}>
                  {selectedBot.quote ||
                    selectedBot.dialogue?.greetings?.[0] ||
                    `Hi, I'm ${selectedBot.name}! Let's play!`}
                </Text>
              </View>
            </View>

            <View style={styles.heroMetaRow}>
              <View style={styles.heroMetaLeft}>
                <Text style={styles.heroName}>{selectedBot.name}</Text>
                <Text style={styles.heroElo}>{selectedBot.elo}</Text>
                <Text style={styles.heroRoleBadge} numberOfLines={1}>
                  {selectedBot.title}
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
        ) : (
          <View style={styles.multiHeroSection}>
            <Text style={styles.multiHeroSubtitle}>
              {playerCount}-Player Match · Select {neededBots} Opponents ({selectedBotIds.length}/{neededBots})
            </Text>
            <View style={styles.multiHeroRow}>
              {Array.from({ length: neededBots }).map((_, idx) => {
                const botId = selectedBotIds[idx];
                const bot = botId ? botById(botId) : null;
                const slotNum = idx + 2;
                return (
                  <View
                    key={idx}
                    style={[
                      styles.multiHeroSlot,
                      bot ? styles.multiHeroSlotFilled : undefined,
                    ]}
                  >
                    <View style={styles.multiHeroBadge}>
                      <Text style={styles.multiHeroBadgeText}>
                        {slotNum}/{playerCount}
                      </Text>
                    </View>
                    {bot ? (
                      <>
                        <BotAvatar avatarKey={bot.avatarKey} size={46} noBg />
                        <Text style={styles.multiHeroBotName} numberOfLines={1}>
                          {bot.name}
                        </Text>
                        <Text style={styles.multiHeroBotElo}>{bot.elo}</Text>
                      </>
                    ) : (
                      <View style={styles.multiHeroEmptyContent}>
                        <MaterialCommunityIcons
                          name="plus-circle-outline"
                          size={24}
                          color={THEME.colors.textMuted}
                        />
                        <Text style={styles.multiHeroEmptyText}>Select Bot</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}
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
                const isSelected = selectedBotIds.includes(bot.id);
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
                          {selIndex + 2}/{playerCount}
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
              <Feather
                name="sliders"
                size={15}
                color={THEME.colors.textPrimary}
              />
              <Text style={styles.optionsBtnText} numberOfLines={1}>
                {timeLabel} · {modeName}
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={THEME.colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.sidePicker}>
            <TouchableOpacity
              style={[styles.sideBtn, side === 'blue' && styles.sideBtnActive]}
              activeOpacity={0.8}
              onPress={() => setSide('blue')}
              accessibilityLabel="Play as Blue"
            >
              <View style={[styles.sideOrb, { backgroundColor: '#3B82F6' }]} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sideBtn, side === 'random' && styles.sideBtnActive]}
              activeOpacity={0.8}
              onPress={() => setSide('random')}
              accessibilityLabel="Random side"
            >
              <Text style={styles.sideRandomText}>?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sideBtn, side === 'red' && styles.sideBtnActive]}
              activeOpacity={0.8}
              onPress={() => setSide('red')}
              accessibilityLabel="Play as Red"
            >
              <View style={[styles.sideOrb, { backgroundColor: '#E5484D' }]} />
            </TouchableOpacity>
          </View>
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
    masteryPill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 14,
      backgroundColor: THEME.colors.surfaceMuted,
      borderBottomWidth: 2,
      borderBottomColor: THEME.colors.secondaryBevel,
    },
    masteryPillText: {
      fontFamily: THEME.fonts.extraBold,
      fontSize: 12.5,
      fontWeight: '800',
      color: '#D97706',
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
    // Multi-bot hero section for 3P / 4P
    multiHeroSection: {
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: 10,
      backgroundColor: THEME.colors.background,
    },
    multiHeroSubtitle: {
      fontFamily: THEME.fonts.bold,
      fontSize: 12,
      color: THEME.colors.textSecondary,
      marginBottom: 8,
      textAlign: 'center',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    multiHeroRow: {
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'center',
    },
    multiHeroSlot: {
      flex: 1,
      maxWidth: 140,
      minHeight: 96,
      backgroundColor: THEME.colors.surfaceMuted,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: THEME.colors.secondaryBevel,
      padding: 8,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    multiHeroSlotFilled: {
      borderColor: THEME.colors.primary,
      backgroundColor: THEME.colors.surface,
    },
    multiHeroBadge: {
      position: 'absolute',
      top: 4,
      left: 6,
      backgroundColor: THEME.colors.primary,
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 6,
    },
    multiHeroBadgeText: {
      fontFamily: THEME.fonts.extraBold,
      fontSize: 10,
      color: '#FFFFFF',
      fontWeight: '800',
    },
    multiHeroBotName: {
      fontFamily: THEME.fonts.bold,
      fontSize: 12,
      color: THEME.colors.textPrimary,
      marginTop: 4,
    },
    multiHeroBotElo: {
      fontFamily: THEME.fonts.medium,
      fontSize: 11,
      color: THEME.colors.textMuted,
    },
    multiHeroEmptyContent: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    multiHeroEmptyText: {
      fontFamily: THEME.fonts.medium,
      fontSize: 11,
      color: THEME.colors.textMuted,
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
      paddingHorizontal: 12,
    },
    optionsBtnContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
    },
    optionsBtnText: {
      fontFamily: THEME.fonts.extraBold,
      fontSize: 13.5,
      fontWeight: '800',
      color: THEME.colors.textPrimary,
    },
    sidePicker: {
      flexDirection: 'row',
      gap: 6,
    },
    sideBtn: {
      width: 42,
      height: 42,
      backgroundColor: THEME.colors.surfaceMuted,
      borderRadius: 8,
      borderWidth: 2.5, // Universal 2.5px border
      borderColor: 'transparent',
      borderBottomWidth: 3,
      borderBottomColor: THEME.colors.secondaryBevel,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sideBtnActive: {
      backgroundColor: THEME.colors.surfaceMuted,
      borderColor: THEME.colors.primary,
      borderBottomWidth: 3,
      borderBottomColor: THEME.colors.primaryBevel,
    },
    sideOrb: {
      width: 15,
      height: 15,
      borderRadius: 7.5,
    },
    sideRandomText: {
      fontFamily: THEME.fonts.extraBold,
      fontSize: 15,
      fontWeight: '800',
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
