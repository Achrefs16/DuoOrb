import React, { useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  GameState,
  RecordedAction,
  createReplaySession,
  replayNext,
  replayPrevious,
} from '@duoorb/game-core';
import { GameBoard } from '../components/GameBoard';
import { THEME } from '../theme';

interface ReplayScreenProps {
  initialState: GameState;
  history: RecordedAction[];
  perspectiveIdx?: number;
  onBack: () => void;
  onAnalyze?: () => void;
}

export const ReplayScreen: React.FC<ReplayScreenProps> = ({
  initialState,
  history,
  perspectiveIdx = 0,
  onBack,
  onAnalyze,
}) => {
  const [session, setSession] = useState(() =>
    createReplaySession(initialState, history)
  );
  // Same seat as in the game: Red starts pre-rotated, no animation.
  const [flip] = useState(
    () =>
      new Animated.Value(
        initialState.mode === '2p' && perspectiveIdx === 1 ? 1 : 0
      )
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.stepLabel}>
          {session.currentStep} / {session.actions.length}
        </Text>
        {onAnalyze ? (
          <TouchableOpacity onPress={onAnalyze}>
            <Text style={styles.analyzeText}>Analyze</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 52 }} />
        )}
      </View>

      <View style={styles.boardWrap}>
        <Animated.View
          style={{
            transform: [
              {
                rotate: flip.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '180deg'],
                }),
              },
            ],
          }}
        >
          <GameBoard
            state={session.currentState}
            legalMoves={[]}
            previewWall={null}
            selectedCell={null}
            interactive={false}
            flipAnim={flip}
          />
        </Animated.View>
      </View>

      <View style={styles.controlsRow}>
        <TouchableOpacity
          style={[styles.controlBtn, session.currentStep === 0 && styles.disabled]}
          disabled={session.currentStep === 0}
          onPress={() => setSession(replayPrevious(session))}
        >
          <Text style={styles.controlText}>‹ Prev</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.controlBtn,
            session.currentStep === session.actions.length && styles.disabled,
          ]}
          disabled={session.currentStep === session.actions.length}
          onPress={() => setSession(replayNext(session))}
        >
          <Text style={styles.controlText}>Next ›</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
    paddingTop: 36,
    paddingBottom: 16,
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  backButton: {
    padding: 4,
    minWidth: 52,
  },
  backButtonText: {
    fontFamily: THEME.fonts.regular,
    color: THEME.colors.textSecondary,
    fontSize: 28,
    fontWeight: '300',
  },
  stepLabel: {
    fontFamily: THEME.fonts.bold,
    color: THEME.colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  analyzeText: {
    fontFamily: THEME.fonts.bold,
    color: THEME.colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    minWidth: 52,
    textAlign: 'right',
  },
  boardWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 12,
  },
  controlBtn: {
    backgroundColor: THEME.colors.backgroundCard,
    paddingVertical: 11,
    paddingHorizontal: 28,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.boardBorder,
  },
  disabled: {
    opacity: 0.35,
  },
  controlText: {
    fontFamily: THEME.fonts.bold,
    color: THEME.colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
});
