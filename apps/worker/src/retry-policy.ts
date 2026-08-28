import { MetaApiError } from '@flowchat/meta';
import { UnrecoverableError } from 'bullmq';

export function classifyJobError(error: unknown): 'retry' | 'discard' {
  return error instanceof MetaApiError && (error.kind === 'transient' || error.kind === 'ambiguous')
    ? 'retry'
    : 'discard';
}

export function toBullMqError(error: unknown): Error {
  if (classifyJobError(error) === 'retry') return error as Error;
  return new UnrecoverableError(error instanceof MetaApiError ? `Permanent Meta ${error.kind} failure` : 'Permanent worker failure');
}
