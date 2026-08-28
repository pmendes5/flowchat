import {
  Queue,
  Worker,
  type ConnectionOptions,
  type Job,
} from 'bullmq';
import {
  PROCESS_WEBHOOK_QUEUE,
  parseProcessWebhookJob,
  type ProcessWebhookJob,
} from '@flowchat/contracts';

type QueueConstructor = new (
  name: string,
  options: ConstructorParameters<typeof Queue<ProcessWebhookJob>>[1],
) => Queue<ProcessWebhookJob>;

type WorkerConstructor = new (
  name: string,
  processor: (job: Job<ProcessWebhookJob>) => Promise<void>,
  options: ConstructorParameters<typeof Worker<ProcessWebhookJob>>[2],
) => Worker<ProcessWebhookJob>;

export type EventJobHandler = (job: Job<ProcessWebhookJob>) => Promise<void>;

export function createEventQueue(
  connection: ConnectionOptions,
  QueueCtor: QueueConstructor = Queue<ProcessWebhookJob>,
): Queue<ProcessWebhookJob> {
  return new QueueCtor(PROCESS_WEBHOOK_QUEUE, {
    connection,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    },
  });
}

export function createEventWorker(
  connection: ConnectionOptions,
  handle: EventJobHandler,
  WorkerCtor: WorkerConstructor = Worker<ProcessWebhookJob>,
): Worker<ProcessWebhookJob> {
  return new WorkerCtor(
    PROCESS_WEBHOOK_QUEUE,
    async (job) => {
      job.data = parseProcessWebhookJob(job.data);
      await handle(job);
    },
    { connection, concurrency: 5 },
  );
}
