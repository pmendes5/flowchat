import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

const valid = {
  META_APP_ID: 'app',
  META_APP_SECRET: 'secret',
  META_WEBHOOK_VERIFY_TOKEN: 'verify',
  META_REDIRECT_URI: 'https://example.test/auth/instagram/callback',
  META_GRAPH_API_VERSION: 'v99.0',
  DATABASE_URL: 'postgresql://flowchat:local@localhost:5432/flowchat',
  REDIS_URL: 'redis://localhost:6379',
  APP_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  PORT: '3001',
};

describe('loadConfig', () => {
  it('rejects a non-32-byte encryption key', () => {
    expect(() => loadConfig({ ...valid, APP_ENCRYPTION_KEY: 'bad' })).toThrow();
  });

  it('returns typed config', () => {
    expect(loadConfig(valid).meta.graphApiVersion).toBe('v99.0');
  });
});
