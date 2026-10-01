/**
 * DuoOrb AI - Public API & Re-exports
 *
 * The AI engine has been modularised into `src/ai/`:
 * - types.ts: AI profiles, search context, and tactical types
 * - constants.ts: weights, constants, and profiles
 * - zobrist.ts: fast 64-bit Zobrist hashing for TT
 * - evaluation.ts: state scoring, outcome-aware race, trap penalties
 * - tactics.ts: tactical reads, immediate win/block detection
 * - candidates.ts: root and search candidate generation
 * - search.ts: alpha-beta / PVS search and TT management
 * - ranking.ts: candidate scoring, exchange re-ranking, and clamps
 * - engine.ts: public entrypoints (getBestAction, getBestActionAsync)
 */

export * from './ai/index.js';
