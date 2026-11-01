import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/auth/password.js';

const prisma = new PrismaClient();

export const REVIEWER_USER_ID = 'e0000000-0000-4000-8000-000000000001';
export const REVIEWER_EMAIL = (process.env.REVIEWER_EMAIL || 'playreview@duoorb.com').trim().toLowerCase();
export const REVIEWER_PASSWORD = process.env.REVIEWER_PASSWORD || 'Review2026@DuoOrb!';

const COMPANION_USER_ID = 'e0000000-0000-4000-8000-000000000002';
const CHALLENGER_USER_ID = 'e0000000-0000-4000-8000-000000000003';

async function main() {
  console.log('--- Provisioning Google Play Reviewer Account ---');
  console.log(`Email:    ${REVIEWER_EMAIL}`);
  console.log(`User ID:  ${REVIEWER_USER_ID}`);

  const passwordHash = await hashPassword(REVIEWER_PASSWORD);

  // 1. Reviewer user & profile
  await prisma.user.upsert({
    where: { id: REVIEWER_USER_ID },
    create: { id: REVIEWER_USER_ID, email: REVIEWER_EMAIL },
    update: { email: REVIEWER_EMAIL },
  });

  await prisma.profile.upsert({
    where: { userId: REVIEWER_USER_ID },
    create: {
      userId: REVIEWER_USER_ID,
      username: 'playreview',
      displayName: 'Play Reviewer',
      bio: 'Official Google Play review account for DuoOrb.',
      isOnline: false,
    },
    update: {
      username: 'playreview',
      displayName: 'Play Reviewer',
    },
  });

  await prisma.rating.upsert({
    where: { userId: REVIEWER_USER_ID },
    create: {
      userId: REVIEWER_USER_ID,
      rating: 1540.0,
      rd: 95.0,
      vol: 0.06,
      gamesPlayed: 12,
      wins: 8,
      losses: 4,
      draws: 0,
    },
    update: {},
  });

  // 2. Reviewer credentials
  await prisma.reviewerCredential.upsert({
    where: { email: REVIEWER_EMAIL },
    create: {
      userId: REVIEWER_USER_ID,
      email: REVIEWER_EMAIL,
      passwordHash,
    },
    update: {
      passwordHash,
    },
  });

  console.log('✓ Reviewer user, profile, rating, and credential upserted.');

  // 3. Companion accounts for testing social features (Friends, Friend Requests, Match History)
  // Companion user:
  await prisma.user.upsert({
    where: { id: COMPANION_USER_ID },
    create: { id: COMPANION_USER_ID, email: 'companion@duoorb.com' },
    update: {},
  });
  await prisma.profile.upsert({
    where: { userId: COMPANION_USER_ID },
    create: {
      userId: COMPANION_USER_ID,
      username: 'duoorb_companion',
      displayName: 'Orb Companion',
      bio: 'Companion player for multiplayer & social testing.',
      isOnline: true,
    },
    update: {},
  });
  await prisma.rating.upsert({
    where: { userId: COMPANION_USER_ID },
    create: {
      userId: COMPANION_USER_ID,
      rating: 1515.0,
      rd: 120.0,
      vol: 0.06,
      gamesPlayed: 10,
      wins: 6,
      losses: 4,
      draws: 0,
    },
    update: {},
  });

  // Challenger user:
  await prisma.user.upsert({
    where: { id: CHALLENGER_USER_ID },
    create: { id: CHALLENGER_USER_ID, email: 'challenger@duoorb.com' },
    update: {},
  });
  await prisma.profile.upsert({
    where: { userId: CHALLENGER_USER_ID },
    create: {
      userId: CHALLENGER_USER_ID,
      username: 'duoorb_challenger',
      displayName: 'Orb Challenger',
      bio: 'Challenger for testing friend requests.',
      isOnline: true,
    },
    update: {},
  });
  await prisma.rating.upsert({
    where: { userId: CHALLENGER_USER_ID },
    create: {
      userId: CHALLENGER_USER_ID,
      rating: 1480.0,
      rd: 130.0,
      vol: 0.06,
      gamesPlayed: 5,
      wins: 2,
      losses: 3,
      draws: 0,
    },
    update: {},
  });

  // 4. Friendship: Reviewer <-> Companion
  const existingFriendship = await prisma.friendship.findFirst({
    where: {
      OR: [
        { user1Id: REVIEWER_USER_ID, user2Id: COMPANION_USER_ID },
        { user1Id: COMPANION_USER_ID, user2Id: REVIEWER_USER_ID },
      ],
    },
  });
  if (!existingFriendship) {
    await prisma.friendship.create({
      data: {
        user1Id: REVIEWER_USER_ID,
        user2Id: COMPANION_USER_ID,
      },
    });
    console.log('✓ Friendship established with Orb Companion.');
  }

  // 5. Incoming Friend Request: Challenger -> Reviewer (PENDING)
  const existingRequest = await prisma.friendRequest.findFirst({
    where: {
      fromUserId: CHALLENGER_USER_ID,
      toUserId: REVIEWER_USER_ID,
    },
  });
  if (!existingRequest) {
    await prisma.friendRequest.create({
      data: {
        fromUserId: CHALLENGER_USER_ID,
        toUserId: REVIEWER_USER_ID,
        status: 'PENDING',
      },
    });
    console.log('✓ Pending friend request created from Orb Challenger.');
  }

  // 6. Seed a sample completed game for Match History inspection
  const sampleGameId = 'sample-game-review-1';
  const existingGame = await prisma.game.findUnique({ where: { id: sampleGameId } });
  if (!existingGame) {
    const startedAt = new Date(Date.now() - 3600 * 1000);
    const endedAt = new Date(Date.now() - 3300 * 1000);
    await prisma.game.create({
      data: {
        id: sampleGameId,
        mode: '2p',
        status: 'COMPLETED',
        isRanked: true,
        timeControlMinutes: 3,
        incrementSeconds: 0,
        wallsEach: 10,
        winnerId: 'p1',
        winnerUserId: REVIEWER_USER_ID,
        endedReason: 'GOAL_REACHED',
        startedAt,
        endedAt,
        players: {
          create: [
            {
              userId: REVIEWER_USER_ID,
              playerIndex: 0,
              ratingBefore: 1520.0,
              ratingAfter: 1540.0,
              isWinner: true,
              placement: 1,
            },
            {
              userId: COMPANION_USER_ID,
              playerIndex: 1,
              ratingBefore: 1535.0,
              ratingAfter: 1515.0,
              isWinner: false,
              placement: 2,
            },
          ],
        },
        ratingHistories: {
          create: [
            {
              userId: REVIEWER_USER_ID,
              mode: '2p',
              ratingBefore: 1520.0,
              ratingAfter: 1540.0,
              delta: 20.0,
              rdBefore: 100.0,
              rdAfter: 95.0,
            },
            {
              userId: COMPANION_USER_ID,
              mode: '2p',
              ratingBefore: 1535.0,
              ratingAfter: 1515.0,
              delta: -20.0,
              rdBefore: 125.0,
              rdAfter: 120.0,
            },
          ],
        },
      },
    });
    console.log('✓ Sample completed multiplayer game created for Match History.');
  }

  console.log('\n--- Reviewer Provisioning Complete! ---');
  console.log(`Credentials:`);
  console.log(`  Email:    ${REVIEWER_EMAIL}`);
  console.log(`  Password: ${REVIEWER_PASSWORD}`);
  console.log('--------------------------------------\n');
}

main()
  .catch((e) => {
    console.error('Provisioning failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

