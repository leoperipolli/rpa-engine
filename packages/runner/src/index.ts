// @rpa/runner — Playwright + BullMQ worker entry point
import { createWorker, log } from './worker.js';

const { shutdown } = createWorker();

async function handleSignal(signal: string): Promise<void> {
  log.info(`[runner] received ${signal}, shutting down gracefully`);
  await shutdown();
  process.exit(0);
}

process.on('SIGTERM', () => { handleSignal('SIGTERM').catch(console.error); });
process.on('SIGINT',  () => { handleSignal('SIGINT').catch(console.error); });

process.on('unhandledRejection', (err) => {
  log.error(err, '[runner] unhandled rejection — exiting');
  process.exit(1);
});
