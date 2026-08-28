import { loadConfig } from '@flowchat/config';
import { Redis } from 'ioredis';
import { pathToFileURL } from 'node:url';
import { createWorkerRuntime } from './worker.module.js';

export async function bootstrapWorker(): Promise<void> {
  const config = loadConfig(process.env);
  const connection = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
  const runtime = createWorkerRuntime(connection, async () => undefined);
  let closing = false;

  const shutdown = async (): Promise<void> => {
    if (closing) return;
    closing = true;
    await runtime.close();
    connection.disconnect();
  };

  process.once('SIGTERM', () => void shutdown());
  process.once('SIGINT', () => void shutdown());
}

const entrypoint = process.argv[1];
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
  void bootstrapWorker();
}
