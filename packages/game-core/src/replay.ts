import { applyAction, createInitialState } from './ruleset.js';
import { GameAction, GameState, RecordedAction } from './types.js';

export interface ReplaySession {
  initialState: GameState;
  actions: RecordedAction[];
  currentStep: number; // 0 = initial, 1..actions.length
  currentState: GameState;
}

/**
 * Rebuilds the GameState from the initial state up to a specified step/sequence number (inclusive).
 * If stepIndex is 0, returns the initial state.
 * If stepIndex is greater than actions.length, applies all actions.
 */
export function rebuildStateAtStep(initialState: GameState, actions: RecordedAction[], stepIndex: number): GameState {
  let state = initialState;
  const targetStep = Math.max(0, Math.min(stepIndex, actions.length));

  for (let i = 0; i < targetStep; i++) {
    const recorded = actions[i];
    const result = applyAction(state, recorded.action, {
      timestamp: recorded.timestamp,
      clockRemainingMs: recorded.clockRemainingMs,
      // The recorded player is always the true actor — including off-turn
      // resigns, which a bare current-player assumption would misattribute.
      actorId: recorded.playerId,
    });

    if (!result.success) {
      throw new Error(
        `Failed to rebuild replay at step ${i + 1} (${recorded.action.type}): ${result.error.message}`
      );
    }

    state = result.state;
  }

  return state;
}

/**
 * Creates a controllable ReplaySession object.
 */
export function createReplaySession(initialState: GameState, actions: RecordedAction[]): ReplaySession {
  return {
    initialState,
    actions,
    currentStep: actions.length,
    currentState: rebuildStateAtStep(initialState, actions, actions.length),
  };
}

export function replayNext(session: ReplaySession): ReplaySession {
  if (session.currentStep >= session.actions.length) {
    return session;
  }
  const nextStep = session.currentStep + 1;
  return {
    ...session,
    currentStep: nextStep,
    currentState: rebuildStateAtStep(session.initialState, session.actions, nextStep),
  };
}

export function replayPrevious(session: ReplaySession): ReplaySession {
  if (session.currentStep <= 0) {
    return session;
  }
  const prevStep = session.currentStep - 1;
  return {
    ...session,
    currentStep: prevStep,
    currentState: rebuildStateAtStep(session.initialState, session.actions, prevStep),
  };
}

export function replayFirst(session: ReplaySession): ReplaySession {
  return {
    ...session,
    currentStep: 0,
    currentState: session.initialState,
  };
}

export function replayLast(session: ReplaySession): ReplaySession {
  return {
    ...session,
    currentStep: session.actions.length,
    currentState: rebuildStateAtStep(session.initialState, session.actions, session.actions.length),
  };
}

export function replayJumpTo(session: ReplaySession, targetStep: number): ReplaySession {
  const step = Math.max(0, Math.min(targetStep, session.actions.length));
  return {
    ...session,
    currentStep: step,
    currentState: rebuildStateAtStep(session.initialState, session.actions, step),
  };
}
