import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../database/prisma.service.js';
import {
  ACHIEVEMENTS,
  BADGE_SLOTS,
  WIN_MILESTONES,
  achievementByCode,
  swiftPliesFor,
} from './achievements.catalog.js';
import {
  applyAction,
  createInitialState,
  parseGame,
  seatLetter,
  type GameAction,
  type GameMode,
} from '@duoorb/game-core';

export interface SubmitAiWinBody {
  clientWinId?: string;
  mode?: string;
  aiDifficulty?: string;
  playerSeat?: number;
  movesNotation?: string;
  totalPlies?: number;
  durationSeconds?: number;
  playedAt?: string | number;
}

export interface EarnedBadgeDto {
  code: string;
  name: string;
  description: string;
  requirement: string;
  icon: string;
}

export interface SubmitAiWinResult {
  win: {
    id: string;
    mode: string;
    totalPlies: number;
    playedAt: string;
  };
  alreadyRecorded: boolean;
  /** Same winning sequence already stored for this account: +0, no rewards. */
  duplicate: boolean;
  newAchievements: EarnedBadgeDto[];
  stats: {
    /** Unique hard-AI winning sequences on this account. */
    hardWins: number;
    fastestPlies: number | null;
    /** Owners per newly earned code — the rarity behind the message. */
    owners: Record<string, number>;
    /** 1-based speed rank of this win, when it is among the fastest. */
    speedRank: number | null;
  };
  /** Personalized celebration line. Empty when nothing new was earned. */
  message: string;
}

/** Seats per mode shape, for rebuilding the verification position. */
function seatsForMode(mode: string): number {
  if (mode.includes('4')) return 4;
  if (mode.includes('3')) return 3;
  return 2;
}

/**
 * One ply as canonical text. Seat letters, player ids, dates and names are
 * deliberately absent: the mover's seat INDEX plus the bare action is what
 * makes the same exact game hash the same on every device, every time, while
 * two genuinely different games can never collide into one signature.
 */
function canonicalToken(action: GameAction): string {
  if (action.type === 'MOVE') return `M${action.to.row},${action.to.col}`;
  if (action.type === 'PLACE_WALL') {
    return `W${action.wall.row},${action.wall.col},${action.wall.orientation}`;
  }
  return action.type;
}

const NOTATION_LIMIT = 50_000;

