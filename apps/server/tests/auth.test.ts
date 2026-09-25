import { describe, expect, it } from 'vitest';
import { AuthService } from '../src/auth/auth.service.js';
import { PrismaService } from '../src/database/prisma.service.js';

describe('Auth Service', () => {
  it('verifies dev tokens and generates consistent fallback profile', async () => {
    const prisma = new PrismaService();
    // In test environment, prisma is not connected to a real Postgres instance
    prisma.isConnected = false;

    const authService = new AuthService(prisma);

    const claims = await authService.verifyToken('dev-user-alice:alice@duoorb.com');
    // The dev- prefix is transport only: the stable identity both sides share is 'user-alice'.
    expect(claims.sub).toBe('user-alice');
    expect(claims.email).toBe('alice@duoorb.com');

    const user = await authService.getOrCreateUser(claims);
    expect(user.id).toBe('user-alice');
    expect(user.email).toBe('alice@duoorb.com');
    expect(user.displayName).toContain('Dev');
  });
});
