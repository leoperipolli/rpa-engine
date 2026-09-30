import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config.js';
import postgresPlugin from './plugins/postgres.js';
import redisPlugin from './plugins/redis.js';
import bullmqPlugin from './plugins/bullmq.js';
import authPlugin from './plugins/auth.js';
import healthRoute from './routes/health.js';
import recipesRoute from './routes/recipes.js';
import executionsRoute from './routes/executions.js';
import authRoute from './routes/auth.js';

export async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: config.NODE_ENV === 'production' ? 'info' : 'debug',
      transport:
        config.NODE_ENV !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  });

  // ── CORS ────────────────────────────────────────────────────────────────────
  await fastify.register(cors, {
    origin: config.NODE_ENV === 'production'
      ? (process.env.DASHBOARD_URL ?? false)
      : true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // ── Infrastructure plugins ──────────────────────────────────────────────────
  await fastify.register(postgresPlugin);
  await fastify.register(redisPlugin);
  await fastify.register(bullmqPlugin);
  await fastify.register(authPlugin);

  // ── Public routes (no auth) ─────────────────────────────────────────────────
  await fastify.register(healthRoute);

  // ── Protected routes (require X-API-Key) ───────────────────────────────────
  await fastify.register(async (app) => {
    app.addHook('preHandler', fastify.authenticate);

    await app.register(recipesRoute);
    await app.register(executionsRoute);
    await app.register(authRoute);
  });

  return fastify;
}
