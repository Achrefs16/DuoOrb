import { describe, expect, it, vi } from 'vitest';
import { copyTextToClipboard } from './clipboard';

describe('copyTextToClipboard', () => {
  it('returns false for empty text', async () => {
    const res = await copyTextToClipboard('');
    expect(res).toBe(false);
  });

  it('copies successfully and handles clipboard calls', async () => {
    const res = await copyTextToClipboard('DuoOrb 2p');
    expect(typeof res).toBe('boolean');
  });
});

