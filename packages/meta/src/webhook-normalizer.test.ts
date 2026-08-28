import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MetaWebhookNormalizationError, normalizeMetaWebhook } from './webhook-normalizer.js';

function fixture(name: 'comment' | 'message' | 'postback'): unknown {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8')) as unknown;
}

describe('normalizeMetaWebhook', () => {
  it('normalizes a comment into the stable internal contract', () => {
    const [item] = normalizeMetaWebhook(fixture('comment'));
    expect(item?.event).toEqual({
      type: 'instagram.comment.created',
      eventId: 'comment-1',
      accountId: 'ig-1',
      occurredAt: '2026-08-28T12:00:00.000Z',
      commentId: 'comment-1',
      mediaId: 'media-1',
      actorId: 'u-1',
      text: 'QUERO',
    });
    expect(item?.externalEventId).toBe('comment-1');
    expect(item?.dedupKey).toBe('instagram.comment.created:comment-1');
  });

  it('normalizes a postback without leaking provider envelope fields', () => {
    const [item] = normalizeMetaWebhook(fixture('postback'));
    expect(item?.event).toEqual({
      type: 'instagram.postback.received',
      eventId: 'mid-1',
      accountId: 'ig-1',
      occurredAt: '2026-08-28T12:00:00.000Z',
      senderId: 'u-1',
      recipientId: 'ig-1',
      payload: 'FLOW_CONTINUE',
      messageId: 'mid-1',
    });
    expect(item?.event).not.toHaveProperty('entry');
  });

  it('normalizes a text message', () => {
    const [item] = normalizeMetaWebhook(fixture('message'));
    expect(item?.event).toEqual({
      type: 'instagram.message.received',
      eventId: 'mid-2',
      accountId: 'ig-1',
      occurredAt: '2026-08-28T12:00:00.000Z',
      senderId: 'u-1',
      recipientId: 'ig-1',
      messageId: 'mid-2',
      text: 'Olá',
    });
  });

  it('uses a deterministic hash when a postback has no external message ID', () => {
    const payload = fixture('postback') as Record<string, unknown>;
    const entry = (payload.entry as Array<Record<string, unknown>>)[0];
    const messaging = (entry?.messaging as Array<Record<string, unknown>>)[0];
    delete (messaging?.postback as Record<string, unknown>).mid;

    const first = normalizeMetaWebhook(payload)[0];
    const second = normalizeMetaWebhook(payload)[0];
    expect(first?.externalEventId).toBeNull();
    expect(first?.dedupKey).toMatch(/^[a-f0-9]{64}$/);
    expect(second?.dedupKey).toBe(first?.dedupKey);
  });

  it('rejects malformed items with a sanitized error', () => {
    const malformed = fixture('message') as Record<string, unknown>;
    const entry = (malformed.entry as Array<Record<string, unknown>>)[0];
    const messaging = (entry?.messaging as Array<Record<string, unknown>>)[0];
    messaging!.sender = { id: '' };
    messaging!.access_token = 'must-not-leak';

    expect(() => normalizeMetaWebhook(malformed)).toThrow(MetaWebhookNormalizationError);
    try {
      normalizeMetaWebhook(malformed);
    } catch (error) {
      expect(String(error)).not.toContain('must-not-leak');
      expect(error).not.toHaveProperty('input');
    }
  });

  it('keeps valid items when another item in the same batch is malformed', () => {
    const payload = fixture('message') as Record<string, unknown>;
    const entry = (payload.entry as Array<Record<string, unknown>>)[0]!;
    const valid = (entry.messaging as unknown[])[0];
    entry.messaging = [{ sender: { id: '' }, access_token: 'must-not-leak' }, valid];
    expect(normalizeMetaWebhook(payload)).toHaveLength(1);
  });
});
