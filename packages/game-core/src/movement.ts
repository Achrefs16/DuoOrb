import { areCellsEqual, isBlockedByWall, isCellWithinBoard } from './geometry.js';
import { CellCoord, GameState, PlayerState, WallCoord } from './types.js';

interface DirectionOffset {
  dr: number;
  dc: number;
}

const ORTHOGONAL_DIRECTIONS: DirectionOffset[] = [
  { dr: -1, dc: 0 }, // UP
  { dr: 1, dc: 0 },  // DOWN
  { dr: 0, dc: -1 }, // LEFT
  { dr: 0, dc: 1 },  // RIGHT
];

function getPerpendicularDirections(dir: DirectionOffset): DirectionOffset[] {
  if (dir.dr !== 0) {
    // Vertical direction -> perpendiculars are horizontal (LEFT and RIGHT)
    return [
      { dr: 0, dc: -1 },
      { dr: 0, dc: 1 },
    ];
  } else {
    // Horizontal direction -> perpendiculars are vertical (UP and DOWN)
    return [
      { dr: -1, dc: 0 },
      { dr: 1, dc: 0 },
    ];
  }
}

function getPlayerAt(cell: CellCoord, players: PlayerState[]): PlayerState | undefined {
  // Finished players are removed from the board entirely: their orb no
  // longer occupies any cell, so remaining players walk into freed goal
  // cells (and win from them) with no jumping required. Active-player
  // occupancy and jump rules are unchanged.
  return players.find((p) => p.status === 'ACTIVE' && areCellsEqual(p.position, cell));
}

/**
 * Computes all legal cell destinations for the specified player in the current game state.
 */
export function getLegalMoves(state: GameState, playerId: string): CellCoord[] {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) {
    return [];
  }
  return getLegalMovesFrom(state, playerId, player.position);
}

/**
 * Same as getLegalMoves but from an arbitrary square (e.g. previewing the
 * continuation of a queued premove). Occupants and walls come from the live
 * state; strict validation still happens when the move is actually played.
 */
export function getLegalMovesFrom(
  state: GameState,
  playerId: string,
  from: CellCoord
): CellCoord[] {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) {
    return [];
  }

  const current = from;
  const legalMoves: CellCoord[] = [];
  const walls: WallCoord[] = state.walls;

  for (const dir of ORTHOGONAL_DIRECTIONS) {
    const neighbor: CellCoord = {
      row: current.row + dir.dr,
      col: current.col + dir.dc,
    };

    // Must be inside board and not blocked by wall between current and neighbor
    if (!isCellWithinBoard(neighbor) || isBlockedByWall(current, neighbor, walls)) {
      continue;
    }

    const opponent = getPlayerAt(neighbor, state.players);

    if (!opponent) {
      // Normal empty cell move
      legalMoves.push(neighbor);
    } else {
      // Opponent is adjacent -> evaluate jump rules
      const straightBehind: CellCoord = {
        row: neighbor.row + dir.dr,
        col: neighbor.col + dir.dc,
      };

      const isStraightBlockedByWall = isBlockedByWall(neighbor, straightBehind, walls);
      const isStraightOutOfBounds = !isCellWithinBoard(straightBehind);
      const isStraightOccupied =
        !isStraightOutOfBounds && getPlayerAt(straightBehind, state.players) !== undefined;

      const isStraightJumpBlocked =
        isStraightOutOfBounds || isStraightBlockedByWall || isStraightOccupied;

      if (!isStraightJumpBlocked) {
        // Straight jump is available and mandatory over diagonal jumps
        legalMoves.push(straightBehind);
      } else {
        // Straight jump is blocked -> diagonal jumps are permitted
        const perps = getPerpendicularDirections(dir);
        for (const perp of perps) {
          const diagonalCell: CellCoord = {
            row: neighbor.row + perp.dr,
            col: neighbor.col + perp.dc,
          };

          if (
            isCellWithinBoard(diagonalCell) &&
            !isBlockedByWall(neighbor, diagonalCell, walls) &&
            !getPlayerAt(diagonalCell, state.players)
          ) {
            legalMoves.push(diagonalCell);
          }
        }
      }
    }
  }

  return legalMoves;
}

/**
 * Checks if a specific move target is legal for the player.
 */
export function isLegalMove(state: GameState, playerId: string, to: CellCoord): boolean {
  const moves = getLegalMoves(state, playerId);
  return moves.some((m) => areCellsEqual(m, to));
}
