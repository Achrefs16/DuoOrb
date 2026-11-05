import { Logger } from '@nestjs/common';
import type { PrismaService } from '../database/prisma.service.js';
import { BOT_PERSONAS, personaById } from './bot-roster.js';
import { ensureBotMatchHistory } from './bot-history-seeder.js';

const logger = new Logger('BotSeeder');

/**
 * Idempotently create the computer-opponent accounts (user + profile +
 * rating). Safe to run on every boot: existing rows are never touched
 * (`skipDuplicates`), so a restart cannot reset a bot's rating or history.
 */
export async function ensureBotRoster(prisma: PrismaService): Promise<void> {
  if (!prisma.isConnected) return;
  try {
    await prisma.user.createMany({
      data: BOT_PERSONAS.map((p) => ({ id: p.userId })),
      skipDuplicates: true,
    });
    await prisma.profile.createMany({
      data: BOT_PERSONAS.map((p) => ({
        userId: p.userId,
        username: p.username,
        displayName: p.displayName,
      })),
      skipDuplicates: true,
    });
    // Ensure existing bot profiles receive the updated authentic usernames & display names
    for (const p of BOT_PERSONAS) {
      await prisma.profile.updateMany({
        where: { userId: p.userId },
        data: { username: p.username, displayName: p.displayName },
      });
    }
    await prisma.rating.createMany({
      data: BOT_PERSONAS.map((p) => ({
        userId: p.userId,
        rating: p.targetRating,
        rd: 70,
        vol: 0.06,
        gamesPlayed: p.gamesPlayed,
        wins: p.wins,
        losses: p.gamesPlayed - p.wins,
      })),
      skipDuplicates: true,
    });
    const profiles = await prisma.profile.count({
      where: { userId: { in: BOT_PERSONAS.map((p) => p.userId) } },
    });
    if (profiles < BOT_PERSONAS.length) {
      logger.warn(
        `Only ${profiles}/${BOT_PERSONAS.length} bot profiles exist (username collision?). Missing bots will not be used.`
      );
    }

    // Seed believable match histories for all bot personas
    await ensureBotMatchHistory(prisma);
  } catch (err: any) {
    logger.error(`Bot roster seeding failed: ${err?.message}`);
  }
}

/** Personas whose profile row actually exists (safe to seat). Falls back to all roster personas if DB is cold. */
export async function seatableBotIds(prisma: PrismaService): Promise<Set<string>> {
  if (!prisma.isConnected) return new Set(BOT_PERSONAS.map((p) => p.userId));
  try {
    const rows = await prisma.profile.findMany({
      where: { userId: { in: BOT_PERSONAS.map((p) => p.userId) } },
      select: { userId: true },
    });
    if (rows.length === 0) {
      return new Set(BOT_PERSONAS.map((p) => p.userId));
    }
    return new Set(rows.map((r) => r.userId));
  } catch {
    return new Set(BOT_PERSONAS.map((p) => p.userId));
  }
}

const MAX_DRIFT = 120;

/**
 * Keep a bot's rating inside a believable band around its persona target.
 * Called after each of its games: smoothly rubber-bands the rating back toward
 * targetRating if it drifts more than 60 Elo, and firmly clamps it at ±120.
 */
export async function restoreBotRatingBand(
  prisma: PrismaService,
  botUserId: string
): Promise<void> {
  const persona = personaById(botUserId);
  if (!persona || !prisma.isConnected) return;
  try {
    const row = await prisma.rating.findUnique({ where: { userId: botUserId } });
    if (!row) return;
    const diff = row.rating - persona.targetRating;
    if (Math.abs(diff) > 60) {
      // Smooth rubber-band: pull 35% back towards target rating, firmly clamped within MAX_DRIFT
      const clampedDiff = Math.max(-MAX_DRIFT, Math.min(MAX_DRIFT, diff));
      const rubberBanded = persona.targetRating + clampedDiff * 0.65;
      await prisma.rating.update({
        where: { userId: botUserId },
        data: { rating: Math.round(rubberBanded), rd: Math.min(row.rd, 80) },
      });
    }
  } catch (err: any) {
    logger.warn(`Bot rating restore failed for ${botUserId}: ${err?.message}`);
  }
}

