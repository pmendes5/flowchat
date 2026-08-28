import type { AppConfig } from '@flowchat/config';
import { loadConfig } from '@flowchat/config';
import { prisma } from '@flowchat/database';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { Redis } from 'ioredis';
import 'reflect-metadata';
import { pathToFileURL } from 'node:url';
import { AppModule } from './app.module.js';
import type { HealthProbes } from './health.controller.js';

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
  };
}

export async function createApiApp(
  config: AppConfig,
  probes: HealthProbes = createDefaultProbes(config),
): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule.register(probes), {
    logger: false,
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
