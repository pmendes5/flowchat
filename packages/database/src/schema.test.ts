import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('database schema', () => {
  const schema = readFileSync('prisma/schema.prisma', 'utf8');

  it('deduplicates webhooks and effects independently', () => {
    expect(schema).toContain('dedupKey');
    expect(schema).toContain('@@unique([sourceEventId, kind])');
    expect(schema).toContain('UNCERTAIN');
  });
});
