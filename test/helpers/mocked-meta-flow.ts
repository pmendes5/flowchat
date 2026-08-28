import type { InstagramCommentCreated, InstagramEvent, InstagramPostbackReceived } from '@flowchat/contracts';
import type { EffectKind } from '@flowchat/database';
import { CommentHandler } from '../../apps/worker/src/comment-handler.js';
import { PostbackHandler } from '../../apps/worker/src/postback-handler.js';

type TimelineItem = 'public reply' | 'opening private reply: INICIAR AQUI/FLOW_CONTINUE' | 'second DM';

export function createMockedMetaFlowHarness() {
  const completed = new Set<string>();
  const events: TimelineItem[] = [];
  const counts = { publicReplies: 0, privateReplies: 0, secondDms: 0 };
  const effects = {
    async run<T>(
      input: { sourceEventId: string; kind: EffectKind },
      operation: (effect: { providerRequestId: string }) => Promise<T>,
    ): Promise<T | { skipped: true }> {
      const key = `${input.sourceEventId}:${input.kind}`;
      if (completed.has(key)) return { skipped: true };
      const result = await operation({ providerRequestId: key });
      completed.add(key);
      return result;
    },
  };
  const persistence = {
    async recordInbound(_event: InstagramEvent, _sourceId: string) {
      return { contactId: 'contact-db', conversationId: 'conversation-db' };
    },
    async recordOutbound(_input: unknown) {},
  };
  const credentials = {
    async get(accountId: string) { return { instagramAccountId: accountId, accessToken: 'mock-token' }; },
  };
  const commentHandler = new CommentHandler({
    effects,
    persistence,
    credentials,
    publicReply: async () => {
      counts.publicReplies += 1;
      events.push('public reply');
      return { commentId: 'public-reply-1' };
    },
    openingPrivateReplySender: {
      send: async (input) => {
        counts.privateReplies += 1;
        events.push(`opening private reply: ${input.button.title}/${input.button.payload}` as TimelineItem);
        return { recipientId: 'u-1', messageId: 'private-reply-1' };
      },
    },
  });
  const postbackHandler = new PostbackHandler({
    effects,
    persistence,
    credentials,
    sendDirectMessage: async () => {
      counts.secondDms += 1;
      events.push('second DM');
      return { recipientId: 'u-1', messageId: 'second-dm-1' };
    },
  });

  const comment: InstagramCommentCreated = {
    type: 'instagram.comment.created', eventId: 'comment-1', accountId: 'ig-1',
    occurredAt: '2026-08-28T12:00:00.000Z', commentId: 'comment-1', mediaId: 'media-1',
    actorId: 'u-1', text: 'QUERO',
  };
  const postback: InstagramPostbackReceived = {
    type: 'instagram.postback.received', eventId: 'postback-1', accountId: 'ig-1',
    occurredAt: '2026-08-28T12:01:00.000Z', senderId: 'u-1', recipientId: 'ig-1',
    payload: 'FLOW_CONTINUE', messageId: 'postback-1',
  };

  return {
    deliverComment: (webhookEventId: string) => commentHandler.handle(comment, webhookEventId),
    deliverPostback: (webhookEventId: string) => postbackHandler.handle(postback, webhookEventId),
    counts: () => ({ ...counts }),
    timeline: () => [...events],
    realMetaCalls: () => 0,
  };
}
