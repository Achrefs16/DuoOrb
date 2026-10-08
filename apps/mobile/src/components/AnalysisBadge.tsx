import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { MoveAssessment } from '@duoorb/game-core';
import { THEME, useStyles } from '../theme';
import { assessmentColor } from '../analysisUi';
import { useTranslation } from '../i18n';

/** Small classification pill: colored dot + label. No emoji, no giant cards. */
export const AnalysisBadge: React.FC<{ assessment: MoveAssessment }> = ({
  assessment,
}) => {
  const styles = useStyles(createStyles);
  const { t } = useTranslation();
  const color = assessmentColor(assessment);
  const labelKey = (() => {
    switch (assessment) {
      case 'BEST':
        return 'assessment.best';
      case 'EXCELLENT':
        return 'assessment.excellent';
      case 'GOOD':
        return 'assessment.good';
      case 'INACCURACY':
        return 'assessment.inaccuracy';
      case 'MISTAKE':
        return 'assessment.mistake';
      case 'BLUNDER':
        return 'assessment.blunder';
      default:
        // Exhaustive over MoveAssessment — unreachable; keeps t() typed.
        return 'assessment.good';
    }
  })();
  const label = t(labelKey);
  return (
    <View style={styles.badge}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
};

const createStyles = () => StyleSheet.create({
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
