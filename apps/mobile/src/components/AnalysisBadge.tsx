import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import type { MoveAssessment } from '@duoorb/game-core';
import { OrbIcon } from './OrbIcon';
import { SmoothStar } from './SmoothStar';
import { THEME, useStyles } from '../theme';
import { assessmentBadgeColor, assessmentColor } from '../analysisUi';
import { useTranslation } from '../i18n';

export interface AssessmentIconProps {
  assessment?: MoveAssessment | null;
  size?: number;
  style?: any;
}

const renderExclamation = (cx: number) => (
  <>
    <Path
      d={`M ${cx} 6.3 L ${cx} 13.4`}
      stroke="#FFFFFF"
      strokeWidth={2.5}
      strokeLinecap="round"
    />
    <Circle cx={cx} cy={17.3} r={1.4} fill="#FFFFFF" />
  </>
);

const renderQuestion = (cx: number, compact = false) => {
  const w = compact ? 2.0 : 2.35;
  const sw = compact ? 2.15 : 2.35;
  return (
    <>
      <Path
        d={`M ${cx - w} 8.6 C ${cx - w} 6.7 ${cx - 0.9} 5.8 ${cx + 0.15} 5.8 C ${cx + w * 0.68} 5.8 ${cx + w} 6.7 ${cx + w} 7.95 C ${cx + w} 9.0 ${cx + w * 0.72} 9.65 ${cx + 0.75} 10.3 C ${cx + 0.15} 10.75 ${cx} 11.35 ${cx} 12.6`}
        stroke="#FFFFFF"
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx={cx} cy={17.3} r={compact ? 1.3 : 1.4} fill="#FFFFFF" />
    </>
  );
};

/**
 * Standardized assessment icon matching Chess.com & DuoOrb summary review:
 * - Best: SmoothStar vector on green #69B342
 * - Excellent / Good: thumb-up vector on #78B833 / #69B342
 * - Brilliant: '!!' vector on teal #1BACA6
 * - Great: '!' vector on blue #2563EB
 * - Inaccuracy: '?!' vector on yellow #EAB308
 * - Mistake: '?' vector on orange #F97316
 * - Blunder: '??' vector on red #DC2626
 *
 * All punctuation glyphs use precision SVG paths centered in a 24x24 viewBox
 * so they remain pixel-centered across iOS, Android, and Web at any badge size.
 */
export const AssessmentIcon: React.FC<AssessmentIconProps> = ({
  assessment,
  size = 20,
  style,
}) => {
  if (!assessment) return null;
  const bg = assessmentBadgeColor(assessment);
  const iconSize = Math.max(10, Math.round(size * 0.6));

  const renderContent = () => {
    switch (assessment) {
      case 'BEST':
        return <SmoothStar size={iconSize} color="#FFFFFF" />;
      case 'EXCELLENT':
      case 'GOOD':
        return (
          <OrbIcon
            name="thumb-up"
            size={Math.max(10, Math.round(size * 0.54))}
            color="#FFFFFF"
          />
        );
      case 'BRILLIANT':
        return (
          <Svg width={size} height={size} viewBox="0 0 24 24">
            {renderExclamation(9.3)}
            {renderExclamation(14.7)}
          </Svg>
        );
      case 'GREAT':
        return (
          <Svg width={size} height={size} viewBox="0 0 24 24">
            {renderExclamation(12)}
          </Svg>
        );
      case 'INACCURACY':
        return (
          <Svg width={size} height={size} viewBox="0 0 24 24">
            {renderQuestion(9.1, true)}
            {renderExclamation(15.3)}
          </Svg>
        );
      case 'MISTAKE':
        return (
          <Svg width={size} height={size} viewBox="0 0 24 24">
            {renderQuestion(12, false)}
          </Svg>
        );
      case 'BLUNDER':
        return (
          <Svg width={size} height={size} viewBox="0 0 24 24">
            {renderQuestion(8.6, true)}
            {renderQuestion(15.2, true)}
          </Svg>
        );
      case 'FORCED':
        return (
          <Svg width={size} height={size} viewBox="0 0 24 24">
            <Rect
              x={7.5}
              y={7.5}
              width={9}
              height={9}
              rx={2}
              stroke="#FFFFFF"
              strokeWidth={2.2}
              fill="none"
            />
          </Svg>
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
