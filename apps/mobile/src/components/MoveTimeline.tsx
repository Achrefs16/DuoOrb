import React from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import type { MoveAssessment } from '@duoorb/game-core';
import { THEME } from '../theme';
import { createThemedStyles } from '../theme/themedStyles';
import { assessmentColor } from '../analysisUi';

interface MoveTimelineProps {
  assessments: MoveAssessment[];
  current: number; // 0-based index of the selected move
  onSelect: (index: number) => void;
}

/** One quiet dot per move. Tap to jump. Selected gets a dark ring. */
export const MoveTimeline: React.FC<MoveTimelineProps> = ({
  assessments,
  current,
  onSelect,
}) => {
  if (assessments.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {assessments.map((a, i) => {
        const selected = i === current;
        return (
          <TouchableOpacity
            key={`mt-${i}`}
            onPress={() => onSelect(i)}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            style={[styles.dotWrap, selected && styles.dotWrapSelected]}
            accessibilityLabel={`Move ${i + 1}: ${a}`}
          >
            <View style={[styles.dot, { backgroundColor: timelineColor(a) }]} />
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

function timelineColor(a: MoveAssessment): string {
  switch (a) {
    case 'BEST':
      return THEME.colors.assessmentBest;
    case 'EXCELLENT':
      return THEME.colors.playerMint;
    case 'GOOD':
      return THEME.colors.neutralStone;
    case 'INACCURACY':
    case 'MISTAKE':
    case 'BLUNDER':
      return assessmentColor(a);
  }
}

const styles = createThemedStyles(() => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  dotWrap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  dotWrapSelected: {
    borderColor: THEME.colors.textPrimary,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
}));
