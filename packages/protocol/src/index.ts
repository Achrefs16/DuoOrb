import {
  GameAction,
  GameError,
  GameMode,
  GameState,
  RecordedAction,
} from '@duoorb/game-core';

export interface UserProfileDto {
  id: string;
  username: string;
  displayName: string;
  rating1v1: number;
  rating4p: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  createdAt: number;
  isOnline?: boolean;
  isPlaying?: boolean;
}

export interface FriendDto {
  id: string;
  username: string;
  displayName: string;
  rating: number;
  status: 'ONLINE' | 'PLAYING' | 'OFFLINE';
}

export interface FriendRequestDto {
  id: string;
  fromUserId: string;
  fromUsername: string;
  toUserId: string;
  createdAt: number;
}

export interface RoomSlot {
  index: number;
  userId: string | null;
  displayName: string | null;
  isReady: boolean;
  isHost: boolean;
  rating?: number;
}

export interface RoomDto {
  id: string;
  code: string;
  mode: GameMode;
  hostId: string;
  /** Original creator — host is restored to them if they rejoin. */
  creatorId: string;
  slots: RoomSlot[];
  timeControlMinutes: number; // 0 for untimed, 3, 5, 10
  incrementSeconds: number;   // 0 for none, 1, 2, 5, etc.
  wallsEach: number;          // walls per player for the room's game
  status: 'WAITING' | 'STARTING' | 'IN_GAME';
  createdAt: number;
}

export interface ClockStateDto {
  activePlayerIndex: number;
  remainingMs: Record<string, number>;
  serverTimestamp: number;
  incrementSeconds?: number;
}

export interface RoomInviteDto {
  inviteId: string;
  roomId: string;
  code: string;
  fromUserId: string;
  fromDisplayName: string;
  toUserId: string;
  createdAt: number;
}

export interface ChallengeDto {
  id: string;
  fromUserId: string;
  fromDisplayName: string;
  toUserId: string;
  mode: GameMode;
  timeControlMinutes: number;
  incrementSeconds: number;
  wallsEach: number;
  createdAt: number;
  expiresAt: number;
}

export interface GameEndedDto {
  gameId: string;
  winnerId: string | null;
  reason: 'GOAL_REACHED' | 'RESIGNATION' | 'TIMEOUT' | 'DISCONNECT';
  endedAt: number;
  ratingChanges?: Record<string, { before: number; after: number; delta: number }>;
  /** Complete final ordering for multiplayer (1-based places). 1v1 omits it. */
  placements?: { playerId: string; userId: string; place: number }[];
}

export interface GameSyncDto {
  state: GameState;
  clock: ClockStateDto;
  missingActions: RecordedAction[];
  playerUserIds?: Record<string, string>;
}

export interface ClientToServerEvents {
  'game:join': (payload: {
    gameId: string;
    lastSequence?: number;
    /** Client's unconfirmed tail for reconnect reconciliation (capped). */
    pendingActions?: { clientActionId: string; action: GameAction }[];
  }) => void;
  'game:leave': (payload: { gameId: string }) => void;
  'game:action': (
    payload: {
      gameId: string;
      action: GameAction;
      clientTimestamp: number;
      /** Client-generated idempotency key — retries with the same key replay the original result. */
      clientActionId?: string;
      /** Client's view of the next sequence — enforced when present. */
      expectedSequence?: number;
    }
  ) => void;
  'session:adopt': (
    payload: { newToken: string },
    callback?: (res: { success: boolean; userId?: string; error?: string }) => void
  ) => void;
  /**
   * Identity changed client-side (guest minted, username/display name
   * chosen or edited, sign-in/out). No payload: the server re-reads the
   * verified identity it already holds and refreshes its map, room slots
   * and queue entries from the profile — never from client strings.
   */
  'session:sync': () => void;
  'game:resign': (payload: { gameId: string }) => void;
  'game:rematch': (payload: { gameId: string }) => void;
  'room:create': (payload: { mode: GameMode; timeControlMinutes: number; incrementSeconds?: number; wallsEach?: number }, callback: (res: { success: boolean; room?: RoomDto; error?: string }) => void) => void;
  'room:join': (payload: { code: string }, callback: (res: { success: boolean; room?: RoomDto; error?: string }) => void) => void;
  'room:ready': (payload: { roomId: string; isReady: boolean }) => void;
  'room:start': (payload: { roomId: string }) => void;
  'room:leave': (payload: { roomId: string }, callback?: (res: { success: boolean; error?: string }) => void) => void;
  'room:kick': (payload: { roomId: string; userId: string }, callback?: (res: { success: boolean; error?: string }) => void) => void;
  'room:invite': (payload: { roomId: string; toUserId: string }, callback?: (res: { success: boolean; error?: string }) => void) => void;
  'room:inviteRespond': (payload: { inviteId: string; accept: boolean }, callback?: (res: { success: boolean; room?: RoomDto; error?: string }) => void) => void;
  /** Pull the room's authoritative state. Used when re-entering a lobby from
   * a finished match, where the client only holds a pre-match snapshot. */
  'room:sync': (payload: { roomId?: string; code?: string }, callback?: (res: { success: boolean; error?: string }) => void) => void;
  'matchmaking:find': (payload: { mode: GameMode; timeControlMinutes: number; incrementSeconds?: number; wallsEach?: number }) => void;
  'matchmaking:cancel': () => void;
  'challenge:send': (payload: { toUserId: string; mode: GameMode; timeControlMinutes: number; incrementSeconds?: number; wallsEach?: number }, callback?: (res: { success: boolean; challenge?: ChallengeDto; error?: string }) => void) => void;
  'challenge:respond': (payload: { challengeId: string; accept: boolean }, callback?: (res: { success: boolean; error?: string }) => void) => void;
  'challenge:cancel': (payload: { challengeId: string }) => void;
}

export interface ServerToClientEvents {
  'game:state': (state: GameState) => void;
  'game:actionAccepted': (recorded: RecordedAction) => void;
  'game:clock': (clock: ClockStateDto) => void;
  'game:ended': (result: GameEndedDto) => void;
  /** Mid-game finish: a player earned a placement but the match continues. */
  'game:playerFinished': (payload: { gameId: string; playerId: string; userId: string; place: number }) => void;
  'game:error': (error: GameError) => void;
  'game:opponentDisconnected': (payload: { userId: string; gracePeriodSeconds: number }) => void;
  'game:opponentReconnected': (payload: { userId: string }) => void;
  'game:sync': (sync: GameSyncDto) => void;
  'game:rematchOffered': (payload: { gameId: string; fromUserId: string }) => void;
  'room:state': (room: RoomDto) => void;
  'room:started': (payload: { roomId: string; gameId: string }) => void;
  'room:kicked': (payload: { roomId: string }) => void;
  'room:inviteReceived': (invite: RoomInviteDto) => void;
  'room:inviteDeclined': (payload: { inviteId: string; byUserId: string }) => void;
  'matchmaking:matched': (payload: { gameId: string; roomId?: string }) => void;
  'challenge:received': (challenge: ChallengeDto) => void;
  'challenge:accepted': (payload: { challengeId: string; gameId: string; mode: GameMode; timeControlMinutes: number; incrementSeconds: number }) => void;
  'challenge:declined': (payload: { challengeId: string; byUserId: string }) => void;
  'challenge:expired': (payload: { challengeId: string }) => void;
  'challenge:cancelled': (payload: { challengeId: string }) => void;
}
