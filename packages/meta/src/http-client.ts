import type { MetaConfig } from '@flowchat/config';
import { MetaApiError, type MetaErrorKind } from './errors.js';

export type MetaRequest = Readonly<{
  method: 'GET' | 'POST' | 'DELETE';
  path: `/${string}`;
  accessToken?: string;
  body?: unknown;
  timeoutMs?: number;
  providerRequestId?: string;
}>;

type MetaErrorResponse = Readonly<{
  error?: Readonly<{ code?: string | number }>;
}>;

function classify(status: number): MetaErrorKind {
  if (status === 401 || status === 403) return 'auth';
  if (status >= 500) return 'transient';
  return 'invalid_request';
}

async function parseErrorCode(response: Response): Promise<string | undefined> {
  try {
    const payload = (await response.json()) as MetaErrorResponse;
    return payload.error?.code === undefined ? undefined : String(payload.error.code);
  } catch {
    return undefined;
  }
}

export class MetaHttpClient {
  constructor(
    private readonly config: Pick<MetaConfig, 'graphApiVersion'>,
    private readonly fetchImplementation: typeof fetch = globalThis.fetch,
  ) {}

  async request<T>(request: MetaRequest): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (request.accessToken !== undefined) headers.Authorization = `Bearer ${request.accessToken}`;
    if (request.body !== undefined) headers['Content-Type'] = 'application/json';

    let response: Response;
    try {
      response = await this.fetchImplementation(
        `https://graph.instagram.com/${this.config.graphApiVersion}${request.path}`,
        {
          method: request.method,
          headers,
          ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
          signal: AbortSignal.timeout(request.timeoutMs ?? 10_000),
        },
      );
    } catch {
      throw new MetaApiError('ambiguous', undefined, undefined);
    }

    if (!response.ok) {
      throw new MetaApiError(classify(response.status), response.status, await parseErrorCode(response));
    }

    return (await response.json()) as T;
  }
}
