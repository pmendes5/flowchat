import type { AppConfig } from '@flowchat/config';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApiApp } from './main.js';

const testConfig: AppConfig = {
  meta: {
    appId: 'app',
    appSecret: 'secret',
    webhookVerifyToken: 'verify',
    redirectUri: 'https://example.test/auth/instagram/callback',
    graphApiVersion: 'v99.0',
  },
  databaseUrl: 'postgresql://flowchat:local@localhost:5432/flowchat',
  redisUrl: 'redis://localhost:6379',
  encryptionKey: Buffer.alloc(32, 1),
  port: 3001,
};

describe('health endpoint', () => {
  it('returns health on a port-independent test app', async () => {
    const app = await createApiApp(testConfig, {
      database: async () => true,
      redis: async () => true,
    });

    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok', database: 'up', redis: 'up' });
    await app.close();
  });
});
