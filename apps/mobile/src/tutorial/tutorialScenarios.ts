import { GameState, CellCoord, WallCoord, Orientation, createInitialState } from '@duoorb/game-core';

export interface TutorialScenario {
  id: number;
  badge: string;
  title: string;
  instruction: string;
  successMessage: string;
  tipText: string;
  initialState: GameState;
  targetAction:
    | { type: 'MOVE'; to: CellCoord }
    | { type: 'PLACE_WALL'; wall: WallCoord };
  handGesture: {
    type: 'tap' | 'drag' | 'jump';
    fromCell?: CellCoord;
    toCell?: CellCoord;
    fromTray?: boolean;
    toWall?: WallCoord;
  };
}

function makeWall(
  row: number,
  col: number,
  orientation: Orientation,
  placedBy = 'p2',
  sequence = 1
) {
  return { row, col, orientation, placedByPlayerId: placedBy, sequence };
}

/**
 * SCENARIO 1: REACH THE BASELINE
 * Player at row 1, col 4. Golden goal row is row 0.
 * Single step forward to win.
 */
function createScenario1State(): GameState {
  const base = createInitialState({ mode: '2p' });
  base.players[0].position = { row: 1, col: 4 };
  base.players[0].wallsRemaining = 3;
  base.players[1].position = { row: 5, col: 4 };
  base.players[1].wallsRemaining = 3;
  base.walls = [
    makeWall(1, 2, 'V', 'p2', 1),
    makeWall(1, 4, 'V', 'p2', 2),
  ];
  return base;
}

/**
 * SCENARIO 2: THE CLUTCH BLOCK
 * Opponent is at (7, 4) — 1 step from row 8 baseline win.
 * Player drops a horizontal wall at (7, 3, 'H') right in front of them,
 * shutting down their 1-step win into a massive detour!
 */
function createScenario2State(): GameState {
  const base = createInitialState({ mode: '2p' });
  base.players[0].position = { row: 5, col: 4 };
  base.players[0].wallsRemaining = 4;
  base.players[1].position = { row: 7, col: 4 };
  base.players[1].wallsRemaining = 2;

  base.walls = [
    makeWall(6, 2, 'V', 'p2', 1),
    makeWall(6, 5, 'V', 'p2', 2),
    makeWall(7, 1, 'H', 'p2', 3),
    makeWall(7, 5, 'H', 'p2', 4),
  ];
  return base;
}

/**
 * SCENARIO 3: THE FACE-OFF LEAP
 * Face-to-face in a 1-wide alley.
 * Player at (4, 4), Opponent at (3, 4).
 * Leap straight over to (2, 4).
 */
function createScenario3State(): GameState {
  const base = createInitialState({ mode: '2p' });
  base.players[0].position = { row: 4, col: 4 };
  base.players[0].wallsRemaining = 2;
  base.players[1].position = { row: 3, col: 4 };
  base.players[1].wallsRemaining = 2;

  base.walls = [
    makeWall(3, 3, 'V', 'p2', 1),
    makeWall(3, 4, 'V', 'p2', 2),
  ];
  return base;
}

/**
 * SCENARIO 4: THE PLUS CROSSING
 * Two horizontal walls H(3,3) and H(3,5) touch end to end ("--").
 * Player drops a vertical wall V(3,4) through their junction, forming a "+".
 */
function createScenario4State(): GameState {
  const base = createInitialState({ mode: '2p' });
  base.players[0].position = { row: 6, col: 4 };
  base.players[0].wallsRemaining = 3;
  base.players[1].position = { row: 2, col: 4 };
  base.players[1].wallsRemaining = 1;

  base.walls = [
    makeWall(3, 3, 'H', 'p2', 1),
    makeWall(3, 5, 'H', 'p2', 2),
  ];
  return base;
}

export const TUTORIAL_SCENARIOS: TutorialScenario[] = [
  {
    id: 1,
    badge: '1 / 4',
    title: 'Reach the Baseline',
    instruction: 'Tap your orb to step into the goal row and win.',
    successMessage: 'First player to reach the opposite baseline wins.',
    tipText: 'Your goal is always the furthest opposite row.',
    initialState: createScenario1State(),
    targetAction: {
      type: 'MOVE',
      to: { row: 0, col: 4 },
    },
    handGesture: {
      type: 'tap',
      fromCell: { row: 1, col: 4 },
      toCell: { row: 0, col: 4 },
    },
  },
  {
    id: 2,
    badge: '2 / 4',
    title: 'Block with a Wall',
    instruction: 'Opponent is 1 step from winning. Drag a wall to block them.',
    successMessage: 'Blocked! Their path is cut off, forcing a long detour.',
    tipText: 'Walls block movement. Use them to reroute opponents.',
    initialState: createScenario2State(),
    targetAction: {
      type: 'PLACE_WALL',
      wall: { row: 7, col: 3, orientation: 'H' },
    },
    handGesture: {
      type: 'drag',
      fromTray: true,
      toWall: { row: 7, col: 3, orientation: 'H' },
    },
  },
  {
    id: 3,
    badge: '3 / 4',
    title: 'Jump the Opponent',
    instruction: 'Face to face in a narrow alley, jump straight over them.',
    successMessage: 'Jumped! Vault forward 2 spaces in a single move.',
    tipText: 'When facing an opponent head-on, jump over them.',
    initialState: createScenario3State(),
    targetAction: {
      type: 'MOVE',
      to: { row: 2, col: 4 },
    },
    handGesture: {
      type: 'tap',
      toCell: { row: 2, col: 4 },
    },
  },
  {
    id: 4,
    badge: '4 / 4',
    title: 'Cross the Walls',
    instruction: 'Two walls meet end to end. Drag a vertical wall through the gap to make a +.',
    successMessage: 'A plus shape! Walls can cross a junction where two walls meet.',
    tipText: 'A vertical wall can pass through where two horizontal walls meet.',
    initialState: createScenario4State(),
    targetAction: {
      type: 'PLACE_WALL',
      wall: { row: 3, col: 4, orientation: 'V' },
    },
    handGesture: {
      type: 'drag',
      fromTray: true,
      toWall: { row: 3, col: 4, orientation: 'V' },
    },
  },
];
