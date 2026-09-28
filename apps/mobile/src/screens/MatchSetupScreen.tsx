import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { AIDifficulty, GameMode } from '@duoorb/game-core';
import { THEME } from '../theme';
import { TIME_CONTROLS, TimeControl } from '../timeControls';
import { resolveMode } from '../matchModes';

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

export const MatchSetupScreen: React.FC<MatchSetupScreenProps> = ({
  initialKind: vsType,
  challengeName,
  initialClock,
  initialDifficulty = 'normal',
  onConfirm,
  onBack,
}) => {
  const [modeSel, setModeSel] = useState<SetupMode>('classic');
  const [difficulty, setDifficulty] = useState<AIDifficulty>(initialDifficulty);
  const [side, setSide] = useState<SideChoice>('blue');
  const [playerCount, setPlayerCount] = useState<PlayerCount>(2);
  const [clock, setClock] = useState<TimeControl>(initialClock ?? TIME_CONTROLS[2]);
  const [walls, setWalls] = useState<WallsChoice>(10);

  const resolvedMode: GameMode = resolveMode(
    modeSel === 'race' ? 'race' : modeSel === 'center' ? 'center' : 'classic',
    playerCount
  );
  const desc = MODE_DESC[modeSel];

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
            <Feather name="chevron-left" size={24} color="#334155" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {vsType === 'challenge'
              ? `Challenge ${challengeName ?? ''}`.trim()
              : vsType === 'online'
              ? 'Custom Online Match'
              : 'Match Setup'}
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
            <Text style={styles.sectionLabel}>Mode</Text>
            <View style={styles.track}>
              {(
                [
                  { id: 'classic', label: 'Classic' },
                  { id: 'center', label: 'Center Rush' },
                  { id: 'race', label: 'Race' },
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
                <Text style={styles.sectionLabel}>Players</Text>
                <Text style={styles.sectionHint}>Free for all</Text>
              </View>
              <View style={styles.track}>
                {([2, 3, 4] as PlayerCount[]).map((n) => (
                  <TouchableOpacity
                    key={n}
                    style={[styles.opt, playerCount === n && styles.optActive]}
                    onPress={() => setPlayerCount(n)}
                  >
                    <Text style={[styles.optText, playerCount === n && styles.optTextActive]}>
                      {n} Players
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* AI difficulty */}
          {vsType === 'ai' && (
            <View style={styles.section}>
              <View style={styles.labelRow}>
                <Text style={styles.sectionLabel}>AI Difficulty</Text>
                <Text style={styles.sectionHint}>{ELO[difficulty]}</Text>
              </View>
              <View style={styles.track}>
                {(
                  [
                    { id: 'easy', label: 'Easy' },
                    { id: 'normal', label: 'Normal' },
                    { id: 'hard', label: 'Hard' },
                  ] as const
                ).map((d) => (
                  <TouchableOpacity
                    key={d.id}
                    style={[styles.opt, difficulty === d.id && styles.optActive]}
                    onPress={() => setDifficulty(d.id)}
                  >
                    <Text style={[styles.optText, difficulty === d.id && styles.optTextActive]}>
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Your side */}
          {vsType === 'ai' && modeSel === 'classic' && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Your Side</Text>
              <View style={styles.track}>
                <TouchableOpacity
                  style={[styles.opt, side === 'blue' && styles.optActive]}
                  onPress={() => setSide('blue')}
                >
                  <View style={styles.sideRow}>
                    <View style={[styles.sideDot, { backgroundColor: '#2563EB' }]} />
                    <Text style={[styles.optText, side === 'blue' && styles.optTextActive]}>
                      Blue
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.opt, side === 'red' && styles.optActive]}
                  onPress={() => setSide('red')}
                >
                  <View style={styles.sideRow}>
                    <View style={[styles.sideDot, { backgroundColor: '#F43F5E' }]} />
                    <Text style={[styles.optText, side === 'red' && styles.optTextActive]}>
                      Red
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
                      color={side === 'random' ? '#2563EB' : '#64748B'}
                    />
                    <Text style={[styles.optText, side === 'random' && styles.optTextActive]}>
                      Random
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Time control */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Time Control</Text>
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
            <Text style={styles.sectionLabel}>Walls</Text>
            <View style={styles.track}>
              {(
                [
                  { id: 10, label: '10 Walls' },
                  { id: 15, label: '15 Walls' },
                  { id: 99, label: 'Unlimited ∞' },
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
            <Feather name="info" size={20} color="#2563EB" />
            <View style={styles.hintTextWrap}>
              <Text style={styles.hintTitle}>{desc.title}</Text>
              <Text style={styles.hintText}>{desc.body}</Text>
            </View>
          </View>

          {/* CTA */}
          <TouchableOpacity
            style={styles.cta}
            activeOpacity={0.88}
            onPress={() =>
              onConfirm({
                mode: resolvedMode,
                vsType,
                clock,
                difficulty,
                side,
                playerCount,
                wallsEach: walls,
              })
            }
          >
            <MaterialCommunityIcons name="play" size={20} color="#FFFFFF" />
            <Text style={styles.ctaText}>
              {vsType === 'ai'
                ? 'Play vs AI'
                : vsType === 'challenge'
                ? 'Send Challenge'
                : vsType === 'online'
                ? 'Find Custom Match'
                : 'Play Local'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
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
    color: '#0F172A',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
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
    color: '#64748B',
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
    color: '#94A3B8',
  },
  track: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
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
    backgroundColor: '#FFFFFF',
    ...THEME.shadows.card,
  },
  optText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
  },
  optTextActive: {
    fontFamily: THEME.fonts.bold,
    color: '#2563EB',
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
  hintBanner: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'rgba(239, 246, 255, 0.7)',
    borderWidth: 1,
    borderColor: '#DBEAFE',
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
    color: '#172554',
  },
  hintText: {
    fontFamily: THEME.fonts.regular,
    fontSize: 11,
    color: 'rgba(30, 64, 175, 0.8)',
    lineHeight: 16,
    marginTop: 2,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 4,
  },
  ctaText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
