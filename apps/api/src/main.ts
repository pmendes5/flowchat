import type { AppConfig } from '@flowchat/config';
import { loadConfig } from '@flowchat/config';
import { prisma } from '@flowchat/database';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { Redis } from 'ioredis';
import { Queue } from 'bullmq';
import { PROCESS_WEBHOOK_QUEUE, type ProcessWebhookJob } from '@flowchat/contracts';
import 'reflect-metadata';
import { pathToFileURL } from 'node:url';
import { AppModule } from './app.module.js';
import type { HealthProbes } from './health.controller.js';
import type { WebhookIngestionDependencies } from './webhooks/webhook-ingestion.service.js';

function createWebhookDependencies(config: AppConfig): WebhookIngestionDependencies {
  let queue: Queue<ProcessWebhookJob> | undefined;
  return {
    createOrFind: async (input) => {
      if (input.payload === null) throw new Error('Webhook payload must be a JSON object');
      try {
        const created = await prisma.webhookEvent.create({
          data: {
            dedupKey: input.dedupKey,
            externalEventId: input.externalEventId,
            eventType: input.eventType,
            payload: input.payload,
          },
          select: { id: true },
        });
        return { id: created.id, shouldEnqueue: true };
      } catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
          const existing = await prisma.webhookEvent.findUniqueOrThrow({
            where: { dedupKey: input.dedupKey }, select: { id: true, status: true },
          });
          return { id: existing.id, shouldEnqueue: existing.status === 'PENDING' };
        }
        throw error;
      }
    },
    enqueue: async (job, jobId) => {
      queue ??= new Queue<ProcessWebhookJob>(PROCESS_WEBHOOK_QUEUE, {
        connection: { url: config.redisUrl },
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: 1000,
          removeOnFail: 5000,
        },
      });
      await queue.add('process-webhook', job, { jobId });
    },
    markEnqueued: async (id) => {
      await prisma.webhookEvent.updateMany({
        where: { id, status: 'PENDING' }, data: { status: 'ENQUEUED' },
      });
    },
    close: async () => {
      await queue?.close();
    },
  };
}

function createDefaultProbes(config: AppConfig): HealthProbes {
  const redis = new Redis(config.redisUrl, { lazyConnect: true });

  return {
    database: async () => {
      try {
        await prisma.$queryRaw`SELECT 1`;
        return true;
      } catch {
        return false;
      }
    },
    redis: async () => {
      try {
        if (redis.status === 'wait') await redis.connect();
        return (await redis.ping()) === 'PONG';
      } catch {
        return false;
      }
    },
    onApplicationShutdown: async () => {
      redis.disconnect();
      await prisma.$disconnect();
    },
  };
}

export async function createApiApp(
  config: AppConfig,
  probes: HealthProbes = createDefaultProbes(config),
  webhookDependencies: WebhookIngestionDependencies = createWebhookDependencies(config),
): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule.register(probes, config.meta, webhookDependencies), {
    logger: false,
    rawBody: true,
  });
  app.enableShutdownHooks();
  await app.init();
  return app;
}

async function bootstrap(): Promise<void> {
  const config = loadConfig(process.env);
  const app = await createApiApp(config);
  await app.listen(config.port);
}

const entrypoint = process.argv[1];
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
  void bootstrap();
}
