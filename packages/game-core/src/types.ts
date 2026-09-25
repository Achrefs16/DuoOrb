export type Orientation = 'H' | 'V';

export interface CellCoord {
  row: number; // 0..8
  col: number; // 0..8
}

export interface WallCoord {
  row: number; // 0..7
  col: number; // 0..7
  orientation: Orientation;
}

export interface Wall extends WallCoord {
  placedByPlayerId: string;
  sequence: number;
}

export type GoalDirection = 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT';

/** ACTIVE players take turns; FINISHED players earned a placement (goal or
 * forfeit) and spectate — they never receive turns or consume clock. */
export type PlayerStatus = 'ACTIVE' | 'FINISHED';

export interface PlayerState {
  id: string;
  index: number;
  displayName: string;
  position: CellCoord;
  wallsRemaining: number;
  goalDirection: GoalDirection;
  color?: string;
  status: PlayerStatus;
  /** Final placement (1-based), set when the player finishes. Null while active. */
  place: number | null;
}

export type GameMode =
  | '2p'
  | '4p'
  | 'race2'
  | 'race3'
  | 'race4'
  | 'center2'
  | 'center3';

export type GameStatus = 'WAITING' | 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';

export type ActionType = 'MOVE' | 'PLACE_WALL' | 'RESIGN' | 'TIMEOUT';

export interface MoveAction {
  type: 'MOVE';
  to: CellCoord;
}

export interface PlaceWallAction {
  type: 'PLACE_WALL';
  wall: WallCoord;
}

export interface ResignAction {
  type: 'RESIGN';
}

export interface TimeoutAction {
  type: 'TIMEOUT';
}

export type GameAction = MoveAction | PlaceWallAction | ResignAction | TimeoutAction;

export interface RecordedAction {
  sequence: number;
  playerId: string;
  action: GameAction;
  timestamp: number;
  clockRemainingMs?: number;
  /**
   * Client idempotency key, echoed back on acceptance so the sender can
   * match confirmations to its pending queue. Never affects rules.
   */
  clientActionId?: string;
}

export interface GameState {
  rulesetVersion: string;
  gameId: string;
  mode: GameMode;
  status: GameStatus;
  players: PlayerState[];
  walls: Wall[];
  currentPlayerIndex: number;
  moveNumber: number;
  lastMove: RecordedAction | null;
  winnerId: string | null;
  history: RecordedAction[];
  createdAt: number;
  startedAt: number;
  endedAt: number | null;
  /**
   * Ordered finish log for 3P/4P games: the i-th entry is the player who
   * earned place i+1 (goal finishes take the best remaining place,
   * forfeits take the worst remaining place). Empty for 1v1, which ends
   * immediately on the decisive action. Complete (N entries) at COMPLETED.
   */
  placements: Placement[];
}

export interface Placement {
  playerId: string;
  /** 1-based final place. */
  place: number;
}

export type GameErrorCode =
  | 'GAME_NOT_IN_PROGRESS'
  | 'NOT_YOUR_TURN'
  | 'ALREADY_FINISHED'
  | 'ILLEGAL_MOVE'
  | 'INVALID_WALL_COORDINATES'
  | 'NO_WALLS_REMAINING'
  | 'WALL_ALREADY_OCCUPIED'
  | 'WALL_CROSSES_EXISTING'
  | 'WALL_BLOCKS_ALL_PATHS'
  | 'STALE_SEQUENCE'
  | 'UNKNOWN_ACTION';

export interface GameError {
  code: GameErrorCode;
  message: string;
}

export type ActionResult<T> = { success: true; state: T } | { success: false; error: GameError };
