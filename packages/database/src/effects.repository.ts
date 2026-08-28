import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

export type EffectKind = 'COMMENT_PUBLIC_REPLY' | 'COMMENT_PRIVATE_REPLY' | 'POSTBACK_SECOND_DM';
export type EffectStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'UNCERTAIN';

export type EffectRecord = Readonly<{
  id: string;
  sourceEventId: string;
  kind: EffectKind;
  status: EffectStatus;
  providerRequestId: string;
  attempts: number;
  claimedAt?: Date;
}>;

export type EffectClaim = Readonly<{
  state: 'claimed' | 'completed' | 'busy' | 'uncertain' | 'failed';
  effect: EffectRecord;
}>;

export interface EffectsStore {
  create(input: {
    sourceEventId: string; kind: EffectKind; status: 'PROCESSING'; providerRequestId: string; attempts: 1;
  }): Promise<EffectRecord>;
  findBySourceAndKind(sourceEventId: string, kind: EffectKind): Promise<EffectRecord>;
  update(id: string, data: Record<string, unknown>): Promise<void>;
  reclaim(id: string): Promise<EffectRecord | null>;
  markStaleUncertain(id: string, claimedBefore: Date): Promise<EffectRecord | null>;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

function stateFor(status: EffectStatus): EffectClaim['state'] {
  if (status === 'COMPLETED') return 'completed';
  if (status === 'UNCERTAIN') return 'uncertain';
  if (status === 'FAILED') return 'failed';
  return 'busy';
}

export class EffectsRepository {
  constructor(
    private readonly store: EffectsStore,
    private readonly now: () => Date = () => new Date(),
    private readonly claimLeaseMs = 5 * 60_000,
  ) {}

  async claim(sourceEventId: string, kind: EffectKind): Promise<EffectClaim> {
    const providerRequestId = createHash('sha256').update(`${sourceEventId}:${kind}`).digest('hex');
    try {
      const effect = await this.store.create({
        sourceEventId, kind, status: 'PROCESSING', providerRequestId, attempts: 1,
      });
      return { state: 'claimed', effect };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      let effect = await this.store.findBySourceAndKind(sourceEventId, kind);
      if (effect.status === 'PENDING') {
        const reclaimed = await this.store.reclaim(effect.id);
        if (reclaimed !== null) return { state: 'claimed', effect: reclaimed };
        effect = await this.store.findBySourceAndKind(sourceEventId, kind);
      }
      if (
        effect.status === 'PROCESSING' &&
        effect.claimedAt !== undefined &&
        effect.claimedAt.getTime() <= this.now().getTime() - this.claimLeaseMs
      ) {
        const uncertain = await this.store.markStaleUncertain(
          effect.id,
          new Date(this.now().getTime() - this.claimLeaseMs),
        );
        if (uncertain !== null) return { state: 'uncertain', effect: uncertain };
        effect = await this.store.findBySourceAndKind(sourceEventId, kind);
      }
      return { state: stateFor(effect.status), effect };
    }
  }

  complete(id: string, providerResultId: string | null): Promise<void> {
    return this.store.update(id, { status: 'COMPLETED', providerResultId, completedAt: new Date() });
  }

  fail(id: string, errorCode: string): Promise<void> {
    return this.store.update(id, { status: 'FAILED', lastErrorCode: errorCode });
  }

  releaseForRetry(id: string, errorCode: string): Promise<void> {
    return this.store.update(id, { status: 'PENDING', lastErrorCode: errorCode });
  }

  markUncertain(id: string, errorCode: string): Promise<void> {
    return this.store.update(id, { status: 'UNCERTAIN', lastErrorCode: errorCode });
  }
}

export function createPrismaEffectsStore(client: PrismaClient): EffectsStore {
  return {
    create: (input) => client.externalEffect.create({ data: input }) as unknown as Promise<EffectRecord>,
    findBySourceAndKind: (sourceEventId, kind) => client.externalEffect.findUniqueOrThrow({
      where: { sourceEventId_kind: { sourceEventId, kind } },
    }) as unknown as Promise<EffectRecord>,
    update: async (id, data) => {
      await client.externalEffect.update({ where: { id }, data });
    },
    reclaim: async (id) => {
      const result = await client.externalEffect.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: 'PROCESSING', attempts: { increment: 1 }, claimedAt: new Date() },
      });
      if (result.count === 0) return null;
      return client.externalEffect.findUniqueOrThrow({ where: { id } }) as unknown as Promise<EffectRecord>;
    },
    markStaleUncertain: async (id, claimedBefore) => {
      const result = await client.externalEffect.updateMany({
        where: { id, status: 'PROCESSING', claimedAt: { lte: claimedBefore } },
        data: { status: 'UNCERTAIN', lastErrorCode: 'STALE_PROCESSING_CLAIM' },
      });
      if (result.count === 0) return null;
      return client.externalEffect.findUniqueOrThrow({ where: { id } }) as unknown as Promise<EffectRecord>;
    },
  };
}
