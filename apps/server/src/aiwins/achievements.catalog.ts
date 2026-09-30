/**
 * Achievement catalog: the single source of truth for hard-AI victory badges.
 *
 * Codes are stored in the database; names, descriptions and icons are resolved
 * here and returned by the API, so badge text can change without an app
 * update. Adding a catalog entry is safe at any time — awarding is driven by
 * `evaluateWins` in the service, and unevaluated codes simply never appear.
 */
export interface AchievementDef {
  code: string;
  name: string;
  description: string;
  /** Feather icon name rendered by the mobile client. */
  icon: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    code: 'giant-slayer',
    name: 'Giant Slayer',
    description: 'Beat the hard AI for the first time.',
    icon: 'award',
  },
  {
    code: 'blitzmind',
    name: 'Blitzmind',
    description: 'Beat the hard AI in a swift game.',
    icon: 'zap',
  },
  {
    code: 'unbreakable',
    name: 'Unbreakable',
    description: 'Beat the hard AI 10 times.',
    icon: 'shield',
  },
  {
    code: 'arena-master',
    name: 'Arena Master',
    description: 'Beat the hard AI outside classic 1v1.',
    icon: 'crown',
  },
];

/** Showcase slots on a profile. Three badges max. */
export const BADGE_SLOTS = 3;

/** Plies at or below which a hard win counts as swift, per mode shape. */
export function swiftPliesFor(mode: string): number {
  return mode === '2p' ? 32 : 64;
}

/** Wins at or above which the grinder badge is earned. */
export const GRINDER_WINS = 10;

export function achievementByCode(code: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.code === code);
}
