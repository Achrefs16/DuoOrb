import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { MoveAssessment } from '@duoorb/game-core';
import { THEME } from '../theme';
import { assessmentColor } from '../analysisUi';

/** Small classification pill: colored dot + label. No emoji, no giant cards. */
export const AnalysisBadge: React.FC<{ assessment: MoveAssessment }> = ({
  assessment,
}) => {
  const color = assessmentColor(assessment);
  const label =
    assessment.charAt(0) + assessment.slice(1).toLowerCase();
  return (
    <View style={styles.badge}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  label: {
    fontFamily: THEME.fonts.extraBold,
    color: THEME.colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
