import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Meta integration contract', () => {
  it('records every required verified Meta decision', () => {
    const doc = readFileSync('docs/META-INTEGRATION.md', 'utf8');

    for (const heading of [
      'OAuth',
      'Permissions',
      'Comment webhook',
      'Public replies',
      'Private Replies',
      'Regular button and postback',
      'Webhook signature',
      'Graph API versioning',
    ]) {
      expect(doc).toContain(`## ${heading}`);
    }

    expect(doc).toMatch(/https:\/\/developers\.facebook\.com\//);
    expect(doc).toContain('Verified on:');
  });
});
