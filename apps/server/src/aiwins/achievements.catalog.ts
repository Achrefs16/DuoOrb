/**
 * Achievement catalog: the single source of truth for every badge.
 *
 * Codes are stored in the database; names, descriptions, requirements,
 * icons, tiers and categories are resolved here and returned by the API,
 * so badge text can change without an app update. Adding a catalog entry
 * is safe at any time — awarding is driven by `evaluateWins` (hard-AI
 * victories) and `evaluateOnlineGame` (ranked online games) in the
 * service, and unevaluated codes simply never appear.
 *
 * Counting rule for hard-AI badges (the original point of this file): only
 * UNIQUE hard-AI winning sequences count, per account. Easy, Normal, local
 * and online games never reach that system.
 *
 * Online badges (streak / rank / milestone) are evaluated after every
 * ranked game completes, from the ledger (rating row + finished games).
 * Once earned a badge is kept forever, even if form dips afterwards.
 */

export type AchievementCategory = 'streak' | 'rank' | 'milestone' | 'mastery';

/** Metal ladder, bronze → diamond. Drives the medallion colors client-side. */
export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

/**
 * Which ledger stat a badge tracks, for locked-badge progress bars.
 * `bestRank` and `streak` are lower-is-better / current-value; everything
 * else is higher-is-better lifetime totals (rating is the current value).
 */
export type AchievementStat =
  | 'streak'
  | 'bestRank'
  | 'rankedGames'
  | 'rankedWins'
  | 'rating'
  | 'hardWins';

