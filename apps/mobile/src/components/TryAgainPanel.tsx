import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  GameState,
  analyzeMove,
  getLegalMoves,
  type TryAgainData,
} from '@duoorb/game-core';
import { GameBoard } from './GameBoard';
import { THEME } from '../theme';
import { ENGINE_TEAL, assessmentColor, cleanName } from '../analysisUi';

interface TryAgainPanelProps {
  data: TryAgainData;
  onClose: () => void;
}

function actionsEqual(
  a: { type: string; to?: { row: number; col: number }; wall?: { row: number; col: number; orientation: string } },
  b: { type: string; to?: { row: number; col: number }; wall?: { row: number; col: number; orientation: string } }
): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'MOVE' && b.type === 'MOVE' && a.to && b.to) {
    return a.to.row === b.to.row && a.to.col === b.to.col;
  }
  if (a.type === 'PLACE_WALL' && b.type === 'PLACE_WALL' && a.wall && b.wall) {
    return (
      a.wall.row === b.wall.row &&
      a.wall.col === b.wall.col &&
      a.wall.orientation === b.wall.orientation
    );
  }
  return true;
}

/**
 * Restore the position before the mistake and let the player try a move.
 * Attempts are evaluated instantly against the engine's acceptable list.
 */
export const TryAgainPanel: React.FC<TryAgainPanelProps> = ({
  data,
  onClose,
}) => {
  const mover = data.stateBefore.players[data.stateBefore.currentPlayerIndex];
  const moverPos = mover?.position ?? { row: 4, col: 4 };
  const [revealed, setRevealed] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; good: boolean } | null>(null);

  const frozen: GameState = data.stateBefore;
  const legalTargets = mover
    ? getLegalMoves(frozen, mover.id).map((m) => `${m.row},${m.col}`)
    : [];

  const handleCell = (cell: { row: number; col: number }) => {
    if (!mover) return;
    if (!legalTargets.includes(`${cell.row},${cell.col}`)) return;
    const attempt = { type: 'MOVE' as const, to: cell };
    const result = analyzeMove(frozen, attempt, 'fast');
    if (!result) {
      setFeedback({ text: 'That square is not reachable.', good: false });
      return;
    }
    if (actionsEqual(attempt, data.bestAction)) {
      setFeedback({ text: 'Best move.', good: true });
      setRevealed(false);
    } else if (data.acceptableActions.some((a) => actionsEqual(attempt, a))) {
      setFeedback({ text: 'Good choice.', good: true });
      setRevealed(false);
    } else {
      setFeedback({ text: 'Not quite — teal shows a stronger idea.', good: false });
      setRevealed(true);
    }
  };

  const best = data.bestAction;
  const moverName = cleanName(mover?.displayName);

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Try again, {moverName}</Text>
      <GameBoard
        state={frozen}
        legalMoves={[]}
        previewWall={null}
        selectedCell={moverPos}
        interactive
        moveMark={null}
        altMark={
          revealed
            ? best.type === 'MOVE'
              ? { to: best.to, color: ENGINE_TEAL }
              : best.type === 'PLACE_WALL'
              ? { wall: best.wall, color: ENGINE_TEAL }
              : null
            : null
        }
        onCellPress={handleCell}
      />
      {feedback && (
        <Text
          style={[
            styles.feedback,
            { color: feedback.good ? assessmentColor('BEST') : assessmentColor('MISTAKE') },
          ]}
        >
          {feedback.text}
        </Text>
      )}
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.ghostButton}
          onPress={() => {
            setRevealed((r) => !r);
          }}
        >
          <Text style={styles.ghostButtonText}>
            {revealed ? 'Hide answer' : 'Reveal best'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.ghostButton} onPress={onClose}>
          <Text style={styles.ghostButtonText}>Back to review</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  panel: {
    alignSelf: 'stretch',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  title: {
    fontFamily: THEME.fonts.extraBold,
    color: THEME.colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  feedback: {
    fontFamily: THEME.fonts.bold,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  ghostButton: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.boardBorder,
    backgroundColor: THEME.colors.backgroundCard,
  },
  ghostButtonText: {
    fontFamily: THEME.fonts.bold,
    color: THEME.colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
});
