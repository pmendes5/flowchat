import type { InstagramPostbackReceived } from '@flowchat/contracts';
import type { EffectKind } from '@flowchat/database';
import { MetaApiError } from '@flowchat/meta';
import { SPRINT_ONE_BEHAVIOR } from './sprint-one-config.js';

interface PostbackDependencies {
  effects: {
    run<T>(input: { sourceEventId: string; kind: EffectKind }, operation: () => Promise<T>): Promise<T | { skipped: true }>;
  };
  persistence: {
    recordInbound(event: InstagramPostbackReceived, webhookEventId: string): Promise<{ contactId: string; conversationId: string }>;
    recordOutbound(input: {
      conversationId: string; externalMessageId: string | null; type: 'TEXT'; text: string;
      rawPayload?: Record<string, string>;
    }): Promise<void>;
  };
  credentials: { get(accountId: string): Promise<{ instagramAccountId: string; accessToken: string }> };
  sendDirectMessage(input: {
    instagramAccountId: string; recipientId: string; accessToken: string; text: string;
  }): Promise<{ recipientId: string; messageId: string }>;
}

export class PostbackHandler {
  constructor(private readonly dependencies: PostbackDependencies) {}

  async handle(event: InstagramPostbackReceived, webhookEventId: string): Promise<'continued' | 'ignored'> {
    const conversation = await this.dependencies.persistence.recordInbound(event, webhookEventId);
    if (event.payload !== SPRINT_ONE_BEHAVIOR.button.payload) return 'ignored';
    const credentials = await this.dependencies.credentials.get(event.accountId);
    await this.dependencies.effects.run(
      { sourceEventId: webhookEventId, kind: 'POSTBACK_SECOND_DM' },
      async () => {
        const sent = await this.dependencies.sendDirectMessage({
          instagramAccountId: credentials.instagramAccountId,
          recipientId: event.senderId,
          accessToken: credentials.accessToken,
          text: SPRINT_ONE_BEHAVIOR.continuation,
        });
        try {
          await this.dependencies.persistence.recordOutbound({
            conversationId: conversation.conversationId,
            externalMessageId: sent.messageId,
            type: 'TEXT',
            text: SPRINT_ONE_BEHAVIOR.continuation,
            rawPayload: { recipientId: sent.recipientId, messageId: sent.messageId },
          });
        } catch {
          throw new MetaApiError('ambiguous', undefined, 'OUTBOUND_PERSISTENCE');
        }
        return { providerResultId: sent.messageId, ...sent };
      },
    );
    return 'continued';
  }
}
