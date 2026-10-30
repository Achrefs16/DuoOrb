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

export type AchievementCategory =
  | 'bot'
  | 'battle'
  | 'tactics'
  | 'social'
  | 'streak'
  | 'milestone'
  | 'rank'
  | 'mastery';

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
  | 'hardWins'
  | 'botStars';

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
  // ------------------------------------------------------------------
  // BOT MASTERY — Bot personalities, Bot Stars, and tier milestones.
  // ------------------------------------------------------------------
  {
    code: 'bot-first-win',
    name: 'Robo Buster',
    description: 'Your first victory against a bot personality.',
    requirement: 'Defeat 1 bot personality.',
    icon: 'award',
    category: 'bot',
    tier: 'bronze',
  },
  {
    code: 'bot-stars-10',
    name: 'Rising Apprentice',
    description: 'Ten Bot Stars collected across the roster.',
    requirement: 'Earn 10 total Bot Stars.',
    icon: 'star',
    category: 'bot',
    tier: 'bronze',
    stat: 'botStars',
    target: 10,
  },
  {
    code: 'bot-stars-30',
    name: 'Star Collector',
    description: 'Thirty Bot Stars collected across the roster.',
    requirement: 'Earn 30 total Bot Stars.',
    icon: 'star',
    category: 'bot',
    tier: 'silver',
    stat: 'botStars',
    target: 30,
  },
  {
    code: 'bot-stars-60',
    name: 'Galaxy Brain',
    description: 'Sixty Bot Stars collected across the roster.',
    requirement: 'Earn 60 total Bot Stars.',
    icon: 'shield',
    category: 'bot',
    tier: 'gold',
    stat: 'botStars',
    target: 60,
  },
  {
    code: 'bot-stars-100',
    name: 'Cosmic Master',
    description: 'One hundred Bot Stars collected. Pure robotic domination.',
    requirement: 'Earn 100 total Bot Stars.',
    icon: 'sun',
    category: 'bot',
    tier: 'diamond',
    stat: 'botStars',
    target: 100,
  },
  {
    code: 'bot-tier-beginner',
    name: 'Grade Schooler',
    description: 'Every Beginner bot defeated. The fundamentals are locked in.',
    requirement: 'Defeat all 9 Beginner bots.',
    icon: 'check-circle',
    category: 'bot',
    tier: 'bronze',
  },
  {
    code: 'bot-tier-inter',
    name: 'Tactician',
    description: 'Every Intermediate bot defeated. Tricky lines no longer surprise you.',
    requirement: 'Defeat all 13 Intermediate bots.',
    icon: 'layers',
    category: 'bot',
    tier: 'silver',
  },
  {
    code: 'bot-tier-master',
    name: 'Dragon Tamer',
    description: 'Every Master bot defeated. You stand at the gates of greatness.',
    requirement: 'Defeat all 10 Master bots.',
    icon: 'crown',
    category: 'bot',
    tier: 'gold',
  },
  {
    code: 'bot-tier-gm',
    name: 'Grandmaster Bane',
    description: 'Every Grandmaster bot humbled, including the strongest engines.',
    requirement: 'Defeat all 7 Grandmaster bots.',
    icon: 'award',
    category: 'bot',
    tier: 'diamond',
  },
  {
    code: 'bot-flawless-achref',
    name: 'Architect of Victory',
    description: 'Defeated Achref (2400) with 3 stars. No hints, no undos, pure mastery.',
    requirement: 'Earn 3 stars against Achref.',
    icon: 'zap',
    category: 'bot',
    tier: 'platinum',
  },
  {
    code: 'bot-flawless-milo',
    name: 'The Final Boss',
    description: 'Defeated Milo (2900) with 3 stars. The peak of DuoOrb puzzle power.',
    requirement: 'Earn 3 stars against Milo.',
    icon: 'sun',
    category: 'bot',
    tier: 'diamond',
  },
  // ------------------------------------------------------------------
  // BATTLE MODES — Center Rush, Race mode, 4-Player, and wall variants.
  // ------------------------------------------------------------------
  {
    code: 'mode-center-first',
    name: 'Bullseye',
    description: 'Your first Center Rush victory. Rushed straight to the heart.',
    requirement: 'Win 1 Center Rush match.',
    icon: 'target',
    category: 'battle',
    tier: 'bronze',
  },
  {
    code: 'mode-center-10',
    name: 'Core Commander',
    description: 'Ten Center Rush victories. The center is your home.',
    requirement: 'Win 10 Center Rush matches.',
    icon: 'crosshair',
    category: 'battle',
    tier: 'silver',
  },
  {
    code: 'mode-race-first',
    name: 'Sprint Specialist',
    description: 'Your first Race mode victory. Fast feet, no looking back.',
    requirement: 'Win 1 Race match.',
    icon: 'activity',
    category: 'battle',
    tier: 'bronze',
  },
  {
    code: 'mode-race-10',
    name: 'Velocity Demon',
    description: 'Ten Race mode victories. Nobody catches you.',
    requirement: 'Win 10 Race matches.',
    icon: 'trending-up',
    category: 'battle',
    tier: 'silver',
  },
  {
    code: 'mode-multi-podium',
    name: 'Full House',
    description: 'Took 1st place in a chaotic 4-player match.',
    requirement: 'Win a 4-player game.',
    icon: 'grid',
    category: 'battle',
    tier: 'gold',
  },
  {
    code: 'mode-walls-99',
    name: 'Labyrinth Architect',
    description: 'Won a match with 99 walls configured. A maze of your own making.',
    requirement: 'Win a match with 99 walls.',
    icon: 'shield',
    category: 'battle',
    tier: 'silver',
  },
  // ------------------------------------------------------------------
  // TACTICAL PLAY — Game Review, Move Quality & Clean Games.
  // ------------------------------------------------------------------
  {
    code: 'analysis-first',
    name: 'Post-Mortem',
    description: 'Reviewed and analyzed your first completed match.',
    requirement: 'Analyze 1 match with the game review engine.',
    icon: 'search',
    category: 'tactics',
    tier: 'bronze',
  },
  {
    code: 'analysis-clean',
    name: 'Flawless Game',
    description: 'Completed a match with 0 Blunders and 0 Mistakes (minimum 15 plies).',
    requirement: 'Finish a game with 0 blunders and 0 mistakes.',
    icon: 'check-circle',
    category: 'tactics',
    tier: 'silver',
  },
  {
    code: 'analysis-brilliant',
    name: 'Spark of Genius',
    description: 'Executed a move rated as Brilliant (!!) by the analysis engine.',
    requirement: 'Find 1 Brilliant move in game analysis.',
    icon: 'zap',
    category: 'tactics',
    tier: 'gold',
  },
  // ------------------------------------------------------------------
  // SOCIAL & STYLE — Friends, Challenges, Locker & Showcase.
  // ------------------------------------------------------------------
  {
    code: 'social-first-friend',
    name: 'Better Together',
    description: 'Added your first friend to your DuoOrb network.',
    requirement: 'Have at least 1 friend.',
    icon: 'users',
    category: 'social',
    tier: 'bronze',
  },
  {
    code: 'social-friend-duel',
    name: 'Friendly Rivalry',
    description: 'Completed a direct challenge match against a friend.',
    requirement: 'Play a match against a friend.',
    icon: 'activity',
    category: 'social',
    tier: 'bronze',
  },
  {
    code: 'cosmetic-custom',
    name: 'In Style',
    description: 'Equipped a custom ball or wall skin from the locker.',
    requirement: 'Equip any non-default cosmetic skin.',
    icon: 'sliders',
    category: 'social',
    tier: 'bronze',
  },
  {
    code: 'showcase-full',
    name: 'Medaled Up',
    description: 'Equipped 3 earned badges to your profile showcase.',
    requirement: 'Equip 3 badges on your profile.',
    icon: 'award',
    category: 'social',
    tier: 'bronze',
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

/** Bot Star thresholds, in award order. */
export const BOT_STAR_MILESTONES: { code: string; at: number }[] = [
  { code: 'bot-stars-10', at: 10 },
  { code: 'bot-stars-30', at: 30 },
  { code: 'bot-stars-60', at: 60 },
  { code: 'bot-stars-100', at: 100 },
];

export const BEGINNER_BOT_IDS = [
  'martin', 'pip', 'elias', 'barnaby', 'finn', 'clara', 'leo', 'tariq', 'ren',
];
export const INTERMEDIATE_BOT_IDS = [
  'bram', 'nelson', 'vex', 'jamal', 'mateo', 'zara', 'archimedes', 'fiona', 'dmitri', 'layla', 'dante', 'meiling', 'amara',
];
export const MASTER_BOT_IDS = [
  'marcus', 'viktor', 'gideon', 'sora', 'samira', 'torstein', 'kofi', 'diego', 'hassan', 'jin',
];
export const GRANDMASTER_BOT_IDS = [
  'achref', 'sterling', 'kenzo', 'valeria', 'nexus9', 'boba', 'milo',
];

/** Plies at or below which a hard win counts as swift, per mode shape. */
export function swiftPliesFor(mode: string): number {
  return mode === '2p' ? 32 : 64;
}

export function achievementByCode(code: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.code === code);
}
