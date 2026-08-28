import { createHash } from 'node:crypto';
import { parseInstagramEvent, type InstagramEvent } from '@flowchat/contracts';
import { z } from 'zod';

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export type NormalizedWebhookItem = Readonly<{
  dedupKey: string;
  externalEventId: string | null;
  event: InstagramEvent;
  rawPayload: JsonValue;
}>;

export class MetaWebhookNormalizationError extends Error {
  constructor() {
    super('Invalid Meta webhook item');
    this.name = 'MetaWebhookNormalizationError';
  }
}

const idSchema = z.string().min(1);
const actorSchema = z.object({ id: idSchema }).passthrough();
const commentValueSchema = z
  .object({
    id: idSchema,
    media: z.object({ id: idSchema }).passthrough(),
    from: actorSchema,
    text: z.string(),
  })
  .passthrough();
const changeSchema = z.object({ field: z.string(), value: z.unknown() }).passthrough();
const messagingSchema = z
  .object({
    sender: actorSchema,
    recipient: actorSchema,
    timestamp: z.number().finite(),
    message: z.object({ mid: idSchema, text: z.string().optional() }).passthrough().optional(),
    postback: z.object({ mid: idSchema.optional(), payload: idSchema }).passthrough().optional(),
  })
  .passthrough();
const entrySchema = z
  .object({
    id: idSchema,
    time: z.number().finite().optional(),
    changes: z.array(z.unknown()).optional(),
    messaging: z.array(z.unknown()).optional(),
  })
  .passthrough();
const webhookSchema = z.object({ object: z.literal('instagram'), entry: z.array(entrySchema) }).passthrough();

const SENSITIVE_KEY = /^(?:access_token|authorization|app_secret|client_secret|code|token)$/i;

function sanitize(value: unknown): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.map(sanitize);
  if (typeof value !== 'object') return null;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !SENSITIVE_KEY.test(key))
      .map(([key, item]) => [key, sanitize(item)]),
  );
}

export function deterministicDedupKey(parts: readonly string[]): string {
  return createHash('sha256').update(parts.join('\u001f')).digest('hex');
}

function occurredAt(timestamp: number, unit: 'seconds' | 'milliseconds'): string {
  const milliseconds = unit === 'seconds' ? timestamp * 1000 : timestamp;
  const result = new Date(milliseconds);
  if (Number.isNaN(result.valueOf())) throw new MetaWebhookNormalizationError();
  return result.toISOString();
}

function makeItem(event: InstagramEvent, externalEventId: string | null, rawPayload: unknown): NormalizedWebhookItem {
  const fallback = deterministicDedupKey([
    event.type,
    event.accountId,
    event.occurredAt,
    JSON.stringify(event),
  ]);
  return {
    event,
    externalEventId,
    dedupKey: externalEventId === null ? fallback : `${event.type}:${externalEventId}`,
    rawPayload: sanitize(rawPayload),
  };
}

export function normalizeMetaWebhook(input: unknown): NormalizedWebhookItem[] {
  try {
    const webhook = webhookSchema.parse(input);
    const items: NormalizedWebhookItem[] = [];
    let rejected = 0;

    for (const entry of webhook.entry) {
      for (const rawChange of entry.changes ?? []) {
        try {
          const change = changeSchema.parse(rawChange);
          if (change.field !== 'comments') continue;
          const value = commentValueSchema.parse(change.value);
          const event = parseInstagramEvent({
          type: 'instagram.comment.created',
          eventId: value.id,
          accountId: entry.id,
          occurredAt: occurredAt(entry.time ?? 0, 'seconds'),
          commentId: value.id,
          mediaId: value.media.id,
          actorId: value.from.id,
          text: value.text,
          });
          items.push(makeItem(event, value.id, { entryId: entry.id, time: entry.time, change }));
        } catch {
          rejected += 1;
        }
      }

      for (const rawMessaging of entry.messaging ?? []) {
        try {
          const messaging = messagingSchema.parse(rawMessaging);
        if (messaging.postback !== undefined) {
          const externalId = messaging.postback.mid ?? null;
          const fallbackId = deterministicDedupKey([
            entry.id,
            messaging.sender.id,
            messaging.recipient.id,
            String(messaging.timestamp),
            messaging.postback.payload,
          ]);
          const event = parseInstagramEvent({
            type: 'instagram.postback.received',
            eventId: externalId ?? `generated:${fallbackId}`,
            accountId: entry.id,
            occurredAt: occurredAt(messaging.timestamp, 'milliseconds'),
            senderId: messaging.sender.id,
            recipientId: messaging.recipient.id,
            payload: messaging.postback.payload,
            ...(externalId === null ? {} : { messageId: externalId }),
          });
          items.push(makeItem(event, externalId, { entryId: entry.id, messaging }));
        }

        if (messaging.message !== undefined) {
          const event = parseInstagramEvent({
            type: 'instagram.message.received',
            eventId: messaging.message.mid,
            accountId: entry.id,
            occurredAt: occurredAt(messaging.timestamp, 'milliseconds'),
            senderId: messaging.sender.id,
            recipientId: messaging.recipient.id,
            messageId: messaging.message.mid,
            ...(messaging.message.text === undefined ? {} : { text: messaging.message.text }),
          });
          items.push(makeItem(event, messaging.message.mid, { entryId: entry.id, messaging }));
        }
        } catch {
          rejected += 1;
        }
      }
    }

    if (items.length === 0 && rejected > 0) throw new MetaWebhookNormalizationError();
    return items;
  } catch (error) {
    if (error instanceof MetaWebhookNormalizationError) throw error;
    throw new MetaWebhookNormalizationError();
  }
}
