import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { AppConfig } from '@flowchat/config';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiApp } from '../main.js';
import type { WebhookIngestionDependencies } from './webhook-ingestion.service.js';

const config: AppConfig = {
  meta: {
    appId: 'app', appSecret: 'app-secret', webhookVerifyToken: 'verify-secret',
    redirectUri: 'https://example.test/auth/instagram/callback', graphApiVersion: 'v99.0',
  },
  databaseUrl: 'postgresql://flowchat:local@localhost:5432/flowchat',
  redisUrl: 'redis://localhost:6379', encryptionKey: Buffer.alloc(32, 1), port: 3001,
};
const probes = { database: vi.fn(async () => true), redis: vi.fn(async () => true) };
const rawFixture = readFileSync(new URL('../../../../packages/meta/src/fixtures/comment.json', import.meta.url));

function signature(body: Buffer): string {
  return `sha256=${createHmac('sha256', config.meta.appSecret).update(body).digest('hex')}`;
}

describe('POST /webhooks/meta', () => {
  let dependencies: WebhookIngestionDependencies;

  beforeEach(() => {
    dependencies = {
      createOrFind: vi.fn().mockResolvedValue({ id: 'webhook-db', shouldEnqueue: true }),
      enqueue: vi.fn().mockResolvedValue(undefined),
      markEnqueued: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('rejects an invalid signature before persistence', async () => {
    const app = await createApiApp(config, probes, dependencies);
    try {
      await request(app.getHttpServer()).post('/webhooks/meta').set('Content-Type', 'application/json')
        .set('X-Hub-Signature-256', 'sha256=00').send(rawFixture.toString('utf8')).expect(401);
      expect(dependencies.createOrFind).not.toHaveBeenCalled();
      expect(dependencies.enqueue).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('persists and enqueues one job for a duplicate delivery', async () => {
    const createOrFind = vi.fn()
      .mockResolvedValueOnce({ id: 'webhook-db', shouldEnqueue: true })
      .mockResolvedValueOnce({ id: 'webhook-db', shouldEnqueue: false });
    dependencies.createOrFind = createOrFind;
    const app = await createApiApp(config, probes, dependencies);
    try {
      const send = () => request(app.getHttpServer()).post('/webhooks/meta')
        .set('Content-Type', 'application/json').set('X-Hub-Signature-256', signature(rawFixture))
        .send(rawFixture.toString('utf8')).expect(200);
      await expect(send()).resolves.toMatchObject({ body: { accepted: 1 } });
      await expect(send()).resolves.toMatchObject({ body: { accepted: 0 } });
      expect(createOrFind).toHaveBeenCalledTimes(2);
      expect(dependencies.enqueue).toHaveBeenCalledTimes(1);
      expect(dependencies.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ webhookEventId: 'webhook-db', event: expect.objectContaining({ type: 'instagram.comment.created' }) }),
        expect.stringMatching(/^webhook:/),
      );
    } finally {
      await app.close();
    }
  });

  it('returns 503 and leaves the persisted event observable when enqueue fails', async () => {
    dependencies.enqueue = vi.fn().mockRejectedValue(new Error('redis unavailable'));
    const app = await createApiApp(config, probes, dependencies);
    try {
      const response = await request(app.getHttpServer()).post('/webhooks/meta')
        .set('Content-Type', 'application/json').set('X-Hub-Signature-256', signature(rawFixture))
        .send(rawFixture.toString('utf8')).expect(503);
      expect(JSON.stringify(response.body)).not.toContain('redis unavailable');
      expect(dependencies.createOrFind).toHaveBeenCalledTimes(1);
    } finally {
      await app.close();
    }
  });

  it('re-enqueues a persisted PENDING event after the first enqueue fails', async () => {
    dependencies.createOrFind = vi.fn()
      .mockResolvedValueOnce({ id: 'webhook-db', shouldEnqueue: true })
      .mockResolvedValueOnce({ id: 'webhook-db', shouldEnqueue: true });
    dependencies.enqueue = vi.fn()
      .mockRejectedValueOnce(new Error('redis unavailable'))
      .mockResolvedValueOnce(undefined);
    const app = await createApiApp(config, probes, dependencies);
    try {
      const send = () => request(app.getHttpServer()).post('/webhooks/meta')
        .set('Content-Type', 'application/json').set('X-Hub-Signature-256', signature(rawFixture))
        .send(rawFixture.toString('utf8'));
      await send().expect(503);
      await send().expect(200, { accepted: 1 });
      expect(dependencies.enqueue).toHaveBeenCalledTimes(2);
      expect(dependencies.markEnqueued).toHaveBeenCalledWith('webhook-db');
    } finally {
      await app.close();
    }
  });
});
