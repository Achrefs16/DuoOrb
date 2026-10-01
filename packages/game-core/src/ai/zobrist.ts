import type { GameState } from '../types.js';

// Deterministic 64-bit random table for Zobrist hashing.
// Eliminates string allocations inside searchNode transposition lookups.

class PRNG {
  private s: bigint;
  constructor(seed: bigint = 0x853c49e6748fea9bFn) {
    this.s = seed;
  }
  next(): bigint {
    this.s = (this.s + 0x9e3779b97f4a7c15n) & 0xffffffffffffffffn;
    let z = this.s;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & 0xffffffffffffffffn;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & 0xffffffffffffffffn;
    return (z ^ (z >> 31n)) & 0xffffffffffffffffn;
  }
}

const rng = new PRNG();

// 4 players * 81 cells
const PLAYER_POS_KEYS: bigint[][] = Array.from({ length: 4 }, () =>
  Array.from({ length: 81 }, () => rng.next())
);

// 4 players * 11 wall counts
const PLAYER_WALL_KEYS: bigint[][] = Array.from({ length: 4 }, () =>
  Array.from({ length: 12 }, () => rng.next())
);

// 8 * 8 * 2 wall slots: row * 16 + col * 2 + (orientation === 'V' ? 1 : 0)
const WALL_KEYS: bigint[] = Array.from({ length: 128 }, () => rng.next());

// 4 current player indices
const TURN_KEYS: bigint[] = Array.from({ length: 4 }, () => rng.next());

export function computeZobristHash(state: GameState): bigint {
  let hash = 0n;
  hash ^= TURN_KEYS[state.currentPlayerIndex % 4];

  for (let i = 0; i < state.players.length && i < 4; i++) {
    const p = state.players[i];
    if (p.status === 'ACTIVE') {
      const cellIdx = p.position.row * 9 + p.position.col;
      if (cellIdx >= 0 && cellIdx < 81) {
        hash ^= PLAYER_POS_KEYS[i][cellIdx];
      }
      const walls = Math.max(0, Math.min(11, p.wallsRemaining));
      hash ^= PLAYER_WALL_KEYS[i][walls];
    }
  }

  for (const w of state.walls) {
    const slotIdx = w.row * 16 + w.col * 2 + (w.orientation === 'V' ? 1 : 0);
    if (slotIdx >= 0 && slotIdx < 128) {
      hash ^= WALL_KEYS[slotIdx];
    }
  }

  return hash;
}
