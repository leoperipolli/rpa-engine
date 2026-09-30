import { buildServer } from './server.js';
import { config } from './config.js';

async function main() {
  const app = await buildServer();
  await app.listen({ port: config.PORT, host: config.HOST });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
