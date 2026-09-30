import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config.js';
import {
  hashApiKey,
  dbFindApiKeyByHash,
  dbUpdateApiKeyLastUsed,
} from '../db/api-keys.js';

// ─── Type augmentation ───────────────────────────────────────────────────────

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

// ─── Plugin ──────────────────────────────────────────────────────────────────

export default fp(async (fastify: FastifyInstance) => {
  fastify.decorate(
    'authenticate',
    async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const key = req.headers['x-api-key'];
      if (!key || typeof key !== 'string') {
        return reply.status(401).send({ error: 'Missing X-API-Key header' });
      }

      // Fast path: check against master key (env var) — no DB round-trip
      if (key === config.API_KEY) {
        return;
      }

      // Slow path: check against DB api_keys table
      const hash = hashApiKey(key);
      const apiKey = await dbFindApiKeyByHash(fastify.pg, hash);
      if (!apiKey) {
        return reply.status(401).send({ error: 'Invalid API key' });
      }

      // Track last usage in background — not critical path
      dbUpdateApiKeyLastUsed(fastify.pg, apiKey.id).catch((err) =>
        fastify.log.warn(err, '[auth] failed to update last_used_at'),
      );
    },
  );

  fastify.log.info('[auth] API key middleware ready');
}, { name: 'auth' });
