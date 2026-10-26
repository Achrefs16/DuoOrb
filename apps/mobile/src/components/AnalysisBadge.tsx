import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { MoveAssessment } from '@duoorb/game-core';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SmoothStar } from './SmoothStar';
import { THEME, useStyles } from '../theme';
import { assessmentBadgeColor, assessmentColor } from '../analysisUi';
import { useTranslation } from '../i18n';

export interface AssessmentIconProps {
  assessment?: MoveAssessment | null;
  size?: number;
  style?: any;
}

/**
 * Standardized assessment icon matching Chess.com & DuoOrb summary review:
 * - Best: SmoothStar vector on green #69B342
 * - Excellent / Good: thumb-up vector on #78B833 / #69B342
 * - Brilliant: '!!' bold white text on teal #1BACA6
 * - Great: '!' bold white text on blue #2563EB
 * - Inaccuracy: '?!' bold white text on yellow #EAB308
 * - Mistake: '?' bold white text on orange #F97316
 * - Blunder: '??' bold white text on red #DC2626
 */
export const AssessmentIcon: React.FC<AssessmentIconProps> = ({
  assessment,
  size = 20,
  style,
}) => {
  if (!assessment) return null;
  const bg = assessmentBadgeColor(assessment);
  const iconSize = Math.max(10, Math.round(size * 0.58));

  const renderContent = () => {
    switch (assessment) {
      case 'BEST':
        return <SmoothStar size={iconSize} color="#FFFFFF" />;
      case 'EXCELLENT':
      case 'GOOD':
        return (
          <MaterialCommunityIcons
            name="thumb-up"
            size={Math.max(9, Math.round(size * 0.52))}
            color="#FFFFFF"
          />
        );
      case 'BRILLIANT':
        return (
          <Text
            style={{
              color: '#FFFFFF',
              fontFamily: THEME.fonts.bold,
              fontSize: Math.max(9, Math.round(size * 0.5)),
              fontWeight: '800',
              lineHeight: size,
              textAlign: 'center',
            }}
          >
            !!
          </Text>
        );
      case 'GREAT':
        return (
          <Text
            style={{
              color: '#FFFFFF',
              fontFamily: THEME.fonts.bold,
              fontSize: Math.max(10, Math.round(size * 0.58)),
              fontWeight: '800',
              lineHeight: size,
              textAlign: 'center',
            }}
          >
            !
          </Text>
        );
      case 'INACCURACY':
        return (
          <Text
            style={{
              color: '#FFFFFF',
              fontFamily: THEME.fonts.bold,
              fontSize: Math.max(8, Math.round(size * 0.46)),
              fontWeight: '800',
              lineHeight: size,
              textAlign: 'center',
            }}
          >
            ?!
          </Text>
        );
      case 'MISTAKE':
        return (
          <Text
            style={{
              color: '#FFFFFF',
              fontFamily: THEME.fonts.bold,
              fontSize: Math.max(10, Math.round(size * 0.58)),
              fontWeight: '800',
              lineHeight: size,
              textAlign: 'center',
            }}
          >
            ?
          </Text>
        );
      case 'BLUNDER':
        return (
          <Text
            style={{
              color: '#FFFFFF',
              fontFamily: THEME.fonts.bold,
              fontSize: Math.max(8, Math.round(size * 0.46)),
              fontWeight: '800',
              lineHeight: size,
              textAlign: 'center',
            }}
          >
            ??
          </Text>
        );
      case 'FORCED':
        return (
          <Text
            style={{
              color: '#FFFFFF',
              fontFamily: THEME.fonts.bold,
              fontSize: Math.max(9, Math.round(size * 0.52)),
              fontWeight: '800',
              lineHeight: size,
              textAlign: 'center',
            }}
          >
            □
          </Text>
        );
      default:
        return null;
    }
  };

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: Math.round(size / 2),
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {renderContent()}
    </View>
  );
};

/** Small classification pill: colored dot + label. No emoji, no giant cards. */
export const AnalysisBadge: React.FC<{ assessment: MoveAssessment }> = ({
  assessment,
}) => {
  const styles = useStyles(createStyles);
  const { t } = useTranslation();
  const color = assessmentColor(assessment);
  const labelKey = (() => {
    switch (assessment) {
      case 'BRILLIANT':
        return 'assessment.brilliant';
      case 'GREAT':
        return 'assessment.great';
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
