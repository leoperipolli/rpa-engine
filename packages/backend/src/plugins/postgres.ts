import fp from 'fastify-plugin';
import pg from 'pg';
import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';

// ─── Type augmentation ───────────────────────────────────────────────────────

declare module 'fastify' {
  interface FastifyInstance {
    pg: pg.Pool;
  }
}

// ─── Plugin ──────────────────────────────────────────────────────────────────

export default fp(async (fastify: FastifyInstance) => {
  const pool = new pg.Pool({ connectionString: config.DATABASE_URL });

  // Verify connectivity on startup
  const client = await pool.connect();
  await client.query('SELECT 1');
  client.release();
  fastify.log.info('[postgres] connected');

  fastify.decorate('pg', pool);

  fastify.addHook('onClose', async () => {
    await pool.end();
    fastify.log.info('[postgres] pool closed');
  });
}, { name: 'postgres' });
