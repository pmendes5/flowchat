import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    test: {
      include: ['test/**/*.test.ts'],
      environment: 'node',
    },
  },
  {
    test: {
      include: ['packages/config/src/**/*.test.ts'],
      environment: 'node',
    },
  },
  {
    test: {
      include: ['packages/contracts/src/**/*.test.ts'],
      environment: 'node',
    },
  },
  {
    test: {
      include: ['packages/database/src/**/*.test.ts'],
      environment: 'node',
    },
  },
  {
    test: {
      include: ['packages/security/src/**/*.test.ts'],
      environment: 'node',
    },
  },
  {
    test: {
      include: ['packages/meta/src/**/*.test.ts'],
      environment: 'node',
    },
  },
  {
    test: {
      include: ['apps/api/src/**/*.test.ts'],
      environment: 'node',
    },
  },
  {
    test: {
      include: ['apps/worker/src/**/*.test.ts'],
      environment: 'node',
    },
  },
]);
