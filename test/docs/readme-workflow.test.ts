import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

it('documents the complete local backend workflow', () => {
  const readme = readFileSync('README.md', 'utf8');
  for (const text of [
    'Node.js 22', 'pnpm install', 'docker compose up -d postgres redis',
    'prisma generate', 'prisma migrate deploy', 'pnpm dev:api', 'pnpm dev:worker',
    'cloudflared tunnel --url http://localhost:3001', 'pnpm lint', 'pnpm typecheck',
    'pnpm test', 'pnpm build', 'Meta setup checklist', 'BLOCKED_BY_VERIFICATION',
  ]) expect(readme).toContain(text);
});

describe('secret-safe troubleshooting', () => {
  it('warns against printing credentials and identifies the PowerShell launcher workaround', () => {
    const readme = readFileSync('README.md', 'utf8');
    expect(readme).toContain('pnpm.cmd');
    expect(readme).toContain('Nunca imprima');
    expect(readme).toContain('tokens');
  });
});
