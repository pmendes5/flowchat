import { MetaApiError } from '@flowchat/meta';
import { expect, it } from 'vitest';
import { classifyJobError, toBullMqError } from './retry-policy.js';
import { UnrecoverableError } from 'bullmq';

it.each([
  [new MetaApiError('transient', 500, '1'), 'retry'],
  [new MetaApiError('ambiguous', undefined, 'TIMEOUT'), 'retry'],
  [new MetaApiError('invalid_request', 400, '2'), 'discard'],
  [new MetaApiError('auth', 401, '3'), 'discard'],
] as const)('classifies provider failures without exposing details', (error, expected) => {
  expect(classifyJobError(error)).toBe(expected);
  const converted = toBullMqError(error);
  expect(converted instanceof UnrecoverableError).toBe(expected === 'discard');
  expect(converted.message).not.toContain(error.code ?? 'not-present');
});
