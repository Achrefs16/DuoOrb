import { describe, expect, it } from 'vitest';
import {
  USERNAME_MAX,
  USERNAME_MIN,
  assertValidDisplayName,
  assertValidUsername,
  normalizeDisplayName,
  normalizeUsername,
  validateDisplayName,
  validateUsername,
} from './username.js';
import { UsersService } from './users.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { BadRequestException, ConflictException } from '@nestjs/common';

describe('username policy', () => {
  it('normalizes case and surrounding whitespace to one identity', () => {
    expect(normalizeUsername('  Alex_1 ')).toBe('alex_1');
    expect(normalizeUsername('ALEX')).toBe('alex');
  });

  it('accepts a well-formed handle', () => {
    const res = validateUsername('orbital_9');
    expect(res.ok).toBe(true);
    expect(res.value).toBe('orbital_9');
  });

  it('rejects handles that are too short or too long', () => {
    expect(validateUsername('a'.repeat(USERNAME_MIN - 1)).ok).toBe(false);
    expect(validateUsername('a'.repeat(USERNAME_MIN)).ok).toBe(true);
    expect(validateUsername('a'.repeat(USERNAME_MAX)).ok).toBe(true);
    expect(validateUsername('a'.repeat(USERNAME_MAX + 1)).ok).toBe(false);
  });

  it('rejects characters outside lowercase letters, digits and underscore', () => {
    for (const bad of ['has space', 'dash-name', 'dot.name', 'emoji\u{1F600}x', 'sla/sh', 'Ünicode']) {
      expect(validateUsername(bad).ok, bad).toBe(false);
    }
  });

  it('rejects reserved handles that would impersonate the product', () => {
    for (const reserved of ['admin', 'duoorb', 'official', 'system', 'api', 'me', 'player']) {
      expect(validateUsername(reserved).ok, reserved).toBe(false);
    }
  });

  it('rejects an empty or non-string handle', () => {
    expect(validateUsername('').ok).toBe(false);
    expect(validateUsername('   ').ok).toBe(false);
    expect(validateUsername(undefined).ok).toBe(false);
    expect(validateUsername(42).ok).toBe(false);
  });

  it('assertValidUsername throws BadRequest and returns the normalized value', () => {
    expect(assertValidUsername(' Orbital_1 ')).toBe('orbital_1');
    expect(() => assertValidUsername('no')).toThrow(BadRequestException);
  });
});

describe('display name policy', () => {
  it('collapses internal whitespace runs', () => {
    expect(normalizeDisplayName('  Alex   B  ')).toBe('Alex B');
  });

  it('accepts free-form text including spaces and capitals', () => {
    expect(validateDisplayName('Alex B').ok).toBe(true);
    expect(validateDisplayName('吞').ok).toBe(true);
  });

  it('rejects an empty or over-long display name', () => {
    expect(validateDisplayName('   ').ok).toBe(false);
    expect(validateDisplayName('x'.repeat(33)).ok).toBe(false);
    expect(assertValidDisplayName(' Alex   B ')).toBe('Alex B');
  });
});

describe('UsersService.updateProfile validation', () => {
  function service() {
    const prisma = new PrismaService();
    prisma.isConnected = false;
    return new UsersService(prisma);
  }

  it('rejects a malformed username before touching the database', async () => {
    await expect(service().updateProfile('u_1', { username: 'has space' })).rejects.toThrow(
      BadRequestException
    );
  });

  it('rejects an empty patch rather than silently succeeding', async () => {
    await expect(service().updateProfile('u_1', {})).rejects.toThrow(BadRequestException);
  });

  it('normalizes the username it echoes back', async () => {
    const res = await service().updateProfile('u_1', { username: '  Orbital_1 ' });
    expect(res).toMatchObject({ userId: 'u_1', username: 'orbital_1' });
  });

  it('lets a display name change without requiring a username', async () => {
    const res = await service().updateProfile('u_1', { displayName: '  Alex   B ' });
    expect(res).toMatchObject({ displayName: 'Alex B' });
  });
});

describe('UsersService username availability', () => {
  it('reports a handle as available when no other profile holds it', async () => {
    const prisma = new PrismaService();
    prisma.isConnected = true;
    (prisma as unknown as { profile: { findFirst: unknown } }).profile = {
      findFirst: async () => null,
    };
    const res = await new UsersService(prisma).isUsernameAvailable(' Free_Name ', 'u_self');
    expect(res).toEqual({ username: 'free_name', available: true });
  });

  it('reports a handle as taken when another profile holds it', async () => {
    const prisma = new PrismaService();
    prisma.isConnected = true;
    (prisma as unknown as { profile: { findFirst: unknown } }).profile = {
      findFirst: async () => ({ userId: 'u_other', username: 'taken_name' }),
    };
    const res = await new UsersService(prisma).isUsernameAvailable('taken_name', 'u_self');
    expect(res).toEqual({ username: 'taken_name', available: false });
  });

  it('applies the same policy as the save path', async () => {
    await expect(
      serviceUnavailable().isUsernameAvailable('bad handle', 'u_self')
    ).rejects.toThrow(BadRequestException);
  });

  function serviceUnavailable() {
    const prisma = new PrismaService();
    prisma.isConnected = false;
    return new UsersService(prisma);
  }
});

describe('UsersService.updateProfile conflict handling', () => {
  it('turns a losing unique race into a 409 instead of a 500', async () => {
    const prisma = new PrismaService();
    prisma.isConnected = true;
    const race = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
    (prisma as unknown as { profile: Record<string, unknown> }).profile = {
      // Pre-check finds nothing, so the write is what collides.
      findFirst: async () => null,
      upsert: async () => {
        throw race;
      },
    };

    await expect(
      new UsersService(prisma).updateProfile('u_racer', { username: 'contested' })
    ).rejects.toThrow(ConflictException);
  });
});
