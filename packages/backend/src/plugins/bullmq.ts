import fp from 'fastify-plugin';
import { Queue, QueueEvents } from 'bullmq';
import type { ConnectionOptions } from 'bullmq';
import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import {
  dbStartExecution,
  dbCompleteExecution,
  dbFailExecution,
} from '../db/executions.js';

// ─── Job payload / result types (shared with runner) ─────────────────────────

export interface JobData {
  execution_id: string;
  recipe_id: string;
  inputs: Record<string, string>;
}

export interface JobResult {
  result: Record<string, unknown>;
  duration_ms: number;
}

// ─── Shared queue name ───────────────────────────────────────────────────────

export const RPA_QUEUE = 'rpa';

// ─── Queue manager ───────────────────────────────────────────────────────────

export interface QueueManager {
  /** Returns the single shared BullMQ Queue. */
  getQueue(): Queue<JobData, JobResult>;
  /** Returns the shared QueueEvents instance (for Job.waitUntilFinished). */
  getQueueEvents(): QueueEvents;
  closeAll(): Promise<void>;
}

// ─── Type augmentation ───────────────────────────────────────────────────────

declare module 'fastify' {
  interface FastifyInstance {
    queues: QueueManager;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Parse a redis:// URL into BullMQ-compatible connection options (plain object).
 *  Avoids dual-ioredis-version type conflicts when passing a Redis instance. */
export function parseRedisUrl(url: string): ConnectionOptions {
  const u = new URL(url);
  return {
    host: u.hostname || '127.0.0.1',
    port: u.port ? parseInt(u.port, 10) : 6379,
    ...(u.password ? { password: decodeURIComponent(u.password) } : {}),
    ...(u.pathname && u.pathname !== '/' ? { db: parseInt(u.pathname.slice(1), 10) } : {}),
    maxRetriesPerRequest: null, // required by BullMQ
  };
}

// ─── Plugin ──────────────────────────────────────────────────────────────────

export default fp(async (fastify: FastifyInstance) => {
  const connection = parseRedisUrl(config.REDIS_URL);

  // ── Single shared queue ────────────────────────────────────────────────────
  const queue = new Queue<JobData, JobResult>(RPA_QUEUE, {
    connection,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  });

  // ── QueueEvents — execution_id is the BullMQ job id ───────────────────────
  const qe = new QueueEvents(RPA_QUEUE, { connection });

  qe.on('active', ({ jobId }) => {
    dbStartExecution(fastify.pg, jobId).catch((err) =>
      fastify.log.error(err, `[bullmq] failed to mark ${jobId} running`),
    );
  });

  qe.on('completed', ({ jobId, returnvalue }) => {
    fastify.log.info({ jobId, returnvalueType: typeof returnvalue, returnvalueSnippet: String(returnvalue).substring(0, 500) }, '[bullmq] completed event received');
    let parsed: JobResult = { result: {}, duration_ms: 0 };
    try {
      parsed = typeof returnvalue === 'string' ? JSON.parse(returnvalue) as JobResult : returnvalue as unknown as JobResult;
    } catch (parseErr) {
      fastify.log.warn({ jobId, parseErr: String(parseErr), returnvalue: String(returnvalue).substring(0, 200) }, '[bullmq] could not parse returnvalue');
    }
    fastify.log.info({ jobId, parsedResultKeys: Object.keys(parsed.result ?? {}), duration_ms: parsed.duration_ms }, '[bullmq] saving to DB');
    dbCompleteExecution(
      fastify.pg,
      jobId,
      parsed.result ?? {},
      parsed.duration_ms ?? 0,
    ).then(() => {
      fastify.log.info({ jobId }, '[bullmq] DB update succeeded');
    }).catch((err) =>
      fastify.log.error(err, `[bullmq] failed to complete ${jobId}`),
    );
  });

  qe.on('failed', ({ jobId, failedReason }) => {
    dbFailExecution(fastify.pg, jobId, failedReason ?? 'Unknown error').catch(
      (err) => fastify.log.error(err, `[bullmq] failed to fail ${jobId}`),
    );
  });

  const manager: QueueManager = {
    getQueue(): Queue<JobData, JobResult> {
      return queue;
    },
    getQueueEvents(): QueueEvents {
      return qe;
    },
    async closeAll(): Promise<void> {
      await queue.close();
      await qe.close();
      fastify.log.info('[bullmq] queue and events closed');
    },
  };

  fastify.log.info('[bullmq] queue manager ready');
  fastify.decorate('queues', manager);

  fastify.addHook('onClose', () => manager.closeAll());
}, { name: 'bullmq' });
