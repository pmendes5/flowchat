import type { ProcessWebhookJob } from '@flowchat/contracts';
import { expect, it, vi } from 'vitest';
import { EventProcessor } from './event.processor.js';

const base = { eventId: 'event-1', accountId: 'ig-1', occurredAt: '2026-08-28T12:00:00.000Z' };

function processor() {
  const dependencies = {
    comments: { handle: vi.fn().mockResolvedValue(undefined) },
    postbacks: { handle: vi.fn().mockResolvedValue('continued') },
    persistence: { recordInbound: vi.fn().mockResolvedValue({ contactId: 'c', conversationId: 'v' }) },
    events: {
      markProcessing: vi.fn().mockResolvedValue(undefined),
      markCompleted: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
    },
  };
  return { instance: new EventProcessor(dependencies), dependencies };
}

it.each([
  ['instagram.comment.created', { ...base, type: 'instagram.comment.created', commentId: 'comment-1', mediaId: 'media-1', actorId: 'u-1', text: 'QUERO' }],
  ['instagram.postback.received', { ...base, type: 'instagram.postback.received', senderId: 'u-1', recipientId: 'ig-1', payload: 'FLOW_CONTINUE' }],
  ['instagram.message.received', { ...base, type: 'instagram.message.received', senderId: 'u-1', recipientId: 'ig-1', messageId: 'mid-1', text: 'Oi' }],
] as const)('dispatches %s and completes the webhook event', async (type, event) => {
  const { instance, dependencies } = processor();
  const data = { webhookEventId: 'webhook-db', event } as ProcessWebhookJob;
  await instance.handle({ data } as never);
  expect(dependencies.events.markProcessing).toHaveBeenCalledWith('webhook-db');
  expect(dependencies.events.markCompleted).toHaveBeenCalledWith('webhook-db');
  if (type === 'instagram.comment.created') expect(dependencies.comments.handle).toHaveBeenCalledWith(event, 'webhook-db');
  if (type === 'instagram.postback.received') expect(dependencies.postbacks.handle).toHaveBeenCalledWith(event, 'webhook-db');
  if (type === 'instagram.message.received') expect(dependencies.persistence.recordInbound).toHaveBeenCalledWith(event, 'webhook-db');
});

it('stores only a sanitized failure code and rethrows', async () => {
  const { instance, dependencies } = processor();
  dependencies.comments.handle.mockRejectedValue(new Error('secret provider body'));
  const data = { webhookEventId: 'webhook-db', event: {
    ...base, type: 'instagram.comment.created', commentId: 'comment-1', mediaId: 'media-1', actorId: 'u-1', text: 'QUERO',
  } } as ProcessWebhookJob;
  await expect(instance.handle({ data } as never)).rejects.toThrow('secret provider body');
  expect(dependencies.events.markFailed).toHaveBeenCalledWith('webhook-db', 'PROCESSING_FAILED');
});
