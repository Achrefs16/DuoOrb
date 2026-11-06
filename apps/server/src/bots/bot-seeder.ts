import { Logger } from '@nestjs/common';
import type { PrismaService } from '../database/prisma.service.js';
import { BOT_PERSONAS, personaById } from './bot-roster.js';
import { ensureBotMatchHistory } from './bot-history-seeder.js';

const logger = new Logger('BotSeeder');

let botRosterSeeded = false;

/**
 * Idempotently create or update the computer-opponent accounts (user + profile + rating).
 * Safe to run on every boot: profiles and ratings are kept up to date with their personas.
 */
export async function ensureBotRoster(prisma: PrismaService): Promise<boolean> {
  if (!prisma.isConnected) return false;
  if (botRosterSeeded) return true;
  try {
    await prisma.user.createMany({
      data: BOT_PERSONAS.map((p) => ({ id: p.userId })),
      skipDuplicates: true,
    });
    // Ensure every bot persona has an authentic profile in PostgreSQL
    for (const p of BOT_PERSONAS) {
      await prisma.profile.upsert({
        where: { userId: p.userId },
        create: {
          userId: p.userId,
          username: p.username,
          displayName: p.displayName,
          bio: p.bio,
          isPremium: p.isPremium,
          createdAt: new Date(Date.now() - p.createdAtDaysAgo * 86400000),
        },
        update: {
          username: p.username,
          displayName: p.displayName,
          bio: p.bio,
          isPremium: p.isPremium,
        },
      });
    }
    // Ensure every bot persona has an initial rating row
    for (const p of BOT_PERSONAS) {
      await prisma.rating.upsert({
        where: { userId: p.userId },
        create: {
          userId: p.userId,
          rating: p.targetRating,
          rd: 70,
          vol: 0.06,
          gamesPlayed: p.gamesPlayed,
          wins: p.wins,
          losses: p.gamesPlayed - p.wins,
        },
        update: {
          rating: p.targetRating,
          gamesPlayed: p.gamesPlayed,
          wins: p.wins,
          losses: p.gamesPlayed - p.wins,
        },
      });
    }

    // Seed believable match histories for all bot personas
    await ensureBotMatchHistory(prisma);
    botRosterSeeded = true;
    logger.log(`Successfully ensured database records for all ${BOT_PERSONAS.length} bot personas.`);
    return true;
  } catch (err: any) {
    logger.error(`Bot roster seeding failed: ${err?.message}`);
    return false;
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

