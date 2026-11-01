import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const REVIEWER_USER_ID = 'e0000000-0000-4000-8000-000000000001';
export const COMPANION_USER_ID = 'e0000000-0000-4000-8000-000000000002';
export const CHALLENGER_USER_ID = 'e0000000-0000-4000-8000-000000000003';
export const SAMPLE_GAME_ID = 'sample-game-review-1';

export const EXCLUDED_USER_IDS = [
  REVIEWER_USER_ID,
  COMPANION_USER_ID,
  CHALLENGER_USER_ID,
];

// Initial Glicko-2 ratings constants matching glicko2.service.ts
export const DEFAULT_INITIAL_RATING = 1500.0;
export const DEFAULT_INITIAL_RD = 180.0;
export const DEFAULT_INITIAL_VOL = 0.06;

async function main() {
  const isExecute = process.argv.includes('--execute');
  const isDryRun = process.argv.includes('--dry-run') || !isExecute;

  console.log('====================================================');
  console.log('         DUOORB TESTER DATA RESET SCRIPT           ');
  console.log('====================================================');
  console.log(`Mode: ${isDryRun ? '🔍 DRY RUN (Preview only - no changes written)' : '🚀 LIVE EXECUTION'}\n`);

  // 1. Inspect counts before action
  const totalUsers = await prisma.user.count();
  const resetUserCount = await prisma.user.count({
    where: { id: { notIn: EXCLUDED_USER_IDS } },
  });

  const gamesToDelete = await prisma.game.count({
    where: { id: { not: SAMPLE_GAME_ID } },
  });

  const analysesToDelete = await prisma.gameAnalysis.count({
    where: { gameId: { not: SAMPLE_GAME_ID } },
  });

  const movesCount = await prisma.gameMove.count({
    where: { gameId: { not: SAMPLE_GAME_ID } },
  });

  const gamePlayersCount = await prisma.gamePlayer.count({
    where: { gameId: { not: SAMPLE_GAME_ID } },
  });

  const ratingHistoriesToDelete = await prisma.ratingHistory.count({
    where: { gameId: { not: SAMPLE_GAME_ID } },
  });

  const ratingsToReset = await prisma.rating.count({
    where: { userId: { notIn: EXCLUDED_USER_IDS } },
  });

  const aiWinsToDelete = await prisma.aiWin.count({
    where: { userId: { notIn: EXCLUDED_USER_IDS } },
  });

  const achievementsToDelete = await prisma.achievement.count({
    where: { userId: { notIn: EXCLUDED_USER_IDS } },
  });

  const equippedBadgesToDelete = await prisma.equippedBadge.count({
    where: { userId: { notIn: EXCLUDED_USER_IDS } },
  });

  const profilesWithBotStars = await prisma.profile.count({
    where: {
      userId: { notIn: EXCLUDED_USER_IDS },
      botStars: { not: null },
    },
  });

  console.log('Summary of targeted data:');
  console.log(`  • Total Registered Accounts:            ${totalUsers}`);
  console.log(`  • Accounts to Reset (excluding review):   ${resetUserCount}`);
  console.log(`  • Online Matches (Game):                ${gamesToDelete} (moves: ${movesCount}, player links: ${gamePlayersCount})`);
  console.log(`  • Rating History Points:                ${ratingHistoriesToDelete}`);
  console.log(`  • Cached Game Analyses:                 ${analysesToDelete}`);
  console.log(`  • Rating Rows to Reset to 1500:         ${ratingsToReset}`);
  console.log(`  • AI Bot Wins (ai_wins):                ${aiWinsToDelete}`);
  console.log(`  • Achievements Earned:                  ${achievementsToDelete}`);
  console.log(`  • Equipped Badges:                      ${equippedBadgesToDelete}`);
  console.log(`  • Profiles with Bot Stars:              ${profilesWithBotStars}`);
  console.log('\nData that will remain 100% PRESERVED:');
  console.log('  ✓ User accounts (UUIDs, emails, auth links)');
  console.log('  ✓ User profiles (usernames, display names, avatars, bios, premium status)');
  console.log('  ✓ Friendships, friend requests, and blocks');
  console.log('  ✓ Google Play Reviewer account and sample game (sample-game-review-1)\n');

  if (isDryRun) {
    console.log('ℹ️  This was a DRY RUN. No changes were made to the database.');
    console.log('    To apply these changes, run with: npm run reset:tester-data -- --execute\n');
    return;
  }

  console.log('Executing database reset within an atomic transaction...');

  await prisma.$transaction(async (tx) => {
    // 1. Delete Game Analyses (no FK cascade)
    const delAnalyses = await tx.gameAnalysis.deleteMany({
      where: { gameId: { not: SAMPLE_GAME_ID } },
    });
    console.log(`  ✓ Deleted ${delAnalyses.count} game analyses.`);

    // 2. Delete Games (cascades to game_moves, game_players, rating_history)
    const delGames = await tx.game.deleteMany({
      where: { id: { not: SAMPLE_GAME_ID } },
    });
    console.log(`  ✓ Deleted ${delGames.count} games (and cascaded moves/players).`);

    // 3. Delete any orphan rating_history if any
    const delRatingHist = await tx.ratingHistory.deleteMany({
      where: { gameId: { not: SAMPLE_GAME_ID } },
    });
    console.log(`  ✓ Cleaned ${delRatingHist.count} remaining rating history rows.`);

    // 4. Reset Ratings back to 1500 / initial
    const resetRatings = await tx.rating.updateMany({
      where: { userId: { notIn: EXCLUDED_USER_IDS } },
      data: {
        rating: DEFAULT_INITIAL_RATING,
        rd: DEFAULT_INITIAL_RD,
        vol: DEFAULT_INITIAL_VOL,
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        draws: 0,
      },
    });
    console.log(`  ✓ Reset ${resetRatings.count} rating rows to 1500 / 0 games played.`);

    // 5. Reset Bot Mastery Stars
    const resetProfiles = await tx.profile.updateMany({
      where: { userId: { notIn: EXCLUDED_USER_IDS } },
      data: {
        botStars: {},
      },
    });
    console.log(`  ✓ Cleared bot stars on ${resetProfiles.count} profiles.`);

    // 6. Delete AI Wins
    const delAiWins = await tx.aiWin.deleteMany({
      where: { userId: { notIn: EXCLUDED_USER_IDS } },
    });
    console.log(`  ✓ Deleted ${delAiWins.count} AI wins.`);

    // 7. Delete Achievements & Equipped Badges
    const delEquipped = await tx.equippedBadge.deleteMany({
      where: { userId: { notIn: EXCLUDED_USER_IDS } },
    });
    console.log(`  ✓ Cleared ${delEquipped.count} equipped badge slots.`);

    const delAchievements = await tx.achievement.deleteMany({
      where: { userId: { notIn: EXCLUDED_USER_IDS } },
    });
    console.log(`  ✓ Deleted ${delAchievements.count} achievement records.`);
  });

  console.log('\n✅ Tester data reset successfully completed!');
  console.log('All accounts are preserved, all ratings are at initial 1500, match history is clear.\n');
}

main()
  .catch((err) => {
    console.error('❌ Reset failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
