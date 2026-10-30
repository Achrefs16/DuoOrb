/**
 * Bot mastery is assist-based: a clean win is the feat, not the margin.
 * Hints and undos both count as assists, and a hint counts as soon as it is
 * shown — following it is irrelevant.
 */
export function computeBotStars(assistsUsed: number): 1 | 2 | 3 {
  const assists = Number.isFinite(assistsUsed) ? Math.max(0, Math.floor(assistsUsed)) : 0;
  if (assists === 0) return 3;
  if (assists === 1) return 2;
  return 1;
}
