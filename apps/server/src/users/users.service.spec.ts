import { describe, it, expect } from 'vitest';
import { UsersService } from './users.service.js';

/**
 * Friend search must not offer the searching account back to them.
 *
 * The old query matched username OR displayName with no self filter, so a
 * player with more than one row on the server (which is what the old
 * per-launch guest minting produced) saw their own history listed as several
 * separate people to add.
 */
function makePrisma(profiles: any[]) {
  const calls: any[] = [];
  return {
    calls,
    isConnected: true,
    profile: {
      findMany: async (args: any) => {
        calls.push(args);
        // Emulate the parts of Prisma's query we rely on: the AND/OR/NOT shape.
        const [orPart, notPart] = args.where.AND;
        const selfId = notPart?.NOT?.userId;
        const needle = String(orPart.OR[0].username.contains).toLowerCase();
        return profiles.filter(
          (p) =>
            p.userId !== selfId &&
            (p.username.toLowerCase().includes(needle) ||
              p.displayName.toLowerCase().includes(needle))
        );
      },
    },
  } as any;
}

const profile = (userId: string, username: string, displayName: string) => ({
  userId,
  username,
  displayName,
  avatarUrl: null,
  isOnline: false,
  isPlaying: false,
  user: { ratings: [{ rating: 1500, rd: 350, gamesPlayed: 0, wins: 0, losses: 0, draws: 0 }] },
});

describe('user search excludes the searching account', () => {
  const rows = [
    profile('u_current', 'achra', 'Achraf'),
    profile('u_old_guest', 'achra_old', 'Achraf'),
    profile('u_friend', 'achraf_friend', 'Zinedine'),
  ];

  it('never returns the caller', async () => {
    const prisma = makePrisma(rows);
    const svc = new UsersService(prisma);
    const results = await svc.searchUsers('achra', 'u_current');
    expect(results.map((r) => r.id)).not.toContain('u_current');
  });

  it('still finds other players', async () => {
    const prisma = makePrisma(rows);
    const svc = new UsersService(prisma);
    const results = await svc.searchUsers('achra', 'u_current');
    expect(results.map((r) => r.id)).toEqual(['u_old_guest', 'u_friend']);
  });

  it('omits the self filter entirely when no caller id is supplied', async () => {
    const prisma = makePrisma(rows);
    const svc = new UsersService(prisma);
    const results = await svc.searchUsers('achra');
    expect(results.map((r) => r.id)).toContain('u_current');
  });

  it('returns nothing for a blank query without touching the database', async () => {
    const prisma = makePrisma(rows);
    const svc = new UsersService(prisma);
    expect(await svc.searchUsers('   ', 'u_current')).toEqual([]);
    expect(prisma.calls).toHaveLength(0);
  });
});

/**
 * Guest linking must carry the guest's REAL rating onto the account.
 *
 * The regression: signup seeds a 1500 row on the fresh account first, and the
 * merge upserted with `update: {}` — a no-op that kept 1500 and dropped the
 * guest's rating (and its gamesPlayed) with the deleted guest row.
 */
function makeLinkPrisma(guestRating: any, accountRatings: any[]) {
  const upserts: any[] = [];
  const historyMoves: any[] = [];
  const tx = {
    rating: {
      upsert: async (args: any) => {
        upserts.push(args);
        return {};
      },
    },
    ratingHistory: {
      updateMany: async (args: any) => {
        historyMoves.push(args);
        return { count: 1 };
      },
    },
    friendship: { findMany: async () => [] },
    friendRequest: { updateMany: async () => ({ count: 0 }) },
    block: { updateMany: async () => ({ count: 0 }) },
    gamePlayer: { updateMany: async () => ({ count: 0 }) },
    aiWin: { updateMany: async () => ({ count: 0 }) },
    achievement: { findMany: async () => [] },
    equippedBadge: {
      count: async () => 1,
      deleteMany: async () => ({ count: 0 }),
    },
    user: { delete: async () => ({}) },
  };
  const prisma = {
    isConnected: true,
    user: {
      findUnique: async () => ({ id: 'u_guest', ratings: [guestRating] }),
    },
    rating: {
      findMany: async () => accountRatings,
    },
    $transaction: async (fn: (tx: unknown) => Promise<void>) => fn(tx),
  };
  return { prisma: prisma as any, upserts, historyMoves };
}

describe('linkGuest adopts the guest rating', () => {
  const guestRating = {
    rating: 1640,
    rd: 200,
    vol: 0.06,
    gamesPlayed: 12,
    wins: 8,
    losses: 4,
    draws: 0,
  };
  // Fresh Google account: signup already seeded its 1500 row (0 games).
  const seeded = [{ rating: 1500, rd: 350, vol: 0.06, gamesPlayed: 0 }];

  it('overwrites the seeded 1500 with the guest values', async () => {
    const { prisma, upserts, historyMoves } = makeLinkPrisma(guestRating, seeded);
    const svc = new UsersService(prisma);
    const res = await svc.linkGuest('u_google', 'u_guest');
    expect(res.merged).toBe(true);
    expect(upserts).toHaveLength(1);
    // The update branch is the whole fix: a seeded row exists, so create
    // never runs and only update can carry the rating over.
    expect(upserts[0].where).toEqual({ userId: 'u_google' });
    expect(upserts[0].update).toMatchObject({
      rating: 1640,
      gamesPlayed: 12,
      wins: 8,
      losses: 4,
    });
    // Rating history follows the rating onto the fresh account.
    expect(historyMoves).toEqual([{ where: { userId: 'u_guest' }, data: { userId: 'u_google' } }]);
  });

  it('leaves a played account rating alone', async () => {
    const played = [{ rating: 1550, rd: 300, vol: 0.06, gamesPlayed: 5 }];
    const { prisma, upserts } = makeLinkPrisma(guestRating, played);
    const svc = new UsersService(prisma);
    const res = await svc.linkGuest('u_google', 'u_guest');
    expect(res.merged).toBe(true);
    expect(res.adoptedRatings).toBe(false);
    expect(upserts).toHaveLength(0);
  });
});
