import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('local infrastructure', () => {
  it('defines healthy postgres and redis services', () => {
    const yaml = readFileSync('docker-compose.yml', 'utf8');
    expect(yaml).toMatch(/postgres:[\s\S]*pg_isready/);
    expect(yaml).toMatch(/redis:[\s\S]*redis-cli.*ping/);
    expect(yaml).toContain('flowchat_postgres_data');
  });
});