@Injectable()
export class AiwinsService {
  // Optional so the service can be constructed bare in unit tests.
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records a verified hard-AI win and awards whatever it earns.
   *
   * The win is replayed through game-core before anything is stored: every
   * ply must apply, the game must complete, and the winner must be the
   * claimed seat. A fabricated game fails verification and earns nothing.
   * Retries and offline replays carry the same `clientWinId` and resolve to
   * the stored row without double-counting or double-awarding.
   */
  async submitAiWin(userId: string, body: SubmitAiWinBody): Promise<SubmitAiWinResult> {
    const clientWinId = typeof body?.clientWinId === 'string' ? body.clientWinId.trim() : '';
    const mode = typeof body?.mode === 'string' ? body.mode.trim() : '';
    const movesNotation = typeof body?.movesNotation === 'string' ? body.movesNotation : '';
    const playerSeat = body?.playerSeat;
    const totalPlies = body?.totalPlies;
    const durationSeconds = body?.durationSeconds;
    const playedAt = body?.playedAt !== undefined ? new Date(body.playedAt) : new Date(NaN);

    if (!clientWinId || clientWinId.length > 64) {
      throw new BadRequestException('clientWinId is required.');
    }
    if (body?.aiDifficulty !== 'hard') {
      throw new BadRequestException('Only hard-AI wins are recorded.');
    }
    if (!mode) {
      throw new BadRequestException('mode is required.');
    }
    if (!Number.isInteger(playerSeat) || (playerSeat as number) < 0) {
      throw new BadRequestException('playerSeat is required.');
    }
    if (!movesNotation || movesNotation.length > NOTATION_LIMIT) {
      throw new BadRequestException('movesNotation is required.');
    }
    if (!Number.isInteger(totalPlies) || (totalPlies as number) <= 0) {
      throw new BadRequestException('totalPlies is required.');
    }
    if (!Number.isInteger(durationSeconds) || (durationSeconds as number) < 0) {
      throw new BadRequestException('durationSeconds is required.');
    }
    if (Number.isNaN(playedAt.getTime())) {
      throw new BadRequestException('playedAt is required.');
    }

    if (!this.prisma.isConnected) {
      throw new BadRequestException('Database unavailable.');
    }

    const existing = await this.prisma.aiWin.findUnique({
      where: { userId_clientWinId: { userId, clientWinId } },
    });
    if (existing) {
      const stats = await this.winStats(userId, {});
      return {
        win: {
          id: existing.id,
          mode: existing.mode,
          totalPlies: existing.totalPlies,
          playedAt: existing.playedAt.toISOString(),
        },
        alreadyRecorded: true,
        duplicate: false,
        newAchievements: [],
        stats,
        message: '',
      };
    }

    // Verify AND fingerprint in one replay: every ply must apply, the game
    // must complete with the claimed seat winning, and each ply contributes
    // its canonical token to the sequence signature. A fabricated game fails
    // here and earns nothing.
    const seats = seatsForMode(mode);
    let winnerSeat = -1;
    let replayedPlies = 0;
    let sequenceHash = '';
    try {
      const moves = parseGame(movesNotation);
      let state = createInitialState({
        mode: mode as GameMode,
        gameId: 'verify',
        playerNames: Array.from({ length: seats }, (_, i) => `Seat ${i + 1}`),
      });
      const parts = [`${mode}|${seats}`];
      for (const move of moves) {
        const mover = state.players[state.currentPlayerIndex];
        if (!mover) throw new BadRequestException('Win could not be verified: bad turn order.');
        if (move.seat && move.seat !== seatLetter(mover.index)) {
          throw new BadRequestException(
            `Win could not be verified: ply ${parts.length} names the wrong seat.`
          );
        }
        parts.push(`${mover.index}:${canonicalToken(move.action)}`);
        const applied = applyAction(state, move.action);
        if (!applied.success) {
          throw new BadRequestException(
            `Win could not be verified: ply ${parts.length - 1} is not legal here.`
          );
        }
        state = applied.state;
      }
      if (state.status !== 'COMPLETED' || !state.winnerId) {
        throw new BadRequestException('Win could not be verified: the game is not complete.');
      }
      const winner = state.players.find((p) => p.id === state.winnerId);
      winnerSeat = winner ? winner.index : -1;
      replayedPlies = moves.length;
      sequenceHash = createHash('sha256').update(parts.join('|')).digest('hex');
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException('Win could not be verified.');
    }
    if (winnerSeat !== playerSeat) {
      throw new BadRequestException('Win could not be verified: winner mismatch.');
    }
    if (replayedPlies !== totalPlies) {
      throw new BadRequestException('Win could not be verified: ply count mismatch.');
    }

    // Duplicate sequence for this account: same exact game, +0. No storage,
    // no milestone check, no reward — but also no error. Another account
    // using this sequence is irrelevant: the lookup is scoped to this user.
    const seen = await this.prisma.aiWin.findUnique({
      where: { userId_sequenceHash: { userId, sequenceHash } },
    });
    if (seen) {
      const stats = await this.winStats(userId, {});
      return {
        win: {
          id: seen.id,
          mode: seen.mode,
          totalPlies: seen.totalPlies,
          playedAt: seen.playedAt.toISOString(),
        },
        alreadyRecorded: false,
        duplicate: true,
        newAchievements: [],
        stats,
        message: '',
      };
    }

    const win = await this.prisma.aiWin.create({
      data: {
        userId,
        clientWinId,
        mode,
        aiDifficulty: 'hard',
        playerSeat: playerSeat as number,
        movesNotation,
        sequenceHash,
        totalPlies: totalPlies as number,
        durationSeconds: durationSeconds as number,
        playedAt,
      },
    });

    const newCodes = await this.evaluateWins(userId, mode, totalPlies as number);
    const stats = await this.winStats(userId, Object.fromEntries(newCodes.map((c) => [c, 0])));
    // Fill real owner counts for the newly earned codes.
    for (const code of newCodes) {
      stats.owners[code] = await this.prisma.achievement.count({ where: { code } });
    }
    const newAchievements: EarnedBadgeDto[] = newCodes
      .map(achievementByCode)
      .filter((d): d is NonNullable<typeof d> => !!d)
      .map((d) => ({
        code: d.code,
        name: d.name,
        description: d.description,
        requirement: d.requirement,
        icon: d.icon,
      }));
    const message = this.celebration(newAchievements, stats, totalPlies as number);

    return {
      win: {
        id: win.id,
        mode: win.mode,
        totalPlies: win.totalPlies,
        playedAt: win.playedAt.toISOString(),
      },
      alreadyRecorded: false,
      duplicate: false,
      newAchievements,
      stats,
      message,
    };
  }

