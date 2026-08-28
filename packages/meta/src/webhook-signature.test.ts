import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyMetaWebhookSignature } from './webhook-signature.js';

describe('verifyMetaWebhookSignature', () => {
  const body = Buffer.from('{"object":"instagram"}');
  const secret = 'app-secret';
  const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

  it('accepts the HMAC-SHA256 signature of the exact raw bytes', () => {
    expect(verifyMetaWebhookSignature(body, signature, secret)).toBe(true);
  });

  it.each([undefined, '', 'sha1=bad', 'sha256=00', `${signature}00`])(
    'rejects a missing or malformed signature (%s)',
    (candidate) => {
      expect(verifyMetaWebhookSignature(body, candidate, secret)).toBe(false);
    },
  );

  it('rejects a valid signature for different raw bytes', () => {
    expect(verifyMetaWebhookSignature(Buffer.from('{"object":"other"}'), signature, secret)).toBe(false);
  });
});
