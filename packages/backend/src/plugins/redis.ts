import fp from 'fastify-plugin';
import Redis from 'ioredis';
import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';

// ─── Type augmentation ───────────────────────────────────────────────────────

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
  }
}

// ─── Plugin ──────────────────────────────────────────────────────────────────

export default fp(async (fastify: FastifyInstance) => {
  const redis = new Redis(config.REDIS_URL, {
    // Required by BullMQ-compatible clients; harmless for plain usage
    maxRetriesPerRequest: null,
    lazyConnect: true,
  });

  await redis.connect();
  await redis.ping();
  fastify.log.info('[redis] connected');

  fastify.decorate('redis', redis);

  fastify.addHook('onClose', async () => {
    await redis.quit();
    fastify.log.info('[redis] connection closed');
  });
}, { name: 'redis' });
