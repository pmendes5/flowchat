import { expect, it, vi } from 'vitest';
import { EffectsRepository, type EffectsStore } from './effects.repository.js';

it('creates an atomic effect claim with a deterministic provider request ID', async () => {
  const create = vi.fn().mockResolvedValue({
    id: 'effect-1', sourceEventId: 'event-1', kind: 'COMMENT_PUBLIC_REPLY', status: 'PROCESSING',
    providerRequestId: 'provider-id', attempts: 1,
  });
  const store: EffectsStore = { create, findBySourceAndKind: vi.fn(), update: vi.fn(), reclaim: vi.fn(), markStaleUncertain: vi.fn() };
  const claim = await new EffectsRepository(store).claim('event-1', 'COMMENT_PUBLIC_REPLY');
  expect(claim.state).toBe('claimed');
  expect(create).toHaveBeenCalledWith(expect.objectContaining({
    sourceEventId: 'event-1', kind: 'COMMENT_PUBLIC_REPLY', status: 'PROCESSING', attempts: 1,
    providerRequestId: expect.stringMatching(/^[a-f0-9]{64}$/),
  }));
});

it.each([
  ['COMPLETED', 'completed'], ['PROCESSING', 'busy'], ['UNCERTAIN', 'uncertain'], ['FAILED', 'failed'],
] as const)('maps a duplicate %s effect to %s without creating another', async (status, state) => {
  const existing = {
    id: 'effect-1', sourceEventId: 'event-1', kind: 'COMMENT_PUBLIC_REPLY' as const, status,
    providerRequestId: 'provider-id', attempts: 1,
  };
  const store: EffectsStore = {
    create: vi.fn().mockRejectedValue({ code: 'P2002' }),
    findBySourceAndKind: vi.fn().mockResolvedValue(existing), update: vi.fn(), reclaim: vi.fn(), markStaleUncertain: vi.fn(),
  };
  await expect(new EffectsRepository(store).claim('event-1', 'COMMENT_PUBLIC_REPLY'))
    .resolves.toMatchObject({ state, effect: existing });
});

it('atomically reclaims a retryable PENDING effect', async () => {
  const pending = {
    id: 'effect-1', sourceEventId: 'event-1', kind: 'COMMENT_PUBLIC_REPLY' as const,
    status: 'PENDING' as const, providerRequestId: 'provider-id', attempts: 1,
  };
  const reclaimed = { ...pending, status: 'PROCESSING' as const, attempts: 2 };
  const store: EffectsStore = {
    create: vi.fn().mockRejectedValue({ code: 'P2002' }),
    findBySourceAndKind: vi.fn().mockResolvedValue(pending),
    update: vi.fn(), reclaim: vi.fn().mockResolvedValue(reclaimed), markStaleUncertain: vi.fn(),
  };
  await expect(new EffectsRepository(store).claim('event-1', 'COMMENT_PUBLIC_REPLY'))
    .resolves.toEqual({ state: 'claimed', effect: reclaimed });
});

it('moves an expired PROCESSING claim to UNCERTAIN without re-executing it', async () => {
  const claimedAt = new Date('2026-08-28T11:00:00.000Z');
  const processing = {
    id: 'effect-1', sourceEventId: 'event-1', kind: 'COMMENT_PUBLIC_REPLY' as const,
    status: 'PROCESSING' as const, providerRequestId: 'provider-id', attempts: 1, claimedAt,
  };
  const uncertain = { ...processing, status: 'UNCERTAIN' as const };
  const store: EffectsStore = {
    create: vi.fn().mockRejectedValue({ code: 'P2002' }),
    findBySourceAndKind: vi.fn().mockResolvedValue(processing), update: vi.fn(), reclaim: vi.fn(),
    markStaleUncertain: vi.fn().mockResolvedValue(uncertain),
  };
  const repository = new EffectsRepository(store, () => new Date('2026-08-28T12:00:00.000Z'));
  await expect(repository.claim('event-1', 'COMMENT_PUBLIC_REPLY'))
    .resolves.toEqual({ state: 'uncertain', effect: uncertain });
  expect(store.markStaleUncertain).toHaveBeenCalledOnce();
});
