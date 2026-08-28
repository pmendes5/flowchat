import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('defines but does not claim execution of the real Meta acceptance path', () => {
  const doc = readFileSync('docs/MANUAL-META-TEST.md', 'utf8');
  for (const item of [
    'Status: NOT_EXECUTED', 'Create and configure Meta App', 'Complete OAuth',
    'Expose webhook with Cloudflare Tunnel', 'Comment QUERO', 'Verify one public reply',
    'Verify Private Reply', 'INICIAR AQUI', 'FLOW_CONTINUE', 'Verify one second DM',
    'Duplicate delivery', 'Executed at', 'Graph API version', 'Expected', 'Observed',
    'Evidence reference', 'Pass/Fail',
  ]) expect(doc).toContain(item);
  expect(doc).toContain('MetaCapabilityNotVerifiedError');
  expect(doc).toContain('BLOCKED_BY_VERIFICATION');
});
