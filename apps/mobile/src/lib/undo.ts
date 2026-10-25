/**
 * Offline AI undo decisions, isolated from the ~2800-line screen so the rules
 * are unit-testable: only your turn, only after at least one exchange, never
 * while the bot is thinking or after the result.
 */

export interface UndoEligibility {
  isAiGame: boolean;
  completed: boolean;
  isAiThinking: boolean;
  currentPlayerIndex: number;
  humanSeatIndex: number;
  historyLength: number;
  humanSeatActive: boolean;
}

export function canUndoAiTurn(input: UndoEligibility): boolean {
  return (
    input.isAiGame &&
    !input.completed &&
    !input.isAiThinking &&
    input.currentPlayerIndex === input.humanSeatIndex &&
    input.historyLength >= 2 &&
    input.humanSeatActive
  );
}

/**
 * Returns the history index to rewind to (exclusive step count), or -1.
 *
 * Rewinds to before the viewer's last action, not "two plies": in 3P/4P AI
 * tables several bots may reply after your move, and a fixed -2 would drop you
 * on another bot's turn.
 */
export function findUndoTargetStep(
  history: readonly { playerId: string }[],
  humanPlayerId: string
): number {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].playerId === humanPlayerId) return i;
  }
  return -1;
}
