import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { GuestService } from '../guest/guest.service.js';
import {
  BIO_MAX,
  assertValidDisplayName,
  assertValidUsername,
} from './username.js';

/** Prisma's unique-constraint violation code. */
function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    (e as { code?: unknown }).code === 'P2002'
  );
}

@Injectable()
export class UsersService {
  // Optional so the service can be constructed bare in unit tests.
  constructor(
    private readonly prisma: PrismaService,
    private readonly guestService?: GuestService
  ) {}

  async getMe(userId: string) {
    if (!this.prisma.isConnected) {
      return {
        id: userId,
        username: `player_${userId.slice(0, 6)}`,
        displayName: `Player ${userId.slice(0, 4)}`,
        rating1v1: 1500,
        rating4p: 1500,
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        draws: 0,
      };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        ratings: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    // Universal rating: exactly one row per user. Legacy per-mode keys
    // (CLASSIC_1V1 / FOUR_PLAYER) are kept as identical views so existing
    // mobile clients keep working with a single source of truth.
    const rating = user.ratings[0];

    const shape = (r?: { rating: number; rd: number; gamesPlayed: number; wins: number; losses: number }) => ({
      rating: r?.rating ?? 1500,
      rd: r?.rd ?? 350,
      gamesPlayed: r?.gamesPlayed ?? 0,
      wins: r?.wins ?? 0,
      losses: r?.losses ?? 0,
      winRate:
        r && r.gamesPlayed > 0 ? Math.round((r.wins / r.gamesPlayed) * 100) : 0,
    });

    const totalGames = rating?.gamesPlayed ?? 0;
    const totalWins = rating?.wins ?? 0;
    const totalLosses = rating?.losses ?? 0;
    const totalDraws = rating?.draws ?? 0;

    return {
      id: user.id,
      email: user.email,
      username: user.profile?.username ?? `player_${userId.slice(0, 6)}`,
      displayName: user.profile?.displayName ?? `Player ${userId.slice(0, 4)}`,
      avatarUrl: user.profile?.avatarUrl,
      bio: user.profile?.bio,
      // Flat fields (legacy) + nested ratings map (mobile contract).
      rating1v1: rating?.rating ?? 1500,
      rating4p: rating?.rating ?? 1500,
      gamesPlayed: totalGames,
      wins: totalWins,
      losses: totalLosses,
      draws: totalDraws,
      createdAt: user.createdAt,
      ratings: {
        CLASSIC_1V1: shape(rating),
        FOUR_PLAYER: shape(rating),
      },
    };
  }

  /**
   * Availability probe for the live username editor. Validates the policy
   * first (400 on a malformed handle) so the client can render the exact
   * same message the save path would return.
   */
  async isUsernameAvailable(rawUsername: string, selfUserId: string) {
    const username = assertValidUsername(rawUsername);

    if (!this.prisma.isConnected) {
      return { username, available: true };
    }

    const existing = await this.prisma.profile.findFirst({
      where: { username, NOT: { userId: selfUserId } },
    });
    return { username, available: !existing };
  }

  async updateProfile(userId: string, data: { displayName?: string; username?: string; bio?: string; avatarUrl?: string }) {
    // Validate before touching the database so a bad request never costs a
    // uniqueness round-trip. `undefined` means "leave unchanged"; an empty
    // string is a real (and rejected) value, not a no-op.
    const patch: {
      username?: string;
      displayName?: string;
      bio?: string | null;
      avatarUrl?: string | null;
    } = {};

    if (data.username !== undefined) {
      patch.username = assertValidUsername(data.username);
    }
    if (data.displayName !== undefined) {
      patch.displayName = assertValidDisplayName(data.displayName);
    }
    if (data.bio !== undefined) {
      patch.bio = typeof data.bio === 'string' ? data.bio.slice(0, BIO_MAX) : null;
    }
    if (data.avatarUrl !== undefined) {
      patch.avatarUrl = typeof data.avatarUrl === 'string' ? data.avatarUrl : null;
    }

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('Nothing to update.');
    }

    if (!this.prisma.isConnected) {
      return { userId, ...patch };
    }

    if (patch.username !== undefined) {
      const existing = await this.prisma.profile.findFirst({
        where: {
          username: patch.username,
          NOT: { userId },
        },
      });
      if (existing) {
        throw new ConflictException('That username is already taken.');
      }
    }

    try {
      // upsert rather than update: a user whose Profile row was never
      // created (gateway presence upserts can fail silently) would
      // otherwise blow up with P2025 on their first rename.
      return await this.prisma.profile.upsert({
        where: { userId },
        create: {
          userId,
          username: patch.username ?? `player_${userId.slice(0, 6)}`,
          displayName: patch.displayName ?? `Player ${userId.slice(0, 4)}`,
          ...(patch.bio !== undefined && { bio: patch.bio }),
          ...(patch.avatarUrl !== undefined && { avatarUrl: patch.avatarUrl }),
        },
        update: patch,
      });
    } catch (e) {
      // The findFirst above is only a pre-check; two concurrent renames can
      // still race into the unique index. Surface the same 409 the pre-check
      // would have produced instead of a raw Prisma 500.
      if (isUniqueViolation(e)) {
        throw new ConflictException('That username is already taken.');
      }
      throw e;
    }
  }

