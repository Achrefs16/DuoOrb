import { describe, expect, it, beforeEach } from 'vitest';
import { GuestService } from './guest.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { AuthService } from '../auth/auth.service.js';
import { GuestTokenService } from '../auth/guest-token.service.js';
import { sha256 } from './guest-token.js';
import { UnauthorizedException } from '@nestjs/common';

/**
 * In-memory stand-in for the guest_sessions table. Only the surface the
 * service actually touches is implemented.
 */
function fakePrisma() {
  const rows = new Map<string, any>();
  const byHash = new Map<string, string>();
  const byPrev = new Set<string>();
  let seq = 0;

  const prisma: any = {
    isConnected: true,
    user: {
      findUnique: async ({ where }: any) =>
        where.id?.startsWith('u_') ? null : null, // ids we hand out are always free
    },
    guestSession: {
      create: async ({ data }: any) => {
        const id = `gs-${++seq}`;
        rows.set(id, { id, ...data, revokedAt: null, prevTokenHash: null });
        byHash.set(data.tokenHash, id);
        return rows.get(id);
      },
      findUnique: async ({ where }: any) => {
        const id = where.tokenHash ? byHash.get(where.tokenHash) : where.id;
        return id ? rows.get(id) ?? null : null;
      },
      findFirst: async ({ where }: any) => {
        if (!where.prevTokenHash) return null;
        for (const row of rows.values()) {
          if (row.prevTokenHash === where.prevTokenHash) return row;
        }
        return null;
      },
      update: async ({ where, data }: any) => {
        const row = rows.get(where.id);
        if (!row) throw new Error('not found');
        if (row.tokenHash) byHash.delete(row.tokenHash);
        if (row.prevTokenHash) byPrev.delete(row.prevTokenHash);
        Object.assign(row, data);
        if (data.tokenHash) byHash.set(data.tokenHash, row.id);
        if (data.prevTokenHash) byPrev.add(data.prevTokenHash);
        return row;
      },
      updateMany: async ({ where, data }: any) => {
        let n = 0;
        for (const row of rows.values()) {
          if (row.userId === where.userId && !row.revokedAt) {
            Object.assign(row, data);
            n++;
          }
        }
        return { count: n };
      },
      deleteMany: async () => ({ count: 0 }),
    },
  };
  return { prisma, rows, byHash };
}

function build(secret = 'x'.repeat(48)) {
  const { prisma, rows } = fakePrisma();
  const authService = { getOrCreateUser: async ({ sub }: any) => ({
    id: sub,
    username: `player_${sub.slice(2, 8)}`,
    displayName: 'SwiftOrb42',
  }) } as unknown as AuthService;

  process.env.GUEST_TOKEN_SECRET = secret;
  const tokens = new GuestTokenService();
  tokens.onModuleInit();

  const service = new GuestService(prisma as PrismaService, authService, tokens);
  const meta = { ipHash: 'iphash', userAgent: 'jest' };
  return { service, rows, meta };
}

describe('GuestService', () => {
  beforeEach(() => {
    process.env.GUEST_TOKEN_SECRET = 'x'.repeat(48);
  });

  it('issues a guest with a u_ id, tokens, username and display name', async () => {
    const { service, meta } = build();
    const g = await service.createGuest(meta);

    expect(g.userId).toMatch(/^u_[a-z0-9]{8}$/);
    expect(g.accessToken.split('.')).toHaveLength(3);
    expect(g.refreshToken.length).toBeGreaterThanOrEqual(40);
    expect(g.username).toBe(`player_${g.userId.slice(2, 8)}`);
    expect(g.displayName).toBe('SwiftOrb42');
    expect(g.accessExpiresAt).toBeGreaterThan(Date.now());
  });

  it('never stores the raw refresh token', async () => {
    const { service, rows, meta } = build();
    const g = await service.createGuest(meta);
    const row = [...rows.values()][0];
    expect(row.tokenHash).toBe(sha256(g.refreshToken));
    expect(row.tokenHash).not.toBe(g.refreshToken);
  });

  it('verifies its own access token synchronously', async () => {
    const { service, meta } = build();
    const g = await service.createGuest(meta);
    expect(service.verifyAccessToken(g.accessToken)).toBe(g.userId);
  });

  it('returns null for junk instead of throwing', async () => {
    const { service } = build();
    for (const bad of [undefined, null, '', 'garbage', 'a.b.c']) {
      expect(service.verifyAccessToken(bad as any)).toBeNull();
    }
  });

  it('refuses an unconfigured service rather than signing with nothing', async () => {
    const { service, meta } = build('');
    expect(service.isConfigured).toBe(false);
    await expect(service.createGuest(meta)).rejects.toThrow(UnauthorizedException);
  });

  it('refuses a secret shorter than 32 characters', async () => {
    const { service } = build('tooshort');
    expect(service.isConfigured).toBe(false);
  });

  it('accepts a comma separated rotation window', async () => {
    const older = 'y'.repeat(48);
    const { service } = build(`${older},${'z'.repeat(48)}`);
    expect(service.isConfigured).toBe(true);
  });

  it('issues a distinct access token every time, even in the same second', async () => {
    const { service, meta } = build();
    const a = await service.createGuest(meta);
    const b = await service.createGuest(meta);
    expect(a.accessToken).not.toBe(b.accessToken);
  });

  it('rotates both tokens on refresh', async () => {
    const { service, meta } = build();
    const first = await service.createGuest(meta);
    const second = await service.refreshGuest(first.refreshToken, meta);

    expect(second.accessToken).not.toBe(first.accessToken);
    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect(second.userId).toBe(first.userId);
    expect(second.username).toBe(first.username);
  });

  it('rejects the spent refresh token (rotation works)', async () => {
    const { service, meta } = build();
    const first = await service.createGuest(meta);
    await service.refreshGuest(first.refreshToken, meta);
    await expect(service.refreshGuest(first.refreshToken, meta)).rejects.toThrow(
      UnauthorizedException
    );
  });

  it('revokes the whole session when a rotated token is replayed', async () => {
    const { service, rows, meta } = build();
    const first = await service.createGuest(meta);
    const second = await service.refreshGuest(first.refreshToken, meta);

    // Attacker replays the stolen, already-spent token.
    await expect(service.refreshGuest(first.refreshToken, meta)).rejects.toThrow();

    // The legitimate holder is locked out too — that is the intended trade.
    await expect(service.refreshGuest(second.refreshToken, meta)).rejects.toThrow(
      UnauthorizedException
    );
    expect([...rows.values()].some((r) => r.revokedAt !== null)).toBe(true);
  });

  it('refuses refresh for an unknown token', async () => {
    const { service, meta } = build();
    await service.createGuest(meta);
    await expect(service.refreshGuest('never-issued', meta)).rejects.toThrow(
      UnauthorizedException
    );
  });

  it('refuses refresh once the session is revoked', async () => {
    const { service, meta } = build();
    const g = await service.createGuest(meta);
    await service.revokeForUser(g.userId);
    await expect(service.refreshGuest(g.refreshToken, meta)).rejects.toThrow(
      UnauthorizedException
    );
  });
});
