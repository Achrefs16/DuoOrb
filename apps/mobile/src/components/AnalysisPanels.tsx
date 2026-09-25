import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { MoveAnalysis } from '@duoorb/game-core';
import { THEME } from '../theme';
import { ordinal } from '../analysisUi';

/** Tiny before → after rows. Numbers do the talking, not prose. */
export const ImpactRows: React.FC<{
  analysis: MoveAnalysis;
  moverName: string;
  threatName: string | null;
  multi: boolean;
}> = ({ analysis, moverName, threatName, multi }) => {
  const { before, after } = analysis;
  const wallsChanged = before.ownWalls !== after.ownWalls;
  return (
    <View style={styles.impact}>
      <View style={styles.impactRow}>
        <Text style={styles.impactName} numberOfLines={1}>
          {moverName}
        </Text>
        <Text style={styles.impactNums}>
          {before.ownDistance} <Text style={styles.arrow}>→</Text> {after.ownDistance}
        </Text>
      </View>
      {multi && (
        <Text style={styles.rankLine}>
          {ordinal(before.moverRank)} → {ordinal(after.moverRank)}
        </Text>
      )}
      {threatName && (
        <View style={styles.impactRow}>
          <Text style={styles.impactName} numberOfLines={1}>
            {threatName}
          </Text>
          <Text style={styles.impactNums}>
            {before.closestThreatDistance} <Text style={styles.arrow}>→</Text>{' '}
            {after.closestThreatDistance}
          </Text>
        </View>
      )}
      {wallsChanged && (
        <View style={styles.impactRow}>
          <Text style={styles.impactName}>Walls</Text>
          <Text style={styles.impactNums}>
            {before.ownWalls} <Text style={styles.arrow}>→</Text> {after.ownWalls}
          </Text>
        </View>
      )}
    </View>
  );
};

/** Mini interactive demonstration: numbered principal variation lines. */
export const ShowWhy: React.FC<{ lines: string[] }> = ({ lines }) => {
  if (lines.length === 0) return null;
  return (
    <View style={styles.why}>
      {lines.map((line, i) => (
        <View key={`pv-${i}`} style={styles.whyRow}>
          <Text style={styles.whyNum}>{i + 1}</Text>
          <Text style={styles.whyText}>{line}</Text>
        </View>
      ))}
    </View>
  );
};

/** Expert rows, hidden behind Details. Raw engine data lives here only. */
export const DetailsRows: React.FC<{ analysis: MoveAnalysis }> = ({ analysis }) => {
  const rows: Array<[string, string]> = [
    ['Evaluation', formatEval(analysis.evaluationAfter)],
    ['Win chance', `${Math.round(analysis.winChanceAfter * 100)}%`],
    ['Your route', `${analysis.after.ownDistance}`],
    ['Rival route', `${analysis.after.closestThreatDistance}`],
  ];
  if (analysis.wallImpact) {
    const s = analysis.wallImpact.efficiencyScore;
    rows.push(['Wall efficiency', s >= 60 ? 'High' : s >= 35 ? 'Medium' : 'Low']);
  }
  rows.push(['Mobility', `${analysis.after.ownMobility}`]);
  rows.push(['Depth', `${analysis.depthReached}`]);
  return (
    <View style={styles.details}>
      {rows.map(([label, value]) => (
        <View key={label} style={styles.detailsRow}>
          <Text style={styles.detailsLabel}>{label}</Text>
          <Text style={styles.detailsValue}>{value}</Text>
        </View>
      ))}
    </View>
  );
};

