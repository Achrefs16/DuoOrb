import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('password hashing and verification', () => {
  it('hashes a password and verifies it successfully', async () => {
    const password = 'SuperSecretPassword#123';
    const hash = await hashPassword(password);

    expect(hash).toMatch(/^scrypt:[0-9a-f]{32}:[0-9a-f]{128}$/);
    const valid = await verifyPassword(password, hash);
    expect(valid).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const password = 'SuperSecretPassword#123';
    const hash = await hashPassword(password);

    const valid = await verifyPassword('WrongPassword', hash);
    expect(valid).toBe(false);
  });

  it('produces different hashes for the same password due to random salt', async () => {
    const password = 'IdenticalPassword';
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    expect(hash1).not.toBe(hash2);
    expect(await verifyPassword(password, hash1)).toBe(true);
    expect(await verifyPassword(password, hash2)).toBe(true);
  });

  it('handles invalid or empty inputs gracefully', async () => {
    expect(await verifyPassword('', 'scrypt:salt:hash')).toBe(false);
    expect(await verifyPassword('pwd', '')).toBe(false);
    expect(await verifyPassword('pwd', 'invalid:format')).toBe(false);
    await expect(hashPassword('')).rejects.toThrow();
  });
});

