import type { AIProfile } from './types.js';

/**
 * Named bot personalities (MONETIZATION.md P4.1).
 *
 * The free game keeps the three generic difficulties (Easy 1200 / Normal 1500
 * / Hard 1800 — never gated). Premium unlocks this cast: each entry is a full
 * AIProfile (depth / randomness / weights / wall budget), so personalities
 * differ in HOW they play, not just how strongly. `difficulty` stays one of
 * the engine tiers because productionBudget() keys its wall-clock ceilings
 * off it; the character comes from the tuned parameters around it.
 *
 * UI reads: id (stable, stored in game config), name + title + elo (cards),
 * color + avatarGlyph (orb + avatar), style (one-line flavor), banter
 * (reaction taunts/praise mapped onto the existing dock mechanism).
 */

export interface BotPersonality {
  id: string;
  name: string;
  title: string;
  elo: number;
  profile: AIProfile;
  /** Orb tint for the seat card + avatar. */
  color: string;
  /** Single glyph rendered inside the avatar orb. */
  avatarGlyph: string;
  /** One-line flavor shown under the name. */
  style: string;
  banter: {
    taunt: string[];
    praise: string[];
  };
  premium: boolean;
}

function weights(over: Partial<AIProfile['weights']>, base: AIProfile['weights']): AIProfile['weights'] {
  return { ...base, ...over };
}

const EASY_W = {
  pathDifference: 8.0,
  wallAdvantage: 0.5,
  mobility: 0.2,
  pathways: 0.35,
  tightness: 0.4,
  placement: 1.0,
} as const;

const NORMAL_W = {
  pathDifference: 10.0,
  wallAdvantage: 1.0,
  mobility: 0.5,
  pathways: 0.6,
  tightness: 0.8,
  placement: 1.5,
} as const;

const HARD_W = {
  pathDifference: 12.0,
  wallAdvantage: 1.5,
  mobility: 0.8,
  pathways: 0.9,
  tightness: 1.2,
  placement: 2.0,
} as const;

export const BOT_ROSTER: BotPersonality[] = [
  {
    id: 'pip',
    name: 'Pip',
    title: 'The Chaotic Learner',
    elo: 900,
    profile: {
      difficulty: 'easy',
      depth: 1,
      randomness: 0.5,
      weights: weights({ mobility: 0.6, tightness: 0.1 }, EASY_W),
      maxCandidateWalls: 2,
      timeBudgetMs: 20,
    },
    color: '#22C55E',
    avatarGlyph: '✦',
    style: 'Wanders, wonders, occasionally stumbles into brilliance.',
    banter: {
      taunt: ['That was… a choice!', 'Ooh, risky. I like it.'],
      praise: ['Whoa, nice one!', 'Teach me that someday.'],
    },
    premium: true,
  },
  {
    id: 'bram',
    name: 'Bram',
    title: 'The Builder',
    elo: 1350,
    profile: {
      difficulty: 'normal',
      depth: 2,
      randomness: 0.08,
      weights: weights({ wallAdvantage: 2.2, tightness: 1.1, placement: 2.0 }, NORMAL_W),
      maxCandidateWalls: 8,
      timeBudgetMs: 50,
    },
    color: '#F59E0B',
    avatarGlyph: '⬢',
    style: 'Wall-happy: would rather build than run.',
    banter: {
      taunt: ['Brick by brick.', 'Hope you like walls.'],
      praise: ['Clean pathing. Respect.', 'You run well.'],
    },
    premium: true,
  },
  {
    id: 'vex',
    name: 'Vex',
    title: 'The Trickster',
    elo: 1600,
    profile: {
      difficulty: 'normal',
      depth: 2,
      randomness: 0.22,
      weights: weights({ tightness: 1.4, mobility: 0.9, pathDifference: 9.0 }, NORMAL_W),
      maxCandidateWalls: 6,
      timeBudgetMs: 60,
    },
    color: '#A855F7',
    avatarGlyph: '✧',
    style: 'Unpredictable by design. Trust nothing.',
    banter: {
      taunt: ['Didn’t see that coming, did you?', 'Chaos is a strategy.'],
      praise: ['Okay, that was clever.', 'You adapt fast. Noted.'],
    },
    premium: true,
  },
  {
    id: 'sage',
    name: 'Sage',
    title: 'The Positional',
    elo: 1750,
    profile: {
      difficulty: 'hard',
      depth: 3,
      randomness: 0.0,
      weights: weights({ pathways: 1.4, mobility: 1.2, wallAdvantage: 1.2 }, HARD_W),
      maxCandidateWalls: 8,
      timeBudgetMs: 120,
    },
    color: '#0EA5E9',
    avatarGlyph: '◈',
    style: 'Quiet moves, deep plans. No noise.',
    banter: {
      taunt: ['Patience wins.', 'Every wall has a purpose.'],
      praise: ['Sound play.', 'You see the board. Good.'],
    },
    premium: true,
  },
  {
    id: 'mab',
    name: 'Queen Mab',
    title: 'The Aggressor',
    elo: 1950,
    profile: {
      difficulty: 'hard',
      depth: 3,
      randomness: 0.0,
      weights: weights({ pathDifference: 14.0, wallAdvantage: 2.0, placement: 2.4 }, HARD_W),
      maxCandidateWalls: 10,
      timeBudgetMs: 140,
    },
    color: '#EF4444',
    avatarGlyph: '♛',
    style: 'Relentless pressure from move one.',
    banter: {
      taunt: ['No hiding.', 'I smell hesitation.'],
      praise: ['You survived that. Impressive.', 'A worthy defense.'],
    },
    premium: true,
  },
  {
    id: 'clockmaker',
    name: 'The Clockmaker',
    title: 'The Patient Machine',
    elo: 2100,
    profile: {
      difficulty: 'hard',
      depth: 4,
      randomness: 0.0,
      weights: weights({ pathDifference: 13.0, tightness: 1.8, pathways: 1.2 }, HARD_W),
      maxCandidateWalls: 10,
      timeBudgetMs: 200,
    },
    color: '#64748B',
    avatarGlyph: '◷',
    style: 'Sees further than you. Plans accordingly.',
    banter: {
      taunt: ['Tick. Tock.', 'I calculated this an hour ago.'],
      praise: ['An elegant line. Rare.', 'You nearly had me. Nearly.'],
    },
    premium: true,
  },
];

export function botById(id: string | null | undefined): BotPersonality | null {
  if (!id) return null;
  return BOT_ROSTER.find((b) => b.id === id) ?? null;
}

/** Premium roster sorted weakest-first for the selection cards. */
export function botLadder(): BotPersonality[] {
  return [...BOT_ROSTER].sort((a, b) => a.elo - b.elo);
}
