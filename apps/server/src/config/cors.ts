import { Logger } from '@nestjs/common';

const logger = new Logger('CorsConfig');

/**
 * Origins allowed to call this server from a browser.
 *
 * Native builds are unaffected: CORS is a browser-enforced mechanism, so a
 * React Native client that sends no (or an arbitrary) Origin header still gets
 * responses. This list therefore only governs the web build, which is exactly
 * where a wildcard would be a real problem — any site on the internet could
 * otherwise open a socket to the game server and read responses.
 *
 * Configure with a comma-separated list:
 *   CORS_ORIGINS=https://duoorb.com,https://www.duoorb.com
 *
 * With nothing configured we fall back to local development origins only. A
 * wildcard is never the default; `*` must be asked for explicitly.
 */
export function resolveCorsOrigins(): string[] | '*' {
  const raw = process.env.CORS_ORIGINS?.trim();

  if (raw === '*') {
    logger.warn(
      'CORS_ORIGINS is "*" — every website can call this API. Only use this with no web build.'
    );
    return '*';
  }

  if (raw) {
    const list = raw
      .split(',')
      .map((o) => o.trim().replace(/\/+$/, ''))
      .filter(Boolean);
    if (list.length > 0) {
      logger.log(`CORS restricted to: ${list.join(', ')}`);
      return list;
    }
  }

  // No configuration: keep local web development working, and nothing else.
  logger.warn(
    'CORS_ORIGINS is not set. Only local development origins are allowed. ' +
      'Set CORS_ORIGINS to your web domain before shipping a web build.'
  );
  return [
    'http://localhost',
    'http://localhost:8081',
    'http://localhost:19006',
    'http://127.0.0.1',
    'http://127.0.0.1:8081',
    'http://127.0.0.1:19006',
  ];
}
