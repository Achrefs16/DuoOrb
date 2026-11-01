import { describe, expect, it } from 'vitest';
import {
  signReviewerAccessToken,
  verifyReviewerAccessToken,
} from './reviewer-token.js';

describe('reviewer token signing and verification', () => {
  const secret = Buffer.from('test-reviewer-secret-key-at-least-32-chars!!', 'utf8');
  const userId = 'e0000000-0000-4000-8000-000000000001';
  const email = 'playreview@duoorb.com';
  const displayName = 'Play Reviewer';

  it('signs and verifies a valid reviewer access token', () => {
    const { token, expiresAt } = signReviewerAccessToken(userId, email, displayName, secret, 3600);
    expect(token).toBeDefined();
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

    const claims = verifyReviewerAccessToken(token, [secret]);
    expect(claims).not.toBeNull();
    expect(claims?.sub).toBe(userId);
    expect(claims?.email).toBe(email);
    expect(claims?.displayName).toBe(displayName);
    expect(claims?.role).toBe('reviewer');
    expect(claims?.typ).toBe('duoorb-reviewer');
  });

  it('rejects tokens signed with an unknown secret', () => {
    const foreignSecret = Buffer.from('another-secret-key-32-characters-long!', 'utf8');
    const { token } = signReviewerAccessToken(userId, email, displayName, foreignSecret, 3600);

    const claims = verifyReviewerAccessToken(token, [secret]);
    expect(claims).toBeNull();
  });

  it('rejects expired reviewer tokens', () => {
    // 10 seconds in the past
    const { token } = signReviewerAccessToken(userId, email, displayName, secret, -10);
    const claims = verifyReviewerAccessToken(token, [secret]);
    expect(claims).toBeNull();
  });

  it('rejects tampered tokens or malformed strings', () => {
    const { token } = signReviewerAccessToken(userId, email, displayName, secret, 3600);
    const tampered = token.slice(0, -5) + 'xxxxx';
    expect(verifyReviewerAccessToken(tampered, [secret])).toBeNull();
    expect(verifyReviewerAccessToken('', [secret])).toBeNull();
    expect(verifyReviewerAccessToken('invalid.token', [secret])).toBeNull();
  });

  it('supports key rotation with multiple secrets', () => {
    const oldSecret = Buffer.from('old-secret-key-minimum-32-characters-1', 'utf8');
    const newSecret = Buffer.from('new-secret-key-minimum-32-characters-2', 'utf8');

    const { token } = signReviewerAccessToken(userId, email, displayName, oldSecret, 3600);
    // Verifying with new secret first, old secret second (rotation window)
    const claims = verifyReviewerAccessToken(token, [newSecret, oldSecret]);
    expect(claims).not.toBeNull();
    expect(claims?.sub).toBe(userId);
  });
});