export interface AchievementDef {
  code: string;
  name: string;
  description: string;
  /** How to earn it, shown in the badge detail view. */
  requirement: string;
  /** Feather icon name rendered by the mobile client. */
  icon: string;
  category: AchievementCategory;
  tier: AchievementTier;
  /** Ledger stat + value that earns it. Absent for one-off badges. */
  stat?: AchievementStat;
  target?: number;
  /**
   * Visible in the catalog but NOT awarded yet. Rank badges ship disabled:
   * with a small player count almost everyone is inside the top 1000, so
   * awarding them would hand out diamonds for free and dilute the ladder.
   * Flipping one on is a one-word change here — no client work, no schema
   * change, and previously unearned codes start awarding immediately.
   */
  comingSoon?: boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // ------------------------------------------------------------------
  // WIN STREAKS — consecutive ranked online wins. A draw never breaks a
  // streak; any loss resets the count.
  // ------------------------------------------------------------------
  {
    code: 'streak-5',
    name: 'Hot Streak',
    description: 'Five ranked wins in a row. The board is noticing.',
    requirement: 'Win 5 ranked online games in a row.',
    icon: 'trending-up',
    category: 'streak',
    tier: 'bronze',
    stat: 'streak',
    target: 5,
  },
  {
    code: 'streak-10',
    name: 'Unstoppable',
    description: 'Ten ranked wins in a row. Queues fear this account.',
    requirement: 'Win 10 ranked online games in a row.',
    icon: 'zap',
    category: 'streak',
    tier: 'silver',
    stat: 'streak',
    target: 10,
  },
  {
    code: 'streak-15',
    name: 'Rampage',
    description: 'Fifteen ranked wins in a row. Every lobby is a highlight.',
    requirement: 'Win 15 ranked online games in a row.',
    icon: 'activity',
    category: 'streak',
    tier: 'gold',
    stat: 'streak',
    target: 15,
  },
  {
    code: 'streak-30',
    name: 'Immortal',
    description: 'Thirty ranked wins in a row. Almost nobody gets here.',
    requirement: 'Win 30 ranked online games in a row.',
    icon: 'star',
    category: 'streak',
    tier: 'platinum',
    stat: 'streak',
    target: 30,
  },
  {
    code: 'streak-50',
    name: 'Mythic',
    description: 'Fifty ranked wins in a row. A season for the record books.',
    requirement: 'Win 50 ranked online games in a row.',
    icon: 'award',
    category: 'streak',
    tier: 'diamond',
    stat: 'streak',
    target: 50,
  },
  // ------------------------------------------------------------------
  // BOARD RANKS — best leaderboard position ever reached (ranked
  // accounts only; guests never appear on the board).
  // ------------------------------------------------------------------
  {
    code: 'rank-1000',
    name: 'Rising Threat',
    description: 'Cracked the top 1000 on the global board.',
    requirement: 'Reach a top-1000 leaderboard rank.',
    icon: 'chevron-up',
    category: 'rank',
    tier: 'bronze',
    stat: 'bestRank',
    target: 1000,
    comingSoon: true,
  },
  {
    code: 'rank-100',
    name: 'Contender',
    description: 'Cracked the top 100 on the global board.',
    requirement: 'Reach a top-100 leaderboard rank.',
    icon: 'chevrons-up',
    category: 'rank',
    tier: 'silver',
    stat: 'bestRank',
    target: 100,
    comingSoon: true,
  },
  {
    code: 'rank-50',
    name: 'Elite',
    description: 'Cracked the top 50 on the global board.',
    requirement: 'Reach a top-50 leaderboard rank.',
    icon: 'arrow-up',
    category: 'rank',
    tier: 'gold',
    stat: 'bestRank',
    target: 50,
    comingSoon: true,
  },
  {
    code: 'rank-10',
    name: 'Master',
    description: 'Cracked the top 10 on the global board.',
    requirement: 'Reach a top-10 leaderboard rank.',
    icon: 'shield',
    category: 'rank',
    tier: 'platinum',
    stat: 'bestRank',
    target: 10,
    comingSoon: true,
  },
  {
    code: 'rank-5',
    name: 'Grandmaster',
    description: 'Cracked the top 5 on the global board.',
    requirement: 'Reach a top-5 leaderboard rank.',
    icon: 'star',
    category: 'rank',
    tier: 'platinum',
    stat: 'bestRank',
    target: 5,
    comingSoon: true,
  },
  {
    code: 'rank-3',
    name: 'Podium',
    description: 'One of the three best-rated players in the world.',
    requirement: 'Reach a top-3 leaderboard rank.',
    icon: 'award',
    category: 'rank',
    tier: 'diamond',
    stat: 'bestRank',
    target: 3,
    comingSoon: true,
  },
  {
    code: 'rank-1',
    name: 'Apex',
    description: 'The single best-rated player in the world.',
    requirement: 'Reach rank #1 on the leaderboard.',
    icon: 'crown',
    category: 'rank',
    tier: 'diamond',
    stat: 'bestRank',
    target: 1,
    comingSoon: true,
  },
  // ------------------------------------------------------------------
  // MILESTONES — ranked online totals and rating thresholds.
  // ------------------------------------------------------------------
  {
    code: 'first-blood',
    name: 'First Blood',
    description: 'Your first ranked online win. Many more to come.',
    requirement: 'Win 1 ranked online game.',
    icon: 'droplet',
    category: 'milestone',
    tier: 'bronze',
    stat: 'rankedWins',
    target: 1,
  },
  {
    code: 'games-10',
    name: 'Warming Up',
    description: 'Ten ranked games played. The rust is off.',
    requirement: 'Play 10 ranked online games.',
    icon: 'play',
    category: 'milestone',
    tier: 'bronze',
    stat: 'rankedGames',
    target: 10,
  },
  {
    code: 'games-50',
    name: 'Grinder',
    description: 'Fifty ranked games played. A fixture of the queue.',
    requirement: 'Play 50 ranked online games.',
    icon: 'repeat',
    category: 'milestone',
    tier: 'silver',
    stat: 'rankedGames',
    target: 50,
  },
  {
    code: 'games-100',
    name: 'Centurion',
    description: 'One hundred ranked games played.',
    requirement: 'Play 100 ranked online games.',
    icon: 'layers',
    category: 'milestone',
    tier: 'gold',
    stat: 'rankedGames',
    target: 100,
  },
  {
    code: 'games-250',
    name: 'Marathon',
    description: 'Two hundred fifty ranked games played. Relentless.',
    requirement: 'Play 250 ranked online games.',
    icon: 'flag',
    category: 'milestone',
    tier: 'platinum',
    stat: 'rankedGames',
    target: 250,
  },
  {
    code: 'wins-25',
    name: 'Sharpshooter',
    description: 'Twenty-five ranked online wins.',
    requirement: 'Win 25 ranked online games.',
    icon: 'crosshair',
    category: 'milestone',
    tier: 'silver',
    stat: 'rankedWins',
    target: 25,
  },
  {
    code: 'wins-100',
    name: 'Warlord',
    description: 'One hundred ranked online wins.',
    requirement: 'Win 100 ranked online games.',
    icon: 'target',
    category: 'milestone',
    tier: 'gold',
    stat: 'rankedWins',
    target: 100,
  },
  {
    code: 'rating-1600',
    name: 'Breakthrough',
    description: 'Pushed past 1600 rating. Above the starting crowd.',
    requirement: 'Reach 1600 rating in ranked play.',
    icon: 'trending-up',
    category: 'milestone',
    tier: 'silver',
    stat: 'rating',
    target: 1600,
  },
  {
    code: 'rating-1800',
    name: 'Specialist',
    description: 'Pushed past 1800 rating. Genuinely dangerous.',
    requirement: 'Reach 1800 rating in ranked play.',
    icon: 'chevrons-up',
    category: 'milestone',
    tier: 'gold',
    stat: 'rating',
    target: 1800,
  },
  {
    code: 'rating-2000',
    name: 'Expert',
    description: 'Pushed past 2000 rating. The top fraction of players.',
    requirement: 'Reach 2000 rating in ranked play.',
    icon: 'award',
    category: 'milestone',
    tier: 'platinum',
    stat: 'rating',
    target: 2000,
  },
  {
    code: 'rating-2200',
    name: 'Virtuoso',
    description: 'Pushed past 2200 rating. Masterclass territory.',
    requirement: 'Reach 2200 rating in ranked play.',
    icon: 'crown',
    category: 'milestone',
    tier: 'diamond',
    stat: 'rating',
    target: 2200,
  },
  // ------------------------------------------------------------------
  // AI MASTERY — unique verified wins against the Hard AI.
  // ------------------------------------------------------------------
  {
    code: 'giant-slayer',
    name: 'Giant Slayer',
    description: 'Your first unique win against the Hard AI.',
    requirement: 'Record 1 unique win against Hard AI.',
    icon: 'award',
    category: 'mastery',
    tier: 'bronze',
    stat: 'hardWins',
    target: 1,
  },
  {
    code: 'challenger',
    name: 'Challenger',
    description: 'Five different ways past the Hard AI.',
    requirement: 'Record 5 unique wins against Hard AI.',
    icon: 'star',
    category: 'mastery',
    tier: 'silver',
    stat: 'hardWins',
    target: 5,
  },
  {
    code: 'unbreakable',
    name: 'Unbreakable',
    description: 'Ten different ways past the Hard AI.',
    requirement: 'Record 10 unique wins against Hard AI.',
    icon: 'shield',
    category: 'mastery',
    tier: 'gold',
    stat: 'hardWins',
    target: 10,
  },
  {
    code: 'veteran',
    name: 'Veteran',
    description: 'Fifteen different ways past the Hard AI.',
    requirement: 'Record 15 unique wins against Hard AI.',
    icon: 'flag',
    category: 'mastery',
    tier: 'gold',
    stat: 'hardWins',
    target: 15,
  },
  {
    code: 'champion',
    name: 'Champion',
    description: 'Thirty different ways past the Hard AI.',
    requirement: 'Record 30 unique wins against Hard AI.',
    icon: 'crown',
    category: 'mastery',
    tier: 'platinum',
    stat: 'hardWins',
    target: 30,
  },
  {
    code: 'legend',
    name: 'Legend',
    description: 'Fifty different ways past the Hard AI. Almost nobody gets here.',
    requirement: 'Record 50 unique wins against Hard AI.',
    icon: 'sun',
    category: 'mastery',
    tier: 'diamond',
    stat: 'hardWins',
    target: 50,
  },
  {
    code: 'blitzmind',
    name: 'Blitzmind',
    description: 'A swift kill against the Hard AI.',
    requirement: 'Beat Hard AI in 32 moves or fewer (classic 1v1).',
    icon: 'zap',
    category: 'mastery',
    tier: 'gold',
  },
  {
    code: 'arena-master',
    name: 'Arena Master',
    description: 'Conquered the Hard AI outside classic 1v1.',
    requirement: 'Beat Hard AI in any mode other than 2p.',
    icon: 'globe',
    category: 'mastery',
    tier: 'platinum',
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

/** Ranked win-streak thresholds, in award order. */
export const STREAK_MILESTONES: { code: string; at: number }[] = [
  { code: 'streak-5', at: 5 },
  { code: 'streak-10', at: 10 },
  { code: 'streak-15', at: 15 },
  { code: 'streak-30', at: 30 },
  { code: 'streak-50', at: 50 },
];

/** Leaderboard-rank thresholds (position at or better), in award order. */
export const RANK_MILESTONES: { code: string; at: number }[] = [
  { code: 'rank-1000', at: 1000 },
  { code: 'rank-100', at: 100 },
  { code: 'rank-50', at: 50 },
  { code: 'rank-10', at: 10 },
  { code: 'rank-5', at: 5 },
  { code: 'rank-3', at: 3 },
  { code: 'rank-1', at: 1 },
];

/**
 * Badge codes the award engine must never grant. Not persisted, not
 * configurable at runtime: keeping it a pure function of the catalog
 * means enabling a ladder can never disagree with what the catalog shows.
 */
export function isAwardable(code: string): boolean {
  return achievementByCode(code)?.comingSoon !== true;
}

/** Ranked-games-played milestones, in award order. */
export const GAMES_MILESTONES: { code: string; at: number }[] = [
  { code: 'games-10', at: 10 },
  { code: 'games-50', at: 50 },
  { code: 'games-100', at: 100 },
  { code: 'games-250', at: 250 },
];

/** Ranked-online-win milestones, in award order. */
export const ONLINE_WIN_MILESTONES: { code: string; at: number }[] = [
  { code: 'first-blood', at: 1 },
  { code: 'wins-25', at: 25 },
  { code: 'wins-100', at: 100 },
];

/** Rating thresholds, in award order. */
export const RATING_MILESTONES: { code: string; at: number }[] = [
  { code: 'rating-1600', at: 1600 },
  { code: 'rating-1800', at: 1800 },
  { code: 'rating-2000', at: 2000 },
  { code: 'rating-2200', at: 2200 },
];

/** Plies at or below which a hard win counts as swift, per mode shape. */
export function swiftPliesFor(mode: string): number {
  return mode === '2p' ? 32 : 64;
}

export function achievementByCode(code: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.code === code);
}