  /** Wins newest-first, without notation (the list stays light). */
  async getMyWins(userId: string, limit: number, offset: number) {
    if (!this.prisma.isConnected) return { wins: [], total: 0 };
    const [rows, total] = await Promise.all([
      this.prisma.aiWin.findMany({
        where: { userId },
        orderBy: { playedAt: 'desc' },
        take: Math.min(Math.max(limit, 1), 50),
        skip: Math.max(offset, 0),
        select: {
          id: true,
          mode: true,
          totalPlies: true,
          durationSeconds: true,
          playedAt: true,
          createdAt: true,
        },
      }),
      this.prisma.aiWin.count({ where: { userId } }),
    ]);
    return {
      wins: rows.map((w) => ({
        ...w,
        playedAt: w.playedAt.toISOString(),
        createdAt: w.createdAt.toISOString(),
      })),
      total,
    };
  }

  /** Full record including notation, owner only — this is the analysis view. */
  async getWinDetail(userId: string, id: string) {
    if (!this.prisma.isConnected) throw new NotFoundException('Win not found.');
    const win = await this.prisma.aiWin.findFirst({ where: { id, userId } });
    if (!win) throw new NotFoundException('Win not found.');
    return {
      ...win,
      playedAt: win.playedAt.toISOString(),
      createdAt: win.createdAt.toISOString(),
    };
  }

  /**
   * Earned badges, equipped slots, the full catalog with earned flags, the
   * unique-win counter, and owner counts per code (rarity for detail views).
   */
  async getMyAchievements(userId: string) {
    if (!this.prisma.isConnected) {
      return {
        earned: [],
        equipped: [],
        catalog: ACHIEVEMENTS.map((a) => ({ ...a, earned: false })),
        stats: { hardWins: 0, fastestPlies: null as number | null },
        owners: {} as Record<string, number>,
      };
    }
    const [earned, equipped, stats, ownerGroups] = await Promise.all([
      this.prisma.achievement.findMany({ where: { userId }, orderBy: { earnedAt: 'asc' } }),
      this.prisma.equippedBadge.findMany({ where: { userId }, orderBy: { slot: 'asc' } }),
      this.winStats(userId, {}),
      this.prisma.achievement.groupBy({ by: ['code'], _count: { code: true } }),
    ]);
    const earnedSet = new Set(earned.map((e) => e.code));
    const byCode = new Map(earned.map((e) => [e.code, e.earnedAt.toISOString()]));
    const owners: Record<string, number> = {};
    for (const g of ownerGroups) owners[g.code] = g._count.code;
    const withMeta = (d: NonNullable<ReturnType<typeof achievementByCode>>) => ({
      code: d.code,
      name: d.name,
      description: d.description,
      requirement: d.requirement,
      icon: d.icon,
    });
    return {
      earned: earned
        .map((e) => achievementByCode(e.code))
        .filter((d): d is NonNullable<typeof d> => !!d)
        .map((d) => ({ ...withMeta(d), earnedAt: byCode.get(d.code) })),
      equipped: equipped
        .map((b) => ({ ...(achievementByCode(b.code) ?? { code: b.code, name: b.code, description: '', requirement: '', icon: 'award' }), slot: b.slot }))
        .sort((a, b) => a.slot - b.slot),
      catalog: ACHIEVEMENTS.map((a) => ({ ...a, earned: earnedSet.has(a.code) })),
      stats: { hardWins: stats.hardWins, fastestPlies: stats.fastestPlies },
      owners,
    };
  }

  /**
   * Sets the three showcase slots. Codes must be earned achievements;
   * duplicates collapse to their first slot, the rest clear. Unknown codes
   * are rejected, never stored.
   */
  async setBadges(userId: string, slots: (string | null)[]) {
    if (!Array.isArray(slots) || slots.length !== BADGE_SLOTS) {
      throw new BadRequestException(`slots must be an array of ${BADGE_SLOTS}.`);
    }
    if (!this.prisma.isConnected) {
      throw new BadRequestException('Database unavailable.');
    }
    for (const code of slots) {
      if (code !== null && !achievementByCode(code)) {
        throw new BadRequestException(`Unknown badge: ${code}.`);
      }
    }
    const earned = await this.prisma.achievement.findMany({ where: { userId } });
    const earnedSet = new Set(earned.map((e) => e.code));
    const seen = new Set<string>();
    const clean: (string | null)[] = slots.map((code) => {
      if (code === null || !earnedSet.has(code) || seen.has(code)) return null;
      seen.add(code);
      return code;
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.equippedBadge.deleteMany({ where: { userId } });
      const rows = clean
        .map((code, slot) => (code === null ? null : { userId, code, slot }))
        .filter((r): r is { userId: string; code: string; slot: number } => r !== null);
      if (rows.length > 0) await tx.equippedBadge.createMany({ data: rows });
    });

    return this.getMyAchievements(userId);
  }

