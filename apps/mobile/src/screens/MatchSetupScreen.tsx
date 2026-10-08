import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { AIDifficulty, GameMode, BotPersonality, botById, botLadder } from '@duoorb/game-core';
import { BotAvatar } from '../components/BotAvatar';
import { THEME, useStyles } from '../theme';
import { useTranslation } from '../i18n';
import { isPremiumActive, usePremium } from '../monetization/premium';
import { runWhenOnline } from '../components/NoConnection';
import { TIME_CONTROLS, TimeControl, getTimeControl } from '../timeControls';
import { resolveMode } from '../matchModes';
import { getMatchSetupDraft, saveMatchSetupDraft } from '../storage/gameStorage';

/** Which side the human plays in a classic AI game. */
export type SideChoice = 'blue' | 'red' | 'random';

export type PlayerCount = 2 | 3 | 4;

type SetupMode = 'classic' | 'center' | 'race';
type WallsChoice = 10 | 15 | 99;

export interface MatchSetupPageSelection {
  mode: GameMode;
  vsType: 'ai' | 'local' | 'challenge' | 'online';
  clock: TimeControl;
  difficulty: AIDifficulty;
  /** Premium personality id, or null for the generic difficulty bot (D5). */
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
  /** Locked-bot tap destination (P7 PremiumSheet; "coming soon" hold until then). */
  onLockedBot?: () => void;
  onConfirm: (selection: MatchSetupPageSelection) => void;
  onBack: () => void;
}

const MODE_DESC: Record<SetupMode, { title: string; body: string }> = {
  classic: {
    title: 'Classic Rules',
    body: 'First orb to reach the opposing edge wins. Place walls each turn to divert your opponent.',
  },
  center: {
    title: 'Center Rush Rules',
    body: 'First orb to reach and hold the center nexus zone wins.',
  },
  race: {
    title: 'Race Rules',
    body: 'Pure pathfinding speed race to cross the opposing edge.',
  },
};

const ELO: Record<AIDifficulty, string> = {
  easy: '1200 ELO',
  normal: '1500 ELO',
  hard: '1800 ELO',
};

// TEMP-TEST ONLY — REMOVE BEFORE ANY RELEASE BUILD. Opens the premium bot
// rows so personalities can be playtested without a sandbox subscription.
const DEV_UNLOCK_BOTS = true;