function formatEval(v: number): string {
  if (!Number.isFinite(v)) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(1)}`;
}

/** One-screen game summary: accuracy, counts, deciding moment, lesson. */
export const SummaryBlock: React.FC<{
  accuracyValue: number;
  good: number;
  inaccuracies: number;
  mistakes: number;
  blunders: number;
  momentMove: number | null;
  lesson: string;
  onJumpMoment: () => void;
  onHome: () => void;
}> = ({
  accuracyValue,
  good,
  inaccuracies,
  mistakes,
  blunders,
  momentMove,
  lesson,
  onJumpMoment,
  onHome,
}) => {
  return (
    <View style={styles.summary}>
      <Text style={styles.summaryKicker}>Game review</Text>
      <Text style={styles.accuracy}>{Math.round(accuracyValue)}%</Text>
      <Text style={styles.accuracyLabel}>Accuracy</Text>
      <Text style={styles.counts}>
        {good} good · {inaccuracies} inaccuracies · {mistakes} mistakes · {blunders} blunders
      </Text>

      {momentMove !== null && (
        <View style={styles.momentBlock}>
          <Text style={styles.momentKicker}>Deciding moment</Text>
          <Text style={styles.momentMove}>Move {momentMove}</Text>
        </View>
      )}

      <Text style={styles.lessonLabel}>Key lesson</Text>
      <Text style={styles.lesson}>{lesson}</Text>

      <View style={styles.summaryButtons}>
        {momentMove !== null && (
          <TouchableOpacity style={styles.primaryButton} onPress={onJumpMoment}>
            <Text style={styles.primaryButtonText}>Review moment</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.secondaryButton} onPress={onHome}>
          <Text style={styles.secondaryButtonText}>Home</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  impact: {
    alignSelf: 'stretch',
    gap: 2,
    marginTop: 8,
  },
  impactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  impactName: {
    fontFamily: THEME.fonts.semiBold,
    color: THEME.colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
    marginRight: 12,
  },
  impactNums: {
    fontFamily: THEME.fonts.bold,
    color: THEME.colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  arrow: {
    color: THEME.colors.textMuted,
    fontWeight: '400',
  },
  rankLine: {
    fontFamily: THEME.fonts.semiBold,
    color: THEME.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  why: {
    alignSelf: 'stretch',
    marginTop: 10,
    gap: 6,
  },
  whyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  whyNum: {
    fontFamily: THEME.fonts.extraBold,
    color: THEME.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    width: 14,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  whyText: {
    fontFamily: THEME.fonts.semiBold,
    color: THEME.colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  details: {
    alignSelf: 'stretch',
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.boardBorder,
    paddingTop: 8,
    gap: 4,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailsLabel: {
    fontFamily: THEME.fonts.semiBold,
    color: THEME.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  detailsValue: {
    fontFamily: THEME.fonts.bold,
    color: THEME.colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  summary: {
    alignSelf: 'stretch',
    alignItems: 'center',
    marginTop: 18,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.boardBorder,
    paddingTop: 18,
    gap: 4,
  },
  summaryKicker: {
    fontFamily: THEME.fonts.extraBold,
    color: THEME.colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  accuracy: {
    fontFamily: THEME.fonts.extraBold,
    color: THEME.colors.textPrimary,
    fontSize: 44,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  accuracyLabel: {
    fontFamily: THEME.fonts.semiBold,
    color: THEME.colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  counts: {
    fontFamily: THEME.fonts.semiBold,
    color: THEME.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  momentBlock: {
    alignItems: 'center',
    marginTop: 12,
  },
  momentKicker: {
    fontFamily: THEME.fonts.extraBold,
    color: THEME.colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  momentMove: {
    fontFamily: THEME.fonts.extraBold,
    color: THEME.colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  lessonLabel: {
    fontFamily: THEME.fonts.extraBold,
    color: THEME.colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 12,
  },
  lesson: {
    fontFamily: THEME.fonts.semiBold,
    color: THEME.colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 12,
  },
  summaryButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    width: '100%',
  },
  primaryButton: {
    flex: 1,
    backgroundColor: THEME.colors.textPrimary,
    paddingVertical: 12,
    borderRadius: THEME.radius.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontFamily: THEME.fonts.bold,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: THEME.radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.boardBorder,
  },
  secondaryButtonText: {
    fontFamily: THEME.fonts.semiBold,
    color: THEME.colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
});
