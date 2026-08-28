import { Buffer } from 'node:buffer';
import { envSchema } from './env.schema.js';

export type MetaConfig = Readonly<{
  appId: string;
  appSecret: string;
  webhookVerifyToken: string;
  redirectUri: string;
  graphApiVersion: string;
}>;

export type AppConfig = Readonly<{
  meta: MetaConfig;
  databaseUrl: string;
  redisUrl: string;
  encryptionKey: Buffer;
  port: number;
}>;

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const value = envSchema.parse(env);
  const encryptionKey = Buffer.from(value.APP_ENCRYPTION_KEY, 'base64');

  if (encryptionKey.length !== 32) {
    throw new Error('APP_ENCRYPTION_KEY must decode to 32 bytes');
  }

  return Object.freeze({
    meta: Object.freeze({
      appId: value.META_APP_ID,
      appSecret: value.META_APP_SECRET,
      webhookVerifyToken: value.META_WEBHOOK_VERIFY_TOKEN,
      redirectUri: value.META_REDIRECT_URI,
      graphApiVersion: value.META_GRAPH_API_VERSION,
    }),
    databaseUrl: value.DATABASE_URL,
    redisUrl: value.REDIS_URL,
    encryptionKey,
    port: value.PORT,
  });
}
