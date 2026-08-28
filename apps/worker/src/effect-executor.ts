import type { EffectClaim, EffectKind, EffectRecord } from '@flowchat/database';
import { MetaApiError } from '@flowchat/meta';

interface EffectRepository {
  claim(sourceEventId: string, kind: EffectKind): Promise<EffectClaim>;
  complete(id: string, providerResultId: string | null): Promise<void>;
  fail(id: string, errorCode: string): Promise<void>;
  markUncertain(id: string, errorCode: string): Promise<void>;
  releaseForRetry(id: string, errorCode: string): Promise<void>;
}

export class UncertainEffectRequiresVerificationError extends Error {
  constructor() {
    super('Uncertain external effect requires verified reconciliation');
    this.name = 'UncertainEffectRequiresVerificationError';
  }
}

type Reconciliation = () => Promise<'completed' | 'not_sent' | 'unknown'>;
type EffectInput = Readonly<{ sourceEventId: string; kind: EffectKind; reconcile?: Reconciliation }>;

function providerResultId(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || !('providerResultId' in value)) return null;
  return typeof value.providerResultId === 'string' ? value.providerResultId : null;
}

export class EffectExecutor {
  constructor(private readonly repository: EffectRepository) {}

  async run<T>(input: EffectInput, operation: (effect: EffectRecord) => Promise<T>): Promise<T | { skipped: true }> {
    const claim = await this.repository.claim(input.sourceEventId, input.kind);
    if (claim.state === 'completed' || claim.state === 'busy') return { skipped: true };
    if (claim.state === 'failed') return { skipped: true };

    if (claim.state === 'uncertain') {
      if (input.reconcile === undefined) throw new UncertainEffectRequiresVerificationError();
      const reconciliation = await input.reconcile();
      if (reconciliation === 'completed') {
        await this.repository.complete(claim.effect.id, null);
        return { skipped: true };
      }
      if (reconciliation !== 'not_sent') throw new UncertainEffectRequiresVerificationError();
    }

    try {
      const result = await operation(claim.effect);
      await this.repository.complete(claim.effect.id, providerResultId(result));
      return result;
    } catch (error) {
      if (error instanceof MetaApiError && error.kind === 'ambiguous') {
        await this.repository.markUncertain(claim.effect.id, error.code ?? 'AMBIGUOUS');
      } else if (error instanceof MetaApiError && error.kind === 'transient') {
        await this.repository.releaseForRetry(claim.effect.id, error.code ?? 'TRANSIENT');
      } else {
        const code = error instanceof MetaApiError ? (error.code ?? error.kind) : 'INTERNAL';
        await this.repository.fail(claim.effect.id, code);
      }
      throw error;
    }
  }
}
