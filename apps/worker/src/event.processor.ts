import type { InstagramCommentCreated, InstagramEvent, InstagramPostbackReceived } from '@flowchat/contracts';
import type { Job } from 'bullmq';
import type { ProcessWebhookJob } from '@flowchat/contracts';

export interface WebhookEventStatusPort {
  markProcessing(id: string): Promise<void>;
  markCompleted(id: string): Promise<void>;
  markFailed(id: string, errorCode: string): Promise<void>;
}

type EventProcessorDependencies = Readonly<{
  comments: { handle(event: InstagramCommentCreated, webhookEventId: string): Promise<void> };
  postbacks: { handle(event: InstagramPostbackReceived, webhookEventId: string): Promise<'continued' | 'ignored'> };
  persistence: { recordInbound(event: InstagramEvent, webhookEventId: string): Promise<unknown> };
  events: WebhookEventStatusPort;
}>;

export class EventProcessor {
  constructor(private readonly dependencies: EventProcessorDependencies) {}

  async handle(job: Pick<Job<ProcessWebhookJob>, 'data'>): Promise<void> {
    const { webhookEventId, event } = job.data;
    await this.dependencies.events.markProcessing(webhookEventId);
    try {
      switch (event.type) {
        case 'instagram.comment.created':
          await this.dependencies.comments.handle(event, webhookEventId);
          break;
        case 'instagram.postback.received':
          await this.dependencies.postbacks.handle(event, webhookEventId);
          break;
        case 'instagram.message.received':
          await this.dependencies.persistence.recordInbound(event, webhookEventId);
          break;
      }
      await this.dependencies.events.markCompleted(webhookEventId);
    } catch (error) {
      await this.dependencies.events.markFailed(webhookEventId, 'PROCESSING_FAILED');
      throw error;
    }
  }
}
