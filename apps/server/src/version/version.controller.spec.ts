import { describe, it, expect } from 'vitest';
import { VersionController } from './version.controller.js';

describe('VersionController', () => {
  it('returns default version payload matching current release targets', () => {
    const controller = new VersionController();
    const result = controller.getVersion();

    expect(result.latestVersion).toBe('1.0.8');
    expect(result.latestVersionCode).toBe(21);
    expect(result.minSupportedVersionCode).toBe(15);
    expect(result.title).toBe("What's New in DuoOrb");
    expect(result.storeUrl).toContain('com.asdigital.duoorb');
    expect(result.releaseNotes.length).toBeGreaterThan(0);
  });

  it('respects environment overrides when provided', () => {
    process.env.LATEST_VERSION_NAME = '1.0.6';
    process.env.LATEST_VERSION_CODE = '18';
    process.env.MIN_SUPPORTED_VERSION_CODE = '17';
    process.env.UPDATE_MESSAGE = 'Urgent update';

    const controller = new VersionController();
    const result = controller.getVersion();

    expect(result.latestVersion).toBe('1.0.6');
    expect(result.latestVersionCode).toBe(18);
    expect(result.minSupportedVersionCode).toBe(17);
    expect(result.message).toBe('Urgent update');

    delete process.env.LATEST_VERSION_NAME;
    delete process.env.LATEST_VERSION_CODE;
    delete process.env.MIN_SUPPORTED_VERSION_CODE;
    delete process.env.UPDATE_MESSAGE;
  });
});

