import { describe, expect, it } from 'vitest';
import { parseInstagramEvent, parseProcessWebhookJob } from './index.js';

describe('internal contracts', () => {
  it('parses a comment job', () => {
    const event = {
      type: 'instagram.comment.created',
      eventId: 'evt-1',
      accountId: 'ig-1',
      occurredAt: '2026-08-28T12:00:00.000Z',
      commentId: 'c-1',
      mediaId: 'm-1',
      actorId: 'u-1',
      text: 'QUERO',
    } as const;

    expect(parseProcessWebhookJob({ webhookEventId: 'db-1', event }).event).toEqual(event);
  });

  it('parses a postback event', () => {
    const event = {
      type: 'instagram.postback.received',
      eventId: 'evt-2',
      accountId: 'ig-1',
      occurredAt: '2026-08-28T12:00:00.000Z',
      senderId: 'u-1',
      recipientId: 'ig-1',
      payload: 'FLOW_CONTINUE',
    } as const;

    expect(parseInstagramEvent(event)).toEqual(event);
  });

  it('parses a message event', () => {
    const event = {
      type: 'instagram.message.received',
      eventId: 'evt-3',
      accountId: 'ig-1',
      occurredAt: '2026-08-28T12:00:00.000Z',
      senderId: 'u-1',
      recipientId: 'ig-1',
      messageId: 'mid-1',
      text: 'Olá',
    } as const;

    expect(parseInstagramEvent(event)).toEqual(event);
  });

  it('rejects external-only fields', () => {
    expect(() =>
      parseInstagramEvent({
        type: 'instagram.message.received',
        eventId: 'evt-3',
        accountId: 'ig-1',
        occurredAt: '2026-08-28T12:00:00.000Z',
        senderId: 'u-1',
        recipientId: 'ig-1',
        messageId: 'mid-1',
        entry: [],
      }),
    ).toThrow();
  });
});
