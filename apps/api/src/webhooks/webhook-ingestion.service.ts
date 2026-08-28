import type { InstagramEvent, ProcessWebhookJob } from '@flowchat/contracts';
import { normalizeMetaWebhook, verifyMetaWebhookSignature, type JsonValue } from '@flowchat/meta';
import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';

export type WebhookEventInsert = Readonly<{
  dedupKey: string;
  externalEventId: string | null;
  eventType: InstagramEvent['type'];
  payload: JsonValue;
}>;

export interface WebhookIngestionDependencies {
  createOrFind(input: WebhookEventInsert): Promise<{ id: string; shouldEnqueue: boolean }>;
  enqueue(job: ProcessWebhookJob, jobId: string): Promise<void>;
  markEnqueued(id: string): Promise<void>;
  close?(): Promise<void>;
}

export class WebhookIngestionService {
  constructor(
    private readonly appSecret: string,
    private readonly dependencies: WebhookIngestionDependencies,
  ) {}

  async ingest(rawBody: Buffer, signature: string | undefined): Promise<{ accepted: number }> {
    if (!verifyMetaWebhookSignature(rawBody, signature, this.appSecret)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const items = normalizeMetaWebhook(JSON.parse(rawBody.toString('utf8')) as unknown);
    let accepted = 0;
    for (const item of items) {
      const stored = await this.dependencies.createOrFind({
        dedupKey: item.dedupKey,
        externalEventId: item.externalEventId,
        eventType: item.event.type,
        payload: item.rawPayload,
      });
      if (!stored.shouldEnqueue) continue;

      try {
        await this.dependencies.enqueue(
          { webhookEventId: stored.id, event: item.event },
          `webhook:${item.dedupKey}`,
        );
      } catch {
        throw new ServiceUnavailableException('Webhook enqueue failed');
      }
      await this.dependencies.markEnqueued(stored.id);
      accepted += 1;
    }
    return { accepted };
  }

  async onApplicationShutdown(): Promise<void> {
    await this.dependencies.close?.();
  }
}
