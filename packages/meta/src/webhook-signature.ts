import { createHmac, timingSafeEqual } from 'node:crypto';

const SIGNATURE_PREFIX = 'sha256=';
const SHA256_HEX_LENGTH = 64;

export function verifyMetaWebhookSignature(
  rawBody: Buffer,
  signature: string | undefined,
  appSecret: string,
): boolean {
  if (
    signature === undefined ||
    !signature.startsWith(SIGNATURE_PREFIX) ||
    signature.length !== SIGNATURE_PREFIX.length + SHA256_HEX_LENGTH
  ) {
    return false;
  }

  const suppliedHex = signature.slice(SIGNATURE_PREFIX.length);
  if (!/^[a-f0-9]{64}$/i.test(suppliedHex)) return false;

  const supplied = Buffer.from(suppliedHex, 'hex');
  const expected = createHmac('sha256', appSecret).update(rawBody).digest();
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
