import type { ConnectionOptions } from 'bullmq';

/**
 * Parses a redis:// URL into BullMQ ConnectionOptions (plain object).
 * Avoids dual-ioredis-version type conflicts when passing a Redis instance.
 */
export function parseRedisUrl(url: string): ConnectionOptions {
  const u = new URL(url);
  return {
    host: u.hostname || '127.0.0.1',
    port: u.port ? parseInt(u.port, 10) : 6379,
    ...(u.password ? { password: decodeURIComponent(u.password) } : {}),
    ...(u.pathname && u.pathname !== '/' ? { db: parseInt(u.pathname.slice(1), 10) } : {}),
    maxRetriesPerRequest: null,
  };
}
