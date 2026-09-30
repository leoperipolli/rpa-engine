import type { FastifyPluginAsync } from 'fastify';
import {
  CreateExecutionRequestSchema,
  ListExecutionsQuerySchema,
} from '@rpa/types';
import type { JobData, JobResult } from '../plugins/bullmq.js';
import { dbGetRecipe } from '../db/recipes.js';
import {
  dbCreateExecution,
  dbGetExecution,
  dbListExecutions,
} from '../db/executions.js';

// ─── Routes ───────────────────────────────────────────────────────────────────

const executionsRoute: FastifyPluginAsync = async (fastify) => {
  // ── POST /api/executions (sync — waits for result) ────────────────────────
  // Query param: ?timeout=60 (seconds, default 120, max 300)
  fastify.post('/api/executions', async (req, reply) => {
    const parsed = CreateExecutionRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation error',
        details: parsed.error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      });
    }

    const { recipe_id, inputs } = parsed.data;

    const recipe = await dbGetRecipe(fastify.pg, recipe_id);
    if (!recipe) {
      return reply.status(404).send({ error: 'Recipe not found' });
    }

    const execution = await dbCreateExecution(fastify.pg, { recipe_id, inputs });

    const jobData: JobData = {
      execution_id: execution.id,
      recipe_id,
      inputs,
    };
    const job = await fastify.queues.getQueue().add('run', jobData, {
      jobId: execution.id,
    });

    fastify.log.info(
      `[executions] enqueued job ${execution.id} for recipe ${recipe_id}, waiting…`,
    );

    // Parse query string params
    const query = req.query as { timeout?: string; format?: string; key?: string };
    const timeoutSec = Math.min(
      Math.max(parseInt(query.timeout ?? '120', 10) || 120, 5),
      300,
    );

    try {
      const returnvalue = await job.waitUntilFinished(
        fastify.queues.getQueueEvents(),
        timeoutSec * 1000,
      );

      // returnvalue is the JobResult
      const result = (typeof returnvalue === 'string'
        ? JSON.parse(returnvalue)
        : returnvalue) as JobResult;

      // If ?format=file&key=<name>, return the binary file directly
      if (query.format === 'file' && query.key) {
        const base64 = result.result[query.key];
        if (typeof base64 !== 'string') {
          return reply.status(404).send({ error: `Key "${query.key}" not found in result` });
        }
        const buffer = Buffer.from(base64, 'base64');
        return reply
          .header('Content-Type', 'application/octet-stream')
          .header('Content-Disposition', `attachment; filename="${query.key}"`)
          .send(buffer);
      }

      // Fetch the final execution from DB (has all fields updated)
      const final = await dbGetExecution(fastify.pg, execution.id);

      return reply.send({
        ...final,
        result: result.result,
        duration_ms: result.duration_ms,
      });
    } catch (err: unknown) {
      // Job may have failed or timed out
      const final = await dbGetExecution(fastify.pg, execution.id);
      if (final && final.status === 'failed') {
        return reply.status(422).send(final);
      }
      // Timeout or unexpected error
      return reply.status(408).send({
        error: 'Execution timed out',
        execution_id: execution.id,
        message: `Job did not finish within ${timeoutSec}s. Use GET /api/executions/${execution.id} to poll.`,
      });
    }
  });

  // ── POST /api/executions/async (fire-and-forget, returns 202) ─────────────
  fastify.post('/api/executions/async', async (req, reply) => {
    const parsed = CreateExecutionRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation error',
        details: parsed.error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      });
    }

    const { recipe_id, inputs } = parsed.data;

    // Verify the recipe exists before creating the execution
    const recipe = await dbGetRecipe(fastify.pg, recipe_id);
    if (!recipe) {
      return reply.status(404).send({ error: 'Recipe not found' });
    }

    // Create execution record (status: 'pending')
    const execution = await dbCreateExecution(fastify.pg, { recipe_id, inputs });

    // Enqueue job — use execution.id as BullMQ job ID so QueueEvents can
    // map jobId → execution_id without an extra lookup.
    const jobData: JobData = {
      execution_id: execution.id,
      recipe_id,
      inputs,
    };
    await fastify.queues.getQueue().add('run', jobData, {
      jobId: execution.id,
    });

    fastify.log.info(
      `[executions/async] enqueued job ${execution.id} for recipe ${recipe_id}`,
    );

    return reply.status(202).send(execution);
  });

  // ── GET /api/executions/:id ─────────────────────────────────────────────────
  fastify.get<{ Params: { id: string } }>(
    '/api/executions/:id',
    async (req, reply) => {
      const execution = await dbGetExecution(fastify.pg, req.params.id);
      if (!execution) {
        return reply.status(404).send({ error: 'Execution not found' });
      }
      fastify.log.debug({ executionId: execution.id, status: execution.status, hasResult: !!execution.result, resultKeys: execution.result ? Object.keys(execution.result) : [], error: execution.error }, '[executions] GET :id');
      return reply.send(execution);
    },
  );

  // ── GET /api/executions/:id/download/:key ─────────────────────────────────
  fastify.get<{ Params: { id: string; key: string } }>(
    '/api/executions/:id/download/:key',
    async (req, reply) => {
      const execution = await dbGetExecution(fastify.pg, req.params.id);
      if (!execution) {
        return reply.status(404).send({ error: 'Execution not found' });
      }
      if (execution.status !== 'success') {
        return reply.status(422).send({ error: 'Execution not completed successfully' });
      }
      const base64 = execution.result?.[req.params.key];
      if (typeof base64 !== 'string') {
        return reply.status(404).send({ error: `Key "${req.params.key}" not found in result` });
      }
      const buffer = Buffer.from(base64, 'base64');
      return reply
        .header('Content-Type', 'application/octet-stream')
        .header('Content-Disposition', `attachment; filename="${req.params.key}"`)
        .send(buffer);
    },
  );

  // ── GET /api/executions ─────────────────────────────────────────────────────
  fastify.get('/api/executions', async (req, reply) => {
    const parsed = ListExecutionsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid query parameters',
        details: parsed.error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      });
    }

    const data = await dbListExecutions(fastify.pg, parsed.data);
    return reply.send(data);
  });
};

export default executionsRoute;
