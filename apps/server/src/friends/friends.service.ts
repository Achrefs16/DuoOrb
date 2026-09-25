import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class FriendsService {
  constructor(private readonly prisma: PrismaService) {}

  async getFriends(userId: string) {
    if (!this.prisma.isConnected) return [];

    const friendships = await this.prisma.friendship.findMany({
      where: {
        OR: [{ user1Id: userId }, { user2Id: userId }],
      },
      include: {
        user1: { include: { profile: true, ratings: true } },
        user2: { include: { profile: true, ratings: true } },
      },
    });

    return friendships.map((f) => {
      const friendUser = f.user1Id === userId ? f.user2 : f.user1;
      const r = friendUser.ratings[0];
      return {
        id: friendUser.id,
        username: friendUser.profile?.username ?? `player_${friendUser.id.slice(0, 6)}`,
        displayName: friendUser.profile?.displayName ?? `Player`,
        avatarUrl: friendUser.profile?.avatarUrl,
        rating: r?.rating ?? 1500,
        status: friendUser.profile?.isPlaying
          ? 'PLAYING'
          : friendUser.profile?.isOnline
          ? 'ONLINE'
          : 'OFFLINE',
      };
    });
  }

  async getRequests(userId: string) {
    if (!this.prisma.isConnected) return { incoming: [], outgoing: [] };

    const incoming = await this.prisma.friendRequest.findMany({
      where: { toUserId: userId, status: 'PENDING' },
      include: {
        fromUser: { include: { profile: true } },
      },
    });

    const outgoing = await this.prisma.friendRequest.findMany({
      where: { fromUserId: userId, status: 'PENDING' },
      include: {
        toUser: { include: { profile: true } },
      },
    });

    return {
      incoming: incoming.map((r) => ({
        id: r.id,
        fromUserId: r.fromUserId,
        fromUsername: r.fromUser.profile?.username ?? r.fromUserId,
        fromDisplayName: r.fromUser.profile?.displayName ?? 'Player',
        createdAt: r.createdAt,
      })),
      outgoing: outgoing.map((r) => ({
        id: r.id,
        toUserId: r.toUserId,
        toUsername: r.toUser.profile?.username ?? r.toUserId,
        toDisplayName: r.toUser.profile?.displayName ?? 'Player',
        createdAt: r.createdAt,
      })),
    };
  }

  async sendRequest(fromUserId: string, target: { toUserId?: string; toUsername?: string }) {
    if (!this.prisma.isConnected) {
      throw new BadRequestException('Database not available.');
    }

    let targetUserId = target.toUserId;
    if (!targetUserId && target.toUsername) {
      const profile = await this.prisma.profile.findUnique({
        where: { username: target.toUsername },
      });
      if (!profile) {
        throw new NotFoundException('User with that username not found.');
      }
      targetUserId = profile.userId;
    }

    if (!targetUserId) {
      throw new BadRequestException('Target user must be specified.');
    }

    if (targetUserId === fromUserId) {
      throw new BadRequestException('Cannot send friend request to yourself.');
    }

    // Check if blocked
    const isBlocked = await this.prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: fromUserId, blockedId: targetUserId },
          { blockerId: targetUserId, blockedId: fromUserId },
        ],
      },
    });
    if (isBlocked) {
      throw new BadRequestException('Cannot send friend request to this user.');
    }

    // Check if already friends
    const [u1, u2] = fromUserId < targetUserId ? [fromUserId, targetUserId] : [targetUserId, fromUserId];
    const existingFriendship = await this.prisma.friendship.findUnique({
      where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } },
    });
    if (existingFriendship) {
      throw new ConflictException('Already friends with this user.');
    }

    // Check if pending request exists
    const existingReq = await this.prisma.friendRequest.findFirst({
      where: {
        fromUserId,
        toUserId: targetUserId,
        status: 'PENDING',
      },
    });
    if (existingReq) {
      throw new ConflictException('Friend request already sent.');
    }

    return this.prisma.friendRequest.create({
      data: {
        fromUserId,
        toUserId: targetUserId,
        status: 'PENDING',
      },
    });
  }

  async respondRequest(userId: string, requestId: string, accept: boolean) {
    if (!this.prisma.isConnected) {
      throw new BadRequestException('Database not available.');
    }

    const req = await this.prisma.friendRequest.findUnique({
      where: { id: requestId },
    });

    if (!req || req.toUserId !== userId) {
      throw new NotFoundException('Friend request not found.');
    }

    if (req.status !== 'PENDING') {
      throw new BadRequestException('Friend request already resolved.');
    }

    if (!accept) {
      return this.prisma.friendRequest.update({
        where: { id: requestId },
        data: { status: 'REJECTED' },
      });
    }

    // Accept: create friendship in canonical order
    const [u1, u2] = req.fromUserId < req.toUserId ? [req.fromUserId, req.toUserId] : [req.toUserId, req.fromUserId];

    await this.prisma.$transaction([
      this.prisma.friendRequest.update({
        where: { id: requestId },
        data: { status: 'ACCEPTED' },
      }),
      this.prisma.friendship.upsert({
        where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } },
        create: { user1Id: u1, user2Id: u2 },
        update: {},
      }),
    ]);

    return { success: true };
  }

  async removeFriend(userId: string, friendId: string) {
    if (!this.prisma.isConnected) return { success: true };

    const [u1, u2] = userId < friendId ? [userId, friendId] : [friendId, userId];

    await this.prisma.friendship.deleteMany({
      where: { user1Id: u1, user2Id: u2 },
    });

    return { success: true };
  }

  async blockUser(userId: string, targetUserId: string) {
    if (!this.prisma.isConnected) return { success: true };
    if (userId === targetUserId) throw new BadRequestException('Cannot block yourself.');

    const [u1, u2] = userId < targetUserId ? [userId, targetUserId] : [targetUserId, userId];

    await this.prisma.$transaction([
      this.prisma.friendship.deleteMany({
        where: { user1Id: u1, user2Id: u2 },
      }),
      this.prisma.friendRequest.deleteMany({
        where: {
          OR: [
            { fromUserId: userId, toUserId: targetUserId },
            { fromUserId: targetUserId, toUserId: userId },
          ],
        },
      }),
      this.prisma.block.upsert({
        where: { blockerId_blockedId: { blockerId: userId, blockedId: targetUserId } },
        create: { blockerId: userId, blockedId: targetUserId },
        update: {},
      }),
    ]);

    return { success: true };
  }
}
