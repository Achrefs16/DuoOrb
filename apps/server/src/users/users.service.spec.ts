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
