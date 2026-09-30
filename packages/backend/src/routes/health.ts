import type { FastifyPluginAsync } from 'fastify';

const healthRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/health', async (_req, reply) => {
    const checks = await Promise.allSettled([
      fastify.pg.query('SELECT 1'),
      fastify.redis.ping(),
    ]);

    const [pgResult, redisResult] = checks;

    const services = {
      postgres: pgResult.status === 'fulfilled' ? 'ok' : 'error',
      redis: redisResult.status === 'fulfilled' ? 'ok' : 'error',
    } as const;

    const healthy = Object.values(services).every((s) => s === 'ok');

    const body = {
      status: healthy ? 'ok' : 'degraded',
      services,
      uptime_s: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };

    // Return 200 even when degraded so the process isn't killed by orchestrators.
    // Callers can inspect the body for individual service states.
    return reply.status(200).send(body);
  });
};

export default healthRoute;