  /**
   * Badge payload for profile views (own and public): equipped badges with
   * catalog text, plus hard-AI totals. One shape everywhere a profile
   * renders, so the showcase looks identical to the owner and to visitors.
   */
  async badgesForProfile(userId: string) {
    const equipped = this.prisma.isConnected
      ? await this.prisma.equippedBadge.findMany({ where: { userId }, orderBy: { slot: 'asc' } })
      : [];
    const stats = await this.winStats(userId, {});
    return {
      equipped: equipped.map((b) => ({
        ...(achievementByCode(b.code) ?? { code: b.code, name: b.code, description: '', icon: 'award' }),
        slot: b.slot,
      })),
      hardWins: stats.hardWins,
      fastestPlies: stats.fastestPlies,
    };
  }

  // -------------------------------------------------------------------------

  /**
   * Award whatever this NEW UNIQUE win earns. Only called for a sequence this
   * account has never stored: repeats never reach here, so milestones can
   * only ever move forward. Counts are unique sequences by construction —
   * every stored row is a different game.
   */
  private async evaluateWins(userId: string, mode: string, totalPlies: number): Promise<string[]> {
    const [count, existing] = await Promise.all([
      this.prisma.aiWin.count({ where: { userId } }),
      this.prisma.achievement.findMany({ where: { userId } }),
    ]);
    const owned = new Set(existing.map((e) => e.code));
    const earn: string[] = [];
    for (const milestone of WIN_MILESTONES) {
      if (count >= milestone.at && !owned.has(milestone.code)) earn.push(milestone.code);
    }
    if (totalPlies <= swiftPliesFor(mode) && !owned.has('blitzmind')) earn.push('blitzmind');
    if (mode !== '2p' && !owned.has('arena-master')) earn.push('arena-master');
    for (const code of earn) {
      try {
        await this.prisma.achievement.create({ data: { userId, code } });
      } catch {
        // Already earned between check and write — the unique index wins.
      }
    }
    return earn.filter((code) =>
      achievementByCode(code) !== undefined
    );
  }

  private async winStats(
    userId: string,
    owners: Record<string, number>
  ): Promise<SubmitAiWinResult['stats']> {
    if (!this.prisma.isConnected) {
      return { hardWins: 0, fastestPlies: null, owners, speedRank: null };
    }
    const [count, fastest] = await Promise.all([
      this.prisma.aiWin.count({ where: { userId } }),
      this.prisma.aiWin.aggregate({ where: { userId }, _min: { totalPlies: true } }),
    ]);
    const fastestPlies = fastest._min.totalPlies ?? null;
    let speedRank: number | null = null;
    if (fastestPlies !== null) {
      // Owners whose best hard win is strictly faster sit ahead.
      const groups = await this.prisma.aiWin.groupBy({
        by: ['userId'],
        _min: { totalPlies: true },
      });
      const faster = groups.filter((g) => (g._min.totalPlies ?? Infinity) < fastestPlies).length;
      speedRank = faster + 1;
    }
    return { hardWins: count, fastestPlies, owners, speedRank };
  }

  /**
   * The line that makes the win feel singular: rarity first, then speed,
   * then belonging. Server-computed from real owner counts, so "only N
   * players own this" is a fact, not marketing.
   */
  private celebration(
    earned: EarnedBadgeDto[],
    stats: SubmitAiWinResult['stats'],
    totalPlies: number
  ): string {
    if (earned.length === 0) return '';
    const first = earned[0];
    const owners = stats.owners[first.code] ?? 0;
    if (owners <= 1) {
      return `You're the first player in the world to earn ${first.name}. Nobody else has done this.`;
    }
    if (owners <= 10) {
      return `Only ${owners} players in the world own ${first.name}. You're one of them.`;
    }
    if (stats.speedRank === 1) {
      return `${first.name} earned — and your ${totalPlies}-move win is the fastest hard-AI win on record.`;
    }
    if (stats.speedRank !== null && stats.speedRank <= 5) {
      return `${first.name} earned — your ${totalPlies}-move win ranks #${stats.speedRank} of all time.`;
    }
    return `${first.name} earned — ${owners} players own this badge, and now you're one of them.`;
  }
}
