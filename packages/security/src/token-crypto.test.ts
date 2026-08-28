import { describe, expect, it } from 'vitest';
import { decryptToken, encryptToken } from './token-crypto.js';

describe('token crypto', () => {
  it('round trips with AES-256-GCM', () => {
    const key = Buffer.alloc(32, 1);
    expect(decryptToken(encryptToken('token-secret', key), key)).toBe('token-secret');
  });

  it('rejects a different key', () => {
    const envelope = encryptToken('token-secret', Buffer.alloc(32, 1));
    expect(() => decryptToken(envelope, Buffer.alloc(32, 2))).toThrow();
  });

  it('does not expose plaintext', () => {
    expect(encryptToken('token-secret', Buffer.alloc(32, 1))).not.toContain('token-secret');
  });
});
