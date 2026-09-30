/**
 * Achievement catalog: the single source of truth for hard-AI victory badges.
 *
 * Codes are stored in the database; names, descriptions, requirements and
 * icons are resolved here and returned by the API, so badge text can change
 * without an app update. Adding a catalog entry is safe at any time —
 * awarding is driven by `evaluateWins` in the service, and unevaluated codes
 * simply never appear.
 *
 * Counting rule (the whole point of this file): only UNIQUE hard-AI winning
 * sequences count, per account. Easy, Normal, local and online games never
 * reach this system — the upload endpoint rejects non-hard difficulties and
 * the app only reports hard-AI wins. Replaying an identical winning sequence
 * stores nothing and earns nothing; another account using the same sequence
 * is irrelevant to yours.
 */
export interface AchievementDef {
  code: string;
  name: string;
  description: string;
  /** How to earn it, shown in the badge detail view. */
  requirement: string;
  /** Feather icon name rendered by the mobile client. */
  icon: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    code: 'giant-slayer',
    name: 'Giant Slayer',
    description: 'Your first unique win against the Hard AI.',
    requirement: 'Record 1 unique win against Hard AI.',
    icon: 'award',
  },
  {
    code: 'challenger',
    name: 'Challenger',
    description: 'Five different ways past the Hard AI.',
    requirement: 'Record 5 unique wins against Hard AI.',
    icon: 'star',
  },
  {
    code: 'unbreakable',
    name: 'Unbreakable',
    description: 'Ten different ways past the Hard AI.',
    requirement: 'Record 10 unique wins against Hard AI.',
    icon: 'shield',
  },
  {
    code: 'veteran',
    name: 'Veteran',
    description: 'Fifteen different ways past the Hard AI.',
    requirement: 'Record 15 unique wins against Hard AI.',
    icon: 'flag',
  },
  {
    code: 'champion',
    name: 'Champion',
    description: 'Thirty different ways past the Hard AI.',
    requirement: 'Record 30 unique wins against Hard AI.',
    icon: 'crown',
  },
  {
    code: 'legend',
    name: 'Legend',
    description: 'Fifty different ways past the Hard AI. Almost nobody gets here.',
    requirement: 'Record 50 unique wins against Hard AI.',
    icon: 'sun',
  },
  {
    code: 'blitzmind',
    name: 'Blitzmind',
    description: 'A swift kill against the Hard AI.',
    requirement: 'Beat Hard AI in 32 moves or fewer (classic 1v1).',
    icon: 'zap',
  },
  {
    code: 'arena-master',
    name: 'Arena Master',
    description: 'Conquered the Hard AI outside classic 1v1.',
    requirement: 'Beat Hard AI in any mode other than 2p.',
    icon: 'globe',
  },
];

/** Showcase slots on a profile. Three badges max. */
export const BADGE_SLOTS = 3;

/** Unique-win milestones, in award order. */
export const WIN_MILESTONES: { code: string; at: number }[] = [
  { code: 'giant-slayer', at: 1 },
  { code: 'challenger', at: 5 },
  { code: 'unbreakable', at: 10 },
  { code: 'veteran', at: 15 },
  { code: 'champion', at: 30 },
  { code: 'legend', at: 50 },
];

/** Plies at or below which a hard win counts as swift, per mode shape. */
export function swiftPliesFor(mode: string): number {
  return mode === '2p' ? 32 : 64;
}

export function achievementByCode(code: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.code === code);
}
