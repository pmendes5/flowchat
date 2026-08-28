import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('repository bootstrap', () => {
  it('declares every workspace and required command', () => {
    expect(readFileSync('pnpm-workspace.yaml', 'utf8')).toContain("- 'apps/*'");
    const root = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(Object.keys(root.scripts)).toEqual(expect.arrayContaining(['lint', 'typecheck', 'test', 'build']));
  });

  it('excludes the root workspace from recursive Turbo tasks', () => {
    const root = JSON.parse(readFileSync('package.json', 'utf8'));

    for (const command of [root.scripts.lint, root.scripts.typecheck, root.scripts.test, root.scripts.build]) {
      expect(command).toContain('--filter=!flowchat');
    }
  });
});
