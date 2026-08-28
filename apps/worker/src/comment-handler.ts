import type { InstagramCommentCreated, OpeningPrivateReplySender } from '@flowchat/contracts';
import type { EffectKind } from '@flowchat/database';
import { MetaApiError } from '@flowchat/meta';
import { SPRINT_ONE_BEHAVIOR } from './sprint-one-config.js';

type Effect = Readonly<{ providerRequestId: string }>;
type EffectResult<T> = T | { skipped: true };

interface EffectsPort {
  run<T>(
    input: Readonly<{ sourceEventId: string; kind: EffectKind }>,
    operation: (effect: Effect) => Promise<T>,
  ): Promise<EffectResult<T>>;
}

interface PersistencePort {
  recordInbound(event: InstagramCommentCreated, sourceWebhookEventId: string): Promise<{
    contactId: string; conversationId: string;
  }>;
  recordOutbound(input: {
    conversationId: string; externalMessageId: string | null; type: 'PUBLIC_REPLY' | 'PRIVATE_REPLY';
    text: string; structuredPayload?: { button: { title: string; payload: string } };
    rawPayload?: Record<string, string>;
  }): Promise<void>;
}

interface CredentialsPort {
  get(accountId: string): Promise<{ instagramAccountId: string; accessToken: string }>;
}

export type CommentHandlerDependencies = Readonly<{
  effects: EffectsPort;
  persistence: PersistencePort;
  credentials: CredentialsPort;
  publicReply(input: {
    commentId: string; accessToken: string; message: string;
  }): Promise<{ commentId: string }>;
  openingPrivateReplySender: OpeningPrivateReplySender;
}>;

export function containsKeyword(text: string): boolean {
  return text.normalize('NFKC').toLocaleUpperCase('pt-BR').includes(SPRINT_ONE_BEHAVIOR.keyword);
}

export class CommentHandler {
  constructor(private readonly dependencies: CommentHandlerDependencies) {}

  async handle(event: InstagramCommentCreated, webhookEventId: string): Promise<void> {
    const conversation = await this.dependencies.persistence.recordInbound(event, webhookEventId);
    if (!containsKeyword(event.text)) return;
    const credentials = await this.dependencies.credentials.get(event.accountId);

    await this.dependencies.effects.run(
      { sourceEventId: webhookEventId, kind: 'COMMENT_PUBLIC_REPLY' },
      async () => {
        const sent = await this.dependencies.publicReply({
          commentId: event.commentId,
          accessToken: credentials.accessToken,
          message: SPRINT_ONE_BEHAVIOR.publicReply,
        });
        try {
          await this.dependencies.persistence.recordOutbound({
            conversationId: conversation.conversationId,
            externalMessageId: sent.commentId,
            type: 'PUBLIC_REPLY',
            text: SPRINT_ONE_BEHAVIOR.publicReply,
            rawPayload: { id: sent.commentId },
          });
        } catch {
          throw new MetaApiError('ambiguous', undefined, 'OUTBOUND_PERSISTENCE');
        }
        return { providerResultId: sent.commentId, commentId: sent.commentId };
      },
    );

    await this.dependencies.effects.run(
      { sourceEventId: webhookEventId, kind: 'COMMENT_PRIVATE_REPLY' },
      async (effect) => {
        const sent = await this.dependencies.openingPrivateReplySender.send({
          instagramAccountId: credentials.instagramAccountId,
          commentId: event.commentId,
          accessToken: credentials.accessToken,
          text: SPRINT_ONE_BEHAVIOR.privateReply,
          button: SPRINT_ONE_BEHAVIOR.button,
          providerRequestId: effect.providerRequestId,
        });
        try {
          await this.dependencies.persistence.recordOutbound({
            conversationId: conversation.conversationId,
            externalMessageId: sent.messageId,
            type: 'PRIVATE_REPLY',
            text: SPRINT_ONE_BEHAVIOR.privateReply,
            structuredPayload: { button: SPRINT_ONE_BEHAVIOR.button },
            rawPayload: { recipientId: sent.recipientId, messageId: sent.messageId },
          });
        } catch {
          throw new MetaApiError('ambiguous', undefined, 'OUTBOUND_PERSISTENCE');
        }
        return { providerResultId: sent.messageId, ...sent };
      },
    );
  }
}