  async getPublicProfile(userIdOrUsername: string) {
    if (!this.prisma.isConnected) {
      return {
        id: userIdOrUsername,
        username: userIdOrUsername,
        displayName: userIdOrUsername,
        rating1v1: 1500,
        rating4p: 1500,
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
      };
    }

    const profile = await this.prisma.profile.findFirst({
      where: {
        OR: [{ userId: userIdOrUsername }, { username: userIdOrUsername }],
      },
      include: {
        user: {
          include: {
            ratings: true,
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found.');
    }

    const rating = profile.user.ratings[0];

    const shape = (r?: { rating: number; rd: number; gamesPlayed: number; wins: number; losses: number }) => ({
      rating: r?.rating ?? 1500,
      rd: r?.rd ?? 350,
      gamesPlayed: r?.gamesPlayed ?? 0,
      wins: r?.wins ?? 0,
      losses: r?.losses ?? 0,
      winRate:
        r && r.gamesPlayed > 0 ? Math.round((r.wins / r.gamesPlayed) * 100) : 0,
    });

    return {
      id: profile.userId,
      username: profile.username,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      bio: profile.bio,
      isOnline: profile.isOnline,
      isPlaying: profile.isPlaying,
      rating1v1: rating?.rating ?? 1500,
      rating4p: rating?.rating ?? 1500,
      gamesPlayed: rating?.gamesPlayed ?? 0,
      wins: rating?.wins ?? 0,
      losses: rating?.losses ?? 0,
      createdAt: profile.createdAt,
      ratings: {
        CLASSIC_1V1: shape(rating),
        FOUR_PLAYER: shape(rating),
      },
    };
  }

  async searchUsers(query: string) {
    if (!query || query.trim().length === 0) return [];
    if (!this.prisma.isConnected) return [];

    const profiles = await this.prisma.profile.findMany({
      where: {
        OR: [
          { username: { contains: query, mode: 'insensitive' } },
          { displayName: { contains: query, mode: 'insensitive' } },
        ],
      },
      include: {
        user: {
          include: {
            ratings: true,
          },
        },
      },
      take: 20,
    });

    return profiles.map((p) => {
      const r = p.user.ratings[0];
      return {
        id: p.userId,
        username: p.username,
        displayName: p.displayName,
        avatarUrl: p.avatarUrl,
        rating: r?.rating ?? 1500,
        isOnline: p.isOnline,
      };
    });
  }

  /**
   * Adopts a guest row into a real account: ratings (adopted only when the
   * account has no played games yet), friendships, blocks and game history
   * are re-pointed, then the guest row is removed (cascading its profile).
   * One-shot by construction — second call finds nothing to merge.
   */
  async linkGuest(accountId: string, guestId: string) {
    if (!this.prisma.isConnected) {
      return { merged: false, reason: 'Database unavailable.' };
    }

    const guest = await this.prisma.user.findUnique({
      where: { id: guestId },
      include: { ratings: true },
    });
    if (!guest) {
      return { merged: false, reason: 'No guest progress found.' };
    }

    const accountRatings = await this.prisma.rating.findMany({
      where: { userId: accountId },
    });
    const accountGames = accountRatings.reduce((a, r) => a + r.gamesPlayed, 0);

    await this.prisma.$transaction(async (tx) => {
      // Adopt the guest's single universal rating onto a fresh account.
      if (accountGames === 0) {
        const gr = guest.ratings[0];
        if (gr) {
          await tx.rating.upsert({
            where: { userId: accountId },
            create: {
              userId: accountId,
              rating: gr.rating,
              rd: gr.rd,
              vol: gr.vol,
              gamesPlayed: gr.gamesPlayed,
              wins: gr.wins,
              losses: gr.losses,
              draws: gr.draws,
            },
            update: {},
          });
        }
      }

      // Re-point friendships, blocks and game history to the account.
      // Unique-constraint collisions (already friends) resolve to the
      // surviving account row.
      const friendships = await tx.friendship.findMany({
        where: { OR: [{ user1Id: guestId }, { user2Id: guestId }] },
      });
      for (const f of friendships) {
        const user1Id = f.user1Id === guestId ? accountId : f.user1Id;
        const user2Id = f.user2Id === guestId ? accountId : f.user2Id;
        if (user1Id === user2Id) {
          await tx.friendship.delete({ where: { id: f.id } });
          continue;
        }
        try {
          await tx.friendship.update({
            where: { id: f.id },
            data: { user1Id, user2Id },
          });
        } catch {
          await tx.friendship.delete({ where: { id: f.id } });
        }
      }

      await tx.friendRequest.updateMany({
        where: { fromUserId: guestId },
        data: { fromUserId: accountId },
      });
      await tx.friendRequest.updateMany({
        where: { toUserId: guestId },
        data: { toUserId: accountId },
      });
      await tx.block.updateMany({
        where: { blockerId: guestId },
        data: { blockerId: accountId },
      });
      await tx.block.updateMany({
        where: { blockedId: guestId },
        data: { blockedId: accountId },
      });
      await tx.gamePlayer.updateMany({
        where: { userId: guestId },
        data: { userId: accountId },
      });

      await tx.user.delete({ where: { id: guestId } });
    });

    // The guest row is gone (the session cascades with it), but revoke
    // explicitly too: a refresh token must not survive the merge and be
    // redeemable for an account that now owns that progress.
    await this.guestService?.revokeForUser(guestId);

    return { merged: true, adoptedRatings: accountGames === 0 };
  }
}
