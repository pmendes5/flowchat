import { MetaApiError } from '@flowchat/meta';
import { expect, it, vi } from 'vitest';
import { EffectExecutor, UncertainEffectRequiresVerificationError } from './effect-executor.js';

const effect = {
  id: 'effect-1', sourceEventId: 'event-1', kind: 'COMMENT_PUBLIC_REPLY' as const,
  status: 'PROCESSING' as const, providerRequestId: 'provider-id', attempts: 1,
};
const input = { sourceEventId: 'event-1', kind: 'COMMENT_PUBLIC_REPLY' as const };

function repository() {
  return {
    claim: vi.fn().mockResolvedValue({ state: 'claimed', effect }),
    complete: vi.fn().mockResolvedValue(undefined), fail: vi.fn().mockResolvedValue(undefined),
    markUncertain: vi.fn().mockResolvedValue(undefined),
    releaseForRetry: vi.fn().mockResolvedValue(undefined),
  };
}

it('executes a completed effect only once', async () => {
  const repo = repository();
  repo.claim.mockResolvedValueOnce({ state: 'claimed', effect })
    .mockResolvedValueOnce({ state: 'completed', effect: { ...effect, status: 'COMPLETED' } });
  const operation = vi.fn().mockResolvedValue({ providerResultId: 'reply-1' });
  const executor = new EffectExecutor(repo);
  await executor.run(input, operation);
  await expect(executor.run(input, operation)).resolves.toEqual({ skipped: true });
  expect(operation).toHaveBeenCalledTimes(1);
  expect(repo.complete).toHaveBeenCalledWith('effect-1', 'reply-1');
});

it('marks an ambiguous send UNCERTAIN and does not silently convert it to retryable success', async () => {
  const repo = repository();
  const operation = vi.fn().mockRejectedValue(new MetaApiError('ambiguous', undefined, 'TIMEOUT'));
  await expect(new EffectExecutor(repo).run(input, operation)).rejects.toMatchObject({ kind: 'ambiguous' });
  expect(repo.markUncertain).toHaveBeenCalledWith('effect-1', 'TIMEOUT');
});

it('never repeats an UNCERTAIN effect without verified reconciliation', async () => {
  const repo = repository();
  repo.claim.mockResolvedValue({ state: 'uncertain', effect: { ...effect, status: 'UNCERTAIN' } });
  const operation = vi.fn();
  await expect(new EffectExecutor(repo).run(input, operation))
    .rejects.toBeInstanceOf(UncertainEffectRequiresVerificationError);
  expect(operation).not.toHaveBeenCalled();
});

it('retries an UNCERTAIN effect only when reconciliation proves it was not sent', async () => {
  const repo = repository();
  repo.claim.mockResolvedValue({ state: 'uncertain', effect: { ...effect, status: 'UNCERTAIN' } });
  const operation = vi.fn().mockResolvedValue({ providerResultId: 'reply-1' });
  await new EffectExecutor(repo).run({ ...input, reconcile: async () => 'not_sent' }, operation);
  expect(operation).toHaveBeenCalledTimes(1);
});

it('releases a transient failure so the next BullMQ attempt can reclaim it', async () => {
  const repo = repository();
  const operation = vi.fn().mockRejectedValue(new MetaApiError('transient', 500, 'SERVER'));
  await expect(new EffectExecutor(repo).run(input, operation)).rejects.toMatchObject({ kind: 'transient' });
  expect(repo.releaseForRetry).toHaveBeenCalledWith('effect-1', 'SERVER');
  expect(repo.fail).not.toHaveBeenCalled();
});
