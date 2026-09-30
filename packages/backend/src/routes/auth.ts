import type { FastifyPluginAsync } from 'fastify';
import { randomBytes } from 'crypto';
import { dbCreateApiKey, hashApiKey } from '../db/api-keys.js';

// ─── Routes ───────────────────────────────────────────────────────────────────

const authRoute: FastifyPluginAsync = async (fastify) => {
  // ── POST /api/auth/api-keys ─────────────────────────────────────────────────
  // Requires a valid X-API-Key (env master key or an existing DB key).
  // Returns the raw key ONCE — it is never stored in plaintext.
  fastify.post('/api/auth/api-keys', async (req, reply) => {
    const body = req.body as { name?: unknown };
    const name = body?.name;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return reply.status(400).send({ error: 'name is required' });
    }

    // rpa_ prefix + 32 random bytes (hex) = 68-character key
    const rawKey = `rpa_${randomBytes(32).toString('hex')}`;
    const apiKey = await dbCreateApiKey(fastify.pg, name.trim(), hashApiKey(rawKey));

    return reply.status(201).send({
      ...apiKey,
      key: rawKey, // returned ONCE — caller must store it
    });
  });
};

export default authRoute;
