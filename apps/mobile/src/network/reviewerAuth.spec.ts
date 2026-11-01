import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loginReviewerSession } from './apiClient';
import { setIdentity, getIdentity, clearIdentity, hydrateIdentity } from './auth';

describe('Reviewer Authentication (Mobile Client)', () => {
  beforeEach(() => {
    clearIdentity();
    vi.restoreAllMocks();
  });

  it('calls /auth/reviewer/login with credentials and receives session', async () => {
    const mockResponse = {
      userId: 'e0000000-0000-4000-8000-000000000001',
      email: 'playreview@duoorb.com',
      username: 'playreview',
      displayName: 'Play Reviewer',
      accessToken: 'test-reviewer-jwt-token',
      refreshToken: null,
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as any);

    const result = await loginReviewerSession('playreview@duoorb.com', 'Review2026@DuoOrb!');

    expect(fetchSpy).toHaveBeenCalled();
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toContain('/auth/reviewer/login');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({
      email: 'playreview@duoorb.com',
      password: 'Review2026@DuoOrb!',
    });

    expect(result).toEqual(mockResponse);
  });

  it('installs reviewer session into canonical identity with isGuest: false', () => {
    const reviewerData = {
      userId: 'e0000000-0000-4000-8000-000000000001',
      email: 'playreview@duoorb.com',
      username: 'playreview',
      displayName: 'Play Reviewer',
      accessToken: 'test-jwt',
      refreshToken: null,
    };

    setIdentity({
      userId: reviewerData.userId,
      username: reviewerData.username,
      displayName: reviewerData.displayName,
      accessToken: reviewerData.accessToken,
      refreshToken: null,
      isGuest: false,
    });

    const current = getIdentity();
    expect(current).not.toBeNull();
    expect(current?.userId).toBe(reviewerData.userId);
    expect(current?.username).toBe('playreview');
    expect(current?.isGuest).toBe(false);
    expect(current?.accessToken).toBe('test-jwt');
  });

  it('throws ApiError with message on 401 response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Invalid email or password.' }),
    } as any);

    await expect(
      loginReviewerSession('playreview@duoorb.com', 'wrongpassword')
    ).rejects.toThrow('Invalid email or password.');
  });
});

