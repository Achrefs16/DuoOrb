/**
 * Move notation, for talking about games in text — and the wire format for
 * hard-AI victory uploads.
 *
 * `formatGame` serializes a finished game for the server (`POST /ai-wins`),
 * which replays it through `rebuildFromNotation` to verify the win before
 * awarding badges. The copy-to-clipboard button that used this is gone; the
 * format stays because analysis and verification read it back move by move.
 * It has no effect on rules, search or rendering.
 *
 * Grammar
 *   pawn   <P><file><rank>        P is the seat letter, file a..i, rank 1..9
 *   wall   <W><file><rank>        W is H or V, position on the 8x8 lattice
 *
 *   files  a b c d e f g h i  ->  columns 0..8
 *   ranks  1 2 3 4 5 6 7 8 9  ->  rows    0..8
 *
 * So `Bd5` is the blue pawn landing on column 3, row 4, and `Hd4` is a
 * horizontal wall on the lattice intersection (row 3, column 3).
 *
 * Seat letters
 * -----------
 * A letter names a COLOUR, never a seat index, and the order matches the board
 * palette in `apps/mobile/src/theme.ts`:
 *
 *   playerColors: [primary #2563EB blue, coral #E5484D red, green, amber]
 *
 * so seat 0 is B and seat 1 is R. The first version of this file used
 * 'RBGYCW', which had blue and red the wrong way round: a player holding the
 * blue orb was written `R`, so reading a game back meant translating between
 * two colour vocabularies. Rematches also swap seats, so a letter that tracked
 * the index rather than the colour changed meaning between games.
 *
 * Numbering
 * ---------
 * Plies are numbered from 0 and the count starts at the BLUE orb, so `0.` is
 * always the blue player's opening move. Seat 0 moves first, so this is simply
 * zero-based ply order; the reference is stated explicitly because "which move
 * is this" is the first question asked of a pasted game.
 */
import type { GameAction, GameState, RecordedAction } from './types.js';
import { applyAction } from './ruleset.js';

const FILES = 'abcdefghi';
const RANKS = '123456789';

/**
 * Seat letters by seat index, matching the board palette: blue, red, green,
 * amber. Keep in step with `playerColors` in apps/mobile/src/theme.ts.
 */
const SEAT_LETTERS = 'BRGY';

/** Seat letter for a player index. Falls back to a digit past the alphabet. */
export function seatLetter(index: number): string {
  return index < SEAT_LETTERS.length ? SEAT_LETTERS[index] : String(index);
}

function file(col: number): string {
  return FILES[col] ?? '?';
}

function rank(row: number): string {
  return RANKS[row] ?? '?';
}

/** One move as short text, e.g. `Rd5` or `Hd4`. */
export function formatAction(
  action: RecordedAction['action'],
  playerIndex: number
): string {
  if (action.type === 'MOVE') return `${seatLetter(playerIndex)}${file(action.to.col)}${rank(action.to.row)}`;
  if (action.type === 'PLACE_WALL') {
    return `${action.wall.orientation}${file(action.wall.col)}${rank(action.wall.row)}`;
  }
  return action.type === 'RESIGN' ? 'resign' : 'timeout';
}

/**
 * A whole game as copyable text. Includes the mode, which seat letter is which
 * orb colour, and the final placements, because "who was which colour" is the
 * first thing needed to read a game at all.
 *
 * Plies are numbered from 0, counting from the blue orb's first move.
 */
export function formatGame(state: GameState): string {
  const indexOf = new Map(state.players.map((p, i) => [p.id, i]));
  const lines: string[] = [];
  lines.push(
    `DuoOrb ${state.mode} | ${state.players
      .map((p) => `${seatLetter(p.index)}=${p.displayName}`)
      .join(' ')} | ${state.status.toLowerCase()}`
  );
  const placements = state.players
    .filter((p) => p.place !== null)
    .map((p) => `${seatLetter(p.index)}:${p.place}`)
    .join(' ');
  if (placements) lines.push(`places ${placements}`);

  for (let i = 0; i < state.history.length; i++) {
    const entry = state.history[i];
    const idx = indexOf.get(entry.playerId);
    // The token is emitted verbatim. An earlier version tried to strip the seat
    // letter and re-prepend the seat, which silently turned a wall `He8` into
    // `Re8` — a legal-looking pawn move, i.e. corrupted games that still
    // replayed without complaint. Pawn tokens already carry their seat letter;
    // wall tokens carry H/V; the player id disambiguates the rest.
    lines.push(`${i}. ${formatAction(entry.action, idx ?? 0)} (${entry.playerId})`);
  }
  return lines.join('\n');
}

/** Single-line form, for a one-line paste. */
export function formatGameInline(state: GameState): string {
  const indexOf = new Map(state.players.map((p, i) => [p.id, i]));
  const moves = state.history
    .map((entry, i) => {
      const idx = indexOf.get(entry.playerId) ?? 0;
      return `${i}.${formatAction(entry.action, idx)}`;
    })
    .join(' ');
  return `DuoOrb ${state.mode} ${moves}`;
}

