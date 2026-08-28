import { afterEach, describe, expect, it, vi } from 'vitest';
import { MetaApiError, MetaHttpClient } from './index.js';

const config = {
  appId: 'app',
  appSecret: 'app-secret',
  webhookVerifyToken: 'verify',
  redirectUri: 'https://example.test/callback',
  graphApiVersion: 'v99.0',
} as const;

describe('MetaHttpClient', () => {
  afterEach(() => vi.restoreAllMocks());

  it('uses the configured Graph version and authorization header', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'ok' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await new MetaHttpClient(config).request<{ id: string }>({
      method: 'GET',
      path: '/me',
      accessToken: 'secret-token',
    });

    expect(result).toEqual({ id: 'ok' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://graph.instagram.com/v99.0/me',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer secret-token' }),
      }),
    );
    expect(fetchMock.mock.calls[0]?.[0]).not.toContain('secret-token');
  });

  it.each([
    [500, 'transient'],
    [400, 'invalid_request'],
    [401, 'auth'],
    [403, 'auth'],
  ] as const)('classifies HTTP %i as %s without exposing sensitive response data', async (status, kind) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'E1', message: 'provider details' }, access_token: 'leaked' }), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const error = await new MetaHttpClient(config)
      .request({ method: 'POST', path: '/messages', accessToken: 'secret-token', body: { private: 'value' } })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(MetaApiError);
    expect(error).toMatchObject({ kind, status, code: 'E1' });
    expect(String(error)).not.toMatch(/secret-token|leaked|provider details|private/);
  });

  it('marks a network failure as ambiguous and not retryable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('network failed with secret-token'));

    const error = await new MetaHttpClient(config)
      .request({ method: 'POST', path: '/messages', accessToken: 'secret-token' })
      .catch((caught: unknown) => caught);

    expect(error).toMatchObject({ kind: 'ambiguous', retryable: false });
    expect(String(error)).not.toContain('secret-token');
  });
});
