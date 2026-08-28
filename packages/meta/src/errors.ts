export type MetaErrorKind = 'transient' | 'invalid_request' | 'auth' | 'ambiguous';

export class MetaApiError extends Error {
  constructor(
    public readonly kind: MetaErrorKind,
    public readonly status: number | undefined,
    public readonly code: string | undefined,
  ) {
    super(`Meta request failed: ${kind}`);
    this.name = 'MetaApiError';
  }

  get retryable(): boolean {
    return this.kind === 'transient';
  }
}