// ---------------------------------------------------------------------------
// Reading notation back
// ---------------------------------------------------------------------------

export interface ParsedMove {
  /** Seat letter as written, e.g. `R`. */
  seat: string;
  action: GameState['history'][number]['action'];
  /** The token exactly as it appeared, for error messages. */
  token: string;
}

export class NotationError extends Error {}

function colOf(fileChar: string): number {
  const i = FILES.indexOf(fileChar);
  if (i < 0) throw new NotationError(`bad file "${fileChar}"`);
  return i;
}

function rowOf(rankChar: string): number {
  const i = RANKS.indexOf(rankChar);
  if (i < 0) throw new NotationError(`bad rank "${rankChar}"`);
  return i;
}

/**
 * Parse one token such as `Rd5`, `Bd2`, `Hd4`, `Vg7`.
 *
 * A pawn move is identified by its seat letter, a wall by `H`/`V`, so the two
 * never collide: the seat alphabet and the wall markers share no characters.
 */
export function parseToken(token: string): ParsedMove {
  const t = token.trim();
  if (t.length < 3) throw new NotationError(`too short: "${token}"`);
  const head = t[0];
  const fileChar = t[1];
  const rankChar = t[2];
  if (head === 'H' || head === 'V') {
    return {
      seat: '',
      token,
      action: {
        type: 'PLACE_WALL',
        wall: {
          col: colOf(fileChar),
          row: rowOf(rankChar),
          orientation: head === 'H' ? 'H' : 'V',
        },
      },
    };
  }
  if (SEAT_LETTERS.indexOf(head) < 0) {
    throw new NotationError(`unknown piece "${head}" in "${token}"`);
  }
  return {
    seat: head,
    token,
    action: { type: 'MOVE', to: { col: colOf(fileChar), row: rowOf(rankChar) } },
  };
}

/**
 * Parse a whole pasted game. Tolerates the header lines `formatGame` writes,
 * zero- or one-based ply numbers, and the trailing `(playerId)` annotations.
 */
export function parseGame(text: string): ParsedMove[] {
  const out: ParsedMove[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^DuoOrb\b/.test(line)) continue;
    if (/^places\b/.test(line)) continue;
    // "0. Bd5 (p1)" -> "Bd5". The number is optional and ignored: the ply
    // order in the text is what matters, not the label on it.
    const match = line.match(/^(?:\d+\.)?\s*([A-Za-z][a-i][1-9])\b/);
    if (!match) {
      if (/^\d+\.$/.test(line)) continue;
      throw new NotationError(`cannot read move from "${line}"`);
    }
    out.push(parseToken(match[1]));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Notation -> position
// ---------------------------------------------------------------------------

export interface RebuildResult {
  state: GameState;
  /** Ply number (1-based) of the first move that would not apply, if any. */
  stoppedAt: number | null;
  /** Human-readable reason for stopping. */
  problem: string | null;
  /** Seat letter of the player to move at the stopping point. */
  stoppedSeat: string | null;
}

/**
 * Replay pasted notation onto an initial state and hand back a real GameState.
 *
 * This is the half that makes the feature worth having. A wall of tokens is not
 * much use on its own; a reconstructed position can be handed straight to
 * `evaluateState`, `readTacticalState`, `readStrategicState` or a search, so a
 * reported mistake can be reproduced and inspected instead of argued about.
 *
 * Stops at the first move the rules reject and says which ply that was, rather
 * than silently skipping: a notation typo must not masquerade as an engine
 * decision.
 */
export function rebuildFromNotation(initialState: GameState, text: string): RebuildResult {
  let moves: ParsedMove[];
  try {
    moves = parseGame(text);
  } catch (err) {
    return {
      state: initialState,
      stoppedAt: null,
      problem: err instanceof Error ? err.message : String(err),
      stoppedSeat: null,
    };
  }

  let state = initialState;
  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    // Trust the seat letter when it is present and the game agrees; otherwise
    // fall back to whoever the rules say is on move.
    const expected = state.players[state.currentPlayerIndex];
    if (move.seat && expected && move.seat !== seatLetter(expected.index)) {
      return {
        state,
        stoppedAt: i + 1,
        problem: `ply ${i + 1}: expected seat ${seatLetter(expected.index)} but the notation says ${move.seat}`,
        stoppedSeat: seatLetter(expected.index),
      };
    }
    const applied = applyAction(state, move.action);
    if (!applied.success) {
      return {
        state,
        stoppedAt: i + 1,
        problem: `ply ${i + 1}: ${move.token} is not legal here`,
        stoppedSeat: expected ? seatLetter(expected.index) : null,
      };
    }
    state = applied.state;
  }
  return { state, stoppedAt: null, problem: null, stoppedSeat: null };
}
