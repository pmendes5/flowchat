import type { ConnectionOptions, Queue, Worker } from 'bullmq';
import type { ProcessWebhookJob } from '@flowchat/contracts';
import {
  createEventQueue,
  createEventWorker,
  type EventJobHandler,
} from './queue.js';

export type WorkerRuntime = Readonly<{
  queue: Queue<ProcessWebhookJob>;
  worker: Worker<ProcessWebhookJob>;
  close: () => Promise<void>;
}>;

export function createWorkerRuntime(
  connection: ConnectionOptions,
  handler: EventJobHandler,
): WorkerRuntime {
  const queue = createEventQueue(connection);
  const worker = createEventWorker(connection, handler);

  return {
    queue,
    worker,
    close: async () => {
      await worker.close();
      await queue.close();
    },
  };
}
