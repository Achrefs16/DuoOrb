import { describe, expect, it, beforeEach } from 'vitest';
import { AuthService } from '../src/auth/auth.service.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { GuestTokenService } from '../src/auth/guest-token.service.js';

function build(secret = 'k'.repeat(48)) {
  const prisma = new PrismaService();
  // Not connected to a real Postgres instance in tests.
  prisma.isConnected = false;

  process.env.GUEST_TOKEN_SECRET = secret;
  const guestTokens = new GuestTokenService();
  guestTokens.onModuleInit();

  return new AuthService(prisma, guestTokens);
}

describe('Auth Service', () => {
  beforeEach(() => {
    process.env.GUEST_TOKEN_SECRET = 'k'.repeat(48);
  });

  /**
   * The old behaviour trusted any string starting with "dev-", which meant
   * anyone could claim any account in production. That path is gone; these
   * tests lock the replacement in place.
   */
  it('rejects fabricated dev- tokens', async () => {
    const authService = build();
    await expect(
      authService.verifyToken('dev-user-alice:alice@duoorb.com')
    ).rejects.toThrow(/Invalid or expired token/);
  });

  it('rejects a dev- token that names a real-looking user id', async () => {
    const authService = build();
    // The exact shape an attacker would use to impersonate an account.
    await expect(
      authService.verifyToken('dev-2c812a6a-5b81-457e-8f5e-2baedceecd21:x@y.com')
    ).rejects.toThrow();
  });

  it('rejects empty and garbage tokens', async () => {
    const authService = build();
    await expect(authService.verifyToken('')).rejects.toThrow(/Missing/);
    await expect(authService.verifyToken('not-a-jwt')).rejects.toThrow();
  });

  it('accepts a server-signed guest token and reports the guest role', async () => {
    const authService = build();
    const { token } = authService['guestTokens'].sign('u_abc12345');

    const claims = await authService.verifyToken(token);
    expect(claims.sub).toBe('u_abc12345');
    expect(claims.user_metadata?.role).toBe('guest');
  });

  it('rejects a guest token signed with the wrong key', async () => {
    const issuer = build('k'.repeat(48));
    const other = build('j'.repeat(48));
    const { token } = issuer['guestTokens'].sign('u_abc12345');

    await expect(other.verifyToken(token)).rejects.toThrow();
  });

  it('rejects guest tokens entirely when no secret is configured', async () => {
    const authService = build('');
    const signer = build('k'.repeat(48));
    const { token } = signer['guestTokens'].sign('u_abc12345');

    await expect(authService.verifyToken(token)).rejects.toThrow();
  });

  it('still provisions a consistent fallback profile for a guest', async () => {
    const authService = build();
    const { token } = authService['guestTokens'].sign('u_abc12345');
    const claims = await authService.verifyToken(token);

    const user = await authService.getOrCreateUser(claims);
    expect(user.id).toBe('u_abc12345');
    // No database in tests, so it falls back to a deterministic handle built
    // from the first 6 id characters. Note it contains underscores because
    // guest ids start with "u_" — the client's isGeneratedUsername compares
    // against this exact form for the same reason.
    expect(user.username).toBe('player_u_abc1');
  });
});
