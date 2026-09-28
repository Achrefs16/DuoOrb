import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { THEME } from '../theme';

interface EvaluationMeterProps {
  evaluation: number; // positive = P1 advantage, negative = P2 advantage
  p1Name?: string;
  p2Name?: string;
}

export const EvaluationMeter: React.FC<EvaluationMeterProps> = ({
  evaluation,
}) => {
  const clamped = Math.max(-20, Math.min(20, evaluation));
  const p1Percentage = Math.round(((clamped + 20) / 40) * 100);

  const formattedScore =
    evaluation > 0
      ? `+${evaluation.toFixed(1)}`
      : evaluation < 0
      ? evaluation.toFixed(1)
      : '0.0';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.score}>{formattedScore}</Text>
      </View>
      <View style={styles.meterTrack}>
        <View style={[styles.p1Fill, { width: `${p1Percentage}%` }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: THEME.colors.backgroundCard,
    padding: 12,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.boardBorder,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 8,
  },
  score: {
    fontFamily: THEME.fonts.bold,
    color: THEME.colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  meterTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: THEME.colors.player2,
  },
  p1Fill: {
    height: '100%',
    backgroundColor: THEME.colors.player1,
  },
});