export const MatchSetupScreen: React.FC<MatchSetupScreenProps> = ({
  initialKind: vsType,
  challengeName,
  initialClock,
  initialDifficulty = 'normal',
  onLockedBot,
  onConfirm,
  onBack,
}) => {
  const styles = useStyles(createStyles);
  const { t } = useTranslation();
  // Last-used picks, per entry kind: everything stays chosen until changed.
  // Explicit entry props (quick actions) win over the stored draft.
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
  // Premium personality (null = generic difficulty bot). Picking a difficulty
  // always drops back to generic; picking a bot adopts its difficulty tier.
  // A stored bot that no longer exists falls back to generic.
  const [botId, setBotId] = useState<string | null>(
    draft.botId && botById(draft.botId) ? draft.botId : null
  );
  const [previewBot, setPreviewBot] = useState<BotPersonality | null>(null);
  const premium = usePremium();
  const selectedBot = botId ? botById(botId) : null;
  const pickDifficulty = (d: AIDifficulty) => {
    setDifficulty(d);
    setBotId(null);
  };
  const [side, setSide] = useState<SideChoice>(
    draft.side === 'red' || draft.side === 'random' ? draft.side : 'blue'
  );
  const [playerCount, setPlayerCount] = useState<PlayerCount>(
    draft.playerCount === 3 || draft.playerCount === 4 ? draft.playerCount : 2
  );
  const [clock, setClock] = useState<TimeControl>(
    initialClock ?? getTimeControl(draft.clockId)
  );
  const [walls, setWalls] = useState<WallsChoice>(
    draft.wallsEach === 15 || draft.wallsEach === 99 ? draft.wallsEach : 10
  );

  // Remember every change under this entry kind.
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

  const getRulesDesc = (mode: SetupMode) => {
    switch (mode) {
      case 'classic':
        return { title: t('setup.classicTitle'), body: t('setup.classicDesc') };
      case 'center':
        return { title: t('setup.centerTitle'), body: t('setup.centerDesc') };
      case 'race':
        return { title: t('setup.raceTitle'), body: t('setup.raceDesc') };
    }
  };
  const desc = getRulesDesc(modeSel);

  return (
    <View style={styles.screen}>
      {/* Header with embedded Vs AI / Local toggle */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={onBack}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Go back"
          >
            <Feather name="chevron-left" size={24} color={THEME.colors.onSurface} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {vsType === 'challenge'
              ? t('setup.challengeTitle', { name: challengeName ?? '' })
              : vsType === 'online'
              ? t('setup.customOnline')
              : t('setup.title')}
          </Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Config card */}
        <View style={styles.card}>
          {/* Mode */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('setup.mode')}</Text>
            <View style={styles.track}>
              {(
                [
                  { id: 'classic', label: t('setup.classic') },
                  { id: 'center', label: t('setup.centerRush') },
                  { id: 'race', label: t('setup.race') },
                ] as const
              ).map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.opt, modeSel === m.id && styles.optActive]}
                  onPress={() => setModeSel(m.id)}
                >
                  <Text style={[styles.optText, modeSel === m.id && styles.optTextActive]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Players */}
          {modeSel !== 'classic' && (
            <View style={styles.section}>
              <View style={styles.labelRow}>
                <Text style={styles.sectionLabel}>{t('setup.players')}</Text>
                <Text style={styles.sectionHint}>{t('setup.freeForAll')}</Text>
              </View>
              <View style={styles.track}>
                {([2, 3, 4] as PlayerCount[]).map((n) => (
                  <TouchableOpacity
                    key={n}
                    style={[styles.opt, playerCount === n && styles.optActive]}
                    onPress={() => setPlayerCount(n)}
                  >
                    <Text style={[styles.optText, playerCount === n && styles.optTextActive]}>
                      {t('setup.playerCount', { count: n })}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Compact Chess.com-style Bot Selector */}
          {vsType === 'ai' && (
            <View style={styles.section}>
              <View style={styles.labelRow}>
                <Text style={styles.sectionLabel}>{t('setup.opponent')}</Text>
                {selectedBot ? (
                  <TouchableOpacity
                    style={styles.selectedBotBadge}
                    onPress={() => setPreviewBot(selectedBot)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={[styles.selectedBotBadgeText, { color: selectedBot.color }]}>
                      {selectedBot.name} · {selectedBot.elo} ELO
                    </Text>
                    <Feather name="info" size={12} color={selectedBot.color} />
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.sectionHint}>
                    {t('setup.genericAi')} · {ELO[difficulty]}
                  </Text>
                )}
              </View>

              {/* Compact Bot Horizontal Scroll */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.compactBotScroll}
              >
                {/* Standard Engine Option */}
                <TouchableOpacity
                  style={[
                    styles.compactBotCard,
                    !botId && styles.compactBotCardActiveStandard,
                  ]}
                  activeOpacity={0.8}
                  onPress={() => setBotId(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Standard Engine"
                >
                  <View
                    style={[
                      styles.compactEngineIconWrap,
                      !botId && styles.compactEngineIconWrapActive,
                    ]}
                  >
                    <Feather
                      name="cpu"
                      size={20}
                      color={!botId ? THEME.colors.primary : THEME.colors.textMuted}
                    />
                  </View>
                  <Text
                    style={[
                      styles.compactBotName,
                      !botId && { color: THEME.colors.primary, fontWeight: '700' },
                    ]}
                    numberOfLines={1}
                  >
                    Engine
                  </Text>
                  <Text style={styles.compactBotElo}>AI</Text>
                </TouchableOpacity>

                {/* Real Human Bot Personas (Martin, Elena, Nelson, Sofia, Marcus, Viktor) */}
                {botLadder().map((b) => {
                  const locked =
                    !DEV_UNLOCK_BOTS && b.premium && !isPremiumActive(premium);
                  const selected = botId === b.id;
                  return (
                    <TouchableOpacity
                      key={b.id}
                      style={[
                        styles.compactBotCard,
                        selected && [
                          styles.compactBotCardActive,
                          { borderColor: b.color },
                        ],
                      ]}
                      activeOpacity={0.8}
                      onPress={() => {
                        if (locked) {
                          onLockedBot?.();
                          return;
                        }
                        setBotId(b.id);
                        setDifficulty(b.profile.difficulty);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`${b.name}, ${b.title}, ${b.elo} ELO${locked ? ', locked' : ''}`}
                    >
                      <View style={styles.compactAvatarWrap}>
                        <BotAvatar
                          avatarKey={b.avatarKey}
                          color={b.color}
                          size={40}
                          showGlow={selected}
                        />
                        {locked && (
                          <View style={styles.compactLockBadge}>
                            <Feather name="lock" size={9} color="#FFFFFF" />
                          </View>
                        )}
                        {selected && (
                          <View style={[styles.compactCheckBadge, { backgroundColor: b.color }]}>
                            <Feather name="check" size={8} color="#FFFFFF" />
                          </View>
                        )}
                      </View>

                      <Text
                        style={[
                          styles.compactBotName,
                          selected && { color: b.color, fontWeight: '700' },
                        ]}
                        numberOfLines={1}
                      >
                        {b.name}
                      </Text>
                      <Text style={styles.compactBotElo}>{b.elo}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* When Standard Engine selected: compact difficulty chips */}
              {!botId && (
                <View style={styles.track}>
                  {(
                    [
                      { id: 'easy', label: t('setup.easy') },
                      { id: 'normal', label: t('setup.normal') },
                      { id: 'hard', label: t('setup.hard') },
                    ] as const
                  ).map((d) => (
                    <TouchableOpacity
                      key={d.id}
                      style={[styles.opt, difficulty === d.id && styles.optActive]}
                      onPress={() => pickDifficulty(d.id)}
                    >
                      <Text
                        style={[
                          styles.optText,
                          difficulty === d.id && styles.optTextActive,
                        ]}
                      >
                        {d.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* When named bot selected: slim one-line style quote with tap to preview */}
              {selectedBot && (
                <TouchableOpacity
                  style={styles.compactBotQuoteRow}
                  activeOpacity={0.8}
                  onPress={() => setPreviewBot(selectedBot)}
                >
                  <Text style={styles.compactBotQuoteText} numberOfLines={1}>
                    "{selectedBot.style}"
                  </Text>
                  <Feather name="chevron-right" size={13} color={THEME.colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Your side */}
          {vsType === 'ai' && modeSel === 'classic' && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t('setup.yourSide')}</Text>
              <View style={styles.track}>
                <TouchableOpacity
                  style={[styles.opt, side === 'blue' && styles.optActive]}
                  onPress={() => setSide('blue')}
                >
                  <View style={styles.sideRow}>
                    <View style={[styles.sideDot, { backgroundColor: THEME.colors.primary }]} />
                    <Text style={[styles.optText, side === 'blue' && styles.optTextActive]}>
                      {t('setup.blue')}
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.opt, side === 'red' && styles.optActive]}
                  onPress={() => setSide('red')}
                >
                  <View style={styles.sideRow}>
                    <View style={[styles.sideDot, { backgroundColor: THEME.colors.playerPink }]} />
                    <Text style={[styles.optText, side === 'red' && styles.optTextActive]}>
                      {t('setup.red')}
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.opt, side === 'random' && styles.optActive]}
                  onPress={() => setSide('random')}
                >
                  <View style={styles.sideRow}>
                    <MaterialCommunityIcons
                      name="shuffle"
                      size={15}
                      color={side === 'random' ? THEME.colors.primary : THEME.colors.textSecondaryStrong}
                    />
                    <Text style={[styles.optText, side === 'random' && styles.optTextActive]}>
                      {t('setup.random')}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Time control */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('setup.timeControl')}</Text>
            <View style={styles.track}>
              {TIME_CONTROLS.slice(0, 3).map((tc) => (
                <TouchableOpacity
                  key={tc.id}
                  style={[styles.opt, clock.id === tc.id && styles.optActive]}
                  onPress={() => setClock(tc)}
                >
                  <Text style={[styles.optText, clock.id === tc.id && styles.optTextActive]}>
                    {tc.short}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Walls */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('setup.walls')}</Text>
            <View style={styles.track}>
              {(
                [
                  { id: 10, label: t('setup.walls10') },
                  { id: 15, label: t('setup.walls15') },
                  { id: 99, label: t('setup.wallsUnlimited') },
                ] as const
              ).map((w) => (
                <TouchableOpacity
                  key={w.id}
                  style={[styles.opt, walls === w.id && styles.optActive]}
                  onPress={() => setWalls(w.id)}
                >
                  <Text style={[styles.optText, walls === w.id && styles.optTextActive]}>
                    {w.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Rules banner */}
          <View style={styles.hintBanner}>
            <Feather name="info" size={20} color={THEME.colors.primary} />
            <View style={styles.hintTextWrap}>
              <Text style={styles.hintTitle}>{desc.title}</Text>
              <Text style={styles.hintText}>{desc.body}</Text>
            </View>
          </View>

          {/* CTA */}
          <TouchableOpacity
            style={styles.cta}
            activeOpacity={0.88}
            onPress={() => {
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
              // Only the online entry needs internet; AI/local stay direct.
              if (vsType === 'online') runWhenOnline(confirm);
              else confirm();
            }}
          >
            <MaterialCommunityIcons name="play" size={20} color={THEME.colors.onPrimary} />
            <Text style={styles.ctaText}>
              {vsType === 'ai'
                ? t('setup.playAi')
                : vsType === 'challenge'
                ? t('setup.sendChallenge')
                : vsType === 'online'
                ? t('setup.findCustom')
                : t('setup.playLocal')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Chess.com-style Bot Challenge Sheet / Modal */}
      {previewBot && (
        <Modal
          visible={!!previewBot}
          transparent
          animationType="fade"
          onRequestClose={() => setPreviewBot(null)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setPreviewBot(null)}
          >
            <Pressable
              style={styles.modalCard}
              onPress={(e) => e.stopPropagation()}
            >
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setPreviewBot(null)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Feather name="x" size={20} color={THEME.colors.textMuted} />
              </TouchableOpacity>

              <View style={styles.modalHeader}>
                <BotAvatar
                  avatarKey={previewBot.avatarKey}
                  color={previewBot.color}
                  size="xl"
                  showGlow
                />
                <Text style={styles.modalBotName}>{previewBot.name}</Text>
                <View style={styles.modalBadgeRow}>
                  <View style={[styles.modalBadge, { backgroundColor: previewBot.color }]}>
                    <Text style={styles.modalBadgeText}>{previewBot.elo} ELO</Text>
                  </View>
                  <Text style={styles.modalBotTitle}>{previewBot.title}</Text>
                </View>
              </View>

              {/* Bot Catchphrase Quote */}
              <View style={[styles.quoteCard, { borderLeftColor: previewBot.color }]}>
                <Text style={styles.quoteText}>"{previewBot.quote}"</Text>
              </View>

              {/* Character Bio & Playstyle */}
              <View style={styles.bioBlock}>
                <Text style={styles.bioTitle}>Playstyle & Strategy</Text>
                <Text style={styles.bioText}>{previewBot.bio}</Text>
              </View>

              {/* Challenge CTA Button */}
              <TouchableOpacity
                style={[styles.modalCta, { backgroundColor: previewBot.color }]}
                activeOpacity={0.85}
                onPress={() => {
                  setBotId(previewBot.id);
                  setDifficulty(previewBot.profile.difficulty);
                  setPreviewBot(null);
                }}
              >
                <Feather name="zap" size={18} color="#FFFFFF" />
                <Text style={styles.modalCtaText}>
                  {botId === previewBot.id ? 'Selected' : `Challenge ${previewBot.name}`}
                </Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
};

const createStyles = () => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  header: {
    backgroundColor: THEME.colors.backgroundCard,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.surfaceMuted,
    paddingHorizontal: 16,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontFamily: THEME.fonts.bold,
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.inverseLabel,
    letterSpacing: -0.2,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: THEME.colors.backgroundCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceMuted,
    padding: 16,
    gap: 16,
  },
  section: {
    gap: 6,
  },
  sectionLabel: {
    fontFamily: THEME.fonts.bold,
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textSecondaryStrong,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHint: {
    fontFamily: THEME.fonts.medium,
    fontSize: 11,
    fontWeight: '500',
    color: THEME.colors.statusOffline,
  },
  track: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.surfaceMuted,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  opt: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optActive: {
    backgroundColor: THEME.colors.backgroundCard,
    ...THEME.shadows.card,
  },
  optText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textOnMuted,
    textAlign: 'center',
  },
  optTextActive: {
    fontFamily: THEME.fonts.bold,
    color: THEME.colors.primary,
    fontWeight: '700',
  },
  sideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sideDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  selectedBotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.colors.surfaceMuted,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  selectedBotBadgeText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 11,
    fontWeight: '700',
  },
  compactBotScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  compactBotCard: {
    width: 68,
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: 12,
    backgroundColor: THEME.colors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: 'transparent',
    gap: 3,
  },
  compactBotCardActive: {
    backgroundColor: THEME.colors.backgroundCard,
    ...THEME.shadows.card,
  },
  compactBotCardActiveStandard: {
    backgroundColor: THEME.colors.backgroundCard,
    borderColor: THEME.colors.primary,
    borderWidth: 1.5,
    ...THEME.shadows.card,
  },
  compactEngineIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: THEME.colors.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.surfaceHairline,
  },
  compactEngineIconWrapActive: {
    backgroundColor: 'rgba(108, 111, 253, 0.12)',
    borderColor: THEME.colors.primary,
  },
  compactAvatarWrap: {
    position: 'relative',
  },
  compactLockBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactCheckBadge: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    borderRadius: 7,
    width: 14,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  compactBotName: {
    fontFamily: THEME.fonts.bold,
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textOnMuted,
    textAlign: 'center',
  },
  compactBotElo: {
    fontFamily: THEME.fonts.medium,
    fontSize: 10,
    fontWeight: '500',
    color: THEME.colors.textSecondaryStrong,
    textAlign: 'center',
  },
  compactBotQuoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.colors.surfaceMuted,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 4,
  },
  compactBotQuoteText: {
    fontFamily: THEME.fonts.medium,
    fontSize: 11,
    fontStyle: 'italic',
    color: THEME.colors.textSecondaryStrong,
    flex: 1,
    marginRight: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: THEME.colors.backgroundCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceHairline,
    padding: 20,
    alignItems: 'center',
    gap: 14,
    ...THEME.shadows.modal,
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.colors.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalHeader: {
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  modalBotName: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 22,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  modalBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  modalBadgeText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalBotTitle: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textSecondaryStrong,
  },
  quoteCard: {
    width: '100%',
    backgroundColor: THEME.colors.surfaceMuted,
    borderLeftWidth: 3.5,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  quoteText: {
    fontFamily: THEME.fonts.medium,
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 18,
    color: THEME.colors.textPrimary,
  },
  bioBlock: {
    width: '100%',
    gap: 4,
  },
  bioTitle: {
    fontFamily: THEME.fonts.bold,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: THEME.colors.textSecondaryStrong,
    letterSpacing: 0.5,
  },
  bioText: {
    fontFamily: THEME.fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: THEME.colors.textSecondary,
  },
  modalCta: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    marginTop: 4,
    ...THEME.shadows.card,
  },
  modalCtaText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  hintBanner: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: THEME.mode === 'dark' ? 'rgba(108, 111, 253, 0.16)' : 'rgba(239, 246, 255, 0.7)',
    borderWidth: 1,
    borderColor: THEME.colors.surfacePrimaryTintBorder,
    borderRadius: 12,
    padding: 12,
  },
  hintTextWrap: {
    flex: 1,
    gap: 2,
  },
  hintTitle: {
    fontFamily: THEME.fonts.bold,
    fontSize: 12,
    fontWeight: '700',
    color: THEME.mode === 'dark' ? '#C7C9FF' : THEME.colors.chartInk,
  },
  hintText: {
    fontFamily: THEME.fonts.regular,
    fontSize: 11,
    color: THEME.mode === 'dark' ? 'rgba(199, 201, 255, 0.9)' : 'rgba(30, 64, 175, 0.8)',
    lineHeight: 16,
    marginTop: 2,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 4,
  },
  ctaText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.onPrimary,
  },
});
