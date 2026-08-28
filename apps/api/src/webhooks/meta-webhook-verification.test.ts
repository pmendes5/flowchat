import type { AppConfig } from '@flowchat/config';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApiApp } from '../main.js';

const config: AppConfig = {
  meta: {
    appId: 'app', appSecret: 'app-secret', webhookVerifyToken: 'verify-secret',
    redirectUri: 'https://example.test/auth/instagram/callback', graphApiVersion: 'v99.0',
  },
  databaseUrl: 'postgresql://flowchat:local@localhost:5432/flowchat',
  redisUrl: 'redis://localhost:6379', encryptionKey: Buffer.alloc(32, 1), port: 3001,
};

const probes = { database: vi.fn(async () => true), redis: vi.fn(async () => true) };

describe('GET /webhooks/meta', () => {
  it('returns the challenge as text for a valid verification request', async () => {
    const app = await createApiApp(config, probes);
    try {
      await request(app.getHttpServer()).get('/webhooks/meta').query({
        'hub.mode': 'subscribe', 'hub.verify_token': 'verify-secret', 'hub.challenge': 'challenge-1',
      }).expect('Content-Type', /text\/plain/).expect(200, 'challenge-1');
    } finally {
      await app.close();
    }
  });

  it.each([
    ['wrong token', { 'hub.mode': 'subscribe', 'hub.verify_token': 'wrong', 'hub.challenge': 'challenge-1' }],
    ['wrong mode', { 'hub.mode': 'other', 'hub.verify_token': 'verify-secret', 'hub.challenge': 'challenge-1' }],
    ['missing challenge', { 'hub.mode': 'subscribe', 'hub.verify_token': 'verify-secret' }],
  ])('rejects %s without exposing the configured token', async (_name, query) => {
    const app = await createApiApp(config, probes);
    try {
      const response = await request(app.getHttpServer()).get('/webhooks/meta').query(query).expect(403);
      expect(JSON.stringify(response.body)).not.toContain('verify-secret');
    } finally {
      await app.close();
    }
  });
});
