import { loadConfig } from '@flowchat/config';
import { prisma, EffectsRepository, createPrismaEffectsStore } from '@flowchat/database';
import { decryptToken } from '@flowchat/security';
import {
  MetaHttpClient,
  MetaOpeningPrivateReplySender,
  replyToComment,
  sendDirectMessage,
} from '@flowchat/meta';
import { Redis } from 'ioredis';
import { pathToFileURL } from 'node:url';
import { createWorkerRuntime } from './worker.module.js';
import { createPrismaPersistenceDatabase, PersistenceService } from './persistence.service.js';
import { EffectExecutor } from './effect-executor.js';
import { CommentHandler } from './comment-handler.js';
import { PostbackHandler } from './postback-handler.js';
import { EventProcessor } from './event.processor.js';
import { toBullMqError } from './retry-policy.js';

export async function bootstrapWorker(): Promise<void> {
  const config = loadConfig(process.env);
  const connection = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
  const metaClient = new MetaHttpClient(config.meta);
  const effects = new EffectExecutor(new EffectsRepository(createPrismaEffectsStore(prisma)));
  const persistence = new PersistenceService(createPrismaPersistenceDatabase(prisma));
  const credentials = {
    get: async (accountId: string) => {
      const account = await prisma.instagramAccount.findUniqueOrThrow({
        where: { instagramUserId: accountId },
        select: { instagramUserId: true, accessTokenEncrypted: true },
      });
      return {
        instagramAccountId: account.instagramUserId,
        accessToken: decryptToken(account.accessTokenEncrypted, config.encryptionKey),
      };
    },
  };
  const comments = new CommentHandler({
    effects,
    persistence,
    credentials,
    publicReply: (input) => replyToComment(metaClient, input),
    openingPrivateReplySender: new MetaOpeningPrivateReplySender(metaClient),
  });
  const postbacks = new PostbackHandler({
    effects,
    persistence,
    credentials,
    sendDirectMessage: (input) => sendDirectMessage(metaClient, input),
  });
  const processor = new EventProcessor({
    comments,
    postbacks,
    persistence,
    events: {
      markProcessing: async (id) => {
        await prisma.webhookEvent.update({ where: { id }, data: { status: 'PROCESSING', error: null } });
      },
      markCompleted: async (id) => {
        await prisma.webhookEvent.update({
          where: { id }, data: { status: 'COMPLETED', processedAt: new Date(), error: null },
        });
      },
      markFailed: async (id, errorCode) => {
        await prisma.webhookEvent.update({ where: { id }, data: { status: 'FAILED', error: errorCode } });
      },
    },
  });
  const runtime = createWorkerRuntime(connection, async (job) => {
    try {
      await processor.handle(job);
    } catch (error) {
      throw toBullMqError(error);
    }
  });
  let closing = false;

  const shutdown = async (): Promise<void> => {
    if (closing) return;
    closing = true;
    try {
      await runtime.close();
    } finally {
      connection.disconnect();
      await prisma.$disconnect();
    }
  };

  process.once('SIGTERM', () => void shutdown());
  process.once('SIGINT', () => void shutdown());
}

const entrypoint = process.argv[1];
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
  void bootstrapWorker();
}
