import type { InstagramEvent } from '@flowchat/contracts';
import type { PrismaClient } from '@flowchat/database';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type MessageType = 'TEXT' | 'COMMENT' | 'POSTBACK' | 'PRIVATE_REPLY' | 'PUBLIC_REPLY';

type Operation = (input: unknown) => Promise<unknown>;

export interface PersistenceTransaction {
  instagramAccount: { findUniqueOrThrow: Operation };
  webhookEvent: { findUniqueOrThrow: Operation };
  contact: { upsert: Operation };
  conversation: { upsert: Operation };
  message: { create: Operation; upsert: Operation };
}

export interface PersistenceDatabase {
  transaction<T>(operation: (tx: PersistenceTransaction) => Promise<T>): Promise<T>;
}

export type RecordOutboundInput = Readonly<{
  conversationId: string;
  externalMessageId: string | null;
  type: Extract<MessageType, 'PRIVATE_REPLY' | 'PUBLIC_REPLY' | 'TEXT'>;
  text: string | null;
  structuredPayload?: JsonValue;
  rawPayload?: JsonValue;
}>;

function senderId(event: InstagramEvent): string {
  return event.type === 'instagram.comment.created' ? event.actorId : event.senderId;
}

function inboundType(event: InstagramEvent): Extract<MessageType, 'COMMENT' | 'POSTBACK' | 'TEXT'> {
  if (event.type === 'instagram.comment.created') return 'COMMENT';
  if (event.type === 'instagram.postback.received') return 'POSTBACK';
  return 'TEXT';
}

function inboundText(event: InstagramEvent): string | null {
  if (event.type === 'instagram.comment.created') return event.text;
  if (event.type === 'instagram.message.received') return event.text ?? null;
  return null;
}

export class PersistenceService {
  constructor(private readonly database: PersistenceDatabase) {}

  recordInbound(
    event: InstagramEvent,
    sourceWebhookEventId: string,
  ): Promise<{ contactId: string; conversationId: string }> {
    return this.database.transaction(async (tx) => {
      const account = await tx.instagramAccount.findUniqueOrThrow({
        where: { instagramUserId: event.accountId }, select: { id: true },
      }) as { id: string };
      const contact = await tx.contact.upsert({
        where: { instagramAccountId_instagramScopedUserId: {
          instagramAccountId: account.id, instagramScopedUserId: senderId(event),
        } },
        create: { instagramAccountId: account.id, instagramScopedUserId: senderId(event) },
        update: {},
        select: { id: true },
      }) as { id: string };
      const occurredAt = new Date(event.occurredAt);
      const conversation = await tx.conversation.upsert({
        where: { instagramAccountId_contactId: {
          instagramAccountId: account.id, contactId: contact.id,
        } },
        create: { instagramAccountId: account.id, contactId: contact.id, lastMessageAt: occurredAt },
        update: { lastMessageAt: occurredAt },
        select: { id: true },
      }) as { id: string };
      const source = await tx.webhookEvent.findUniqueOrThrow({
        where: { id: sourceWebhookEventId }, select: { payload: true },
      }) as { payload: JsonValue };

      await tx.message.upsert({
        where: { externalMessageId: event.eventId },
        create: {
          conversationId: conversation.id,
          externalMessageId: event.eventId,
          direction: 'INBOUND',
          type: inboundType(event),
          text: inboundText(event),
          structuredPayload: event.type === 'instagram.postback.received' ? { payload: event.payload } : undefined,
          rawPayload: source.payload,
        },
        update: {},
      });
      return { contactId: contact.id, conversationId: conversation.id };
    });
  }

  recordOutbound(input: RecordOutboundInput): Promise<void> {
    return this.database.transaction(async (tx) => {
      await tx.message.create({ data: {
        conversationId: input.conversationId,
        externalMessageId: input.externalMessageId,
        direction: 'OUTBOUND',
        type: input.type,
        text: input.text,
        structuredPayload: input.structuredPayload,
        rawPayload: input.rawPayload,
      } });
    });
  }
}

export function createPrismaPersistenceDatabase(client: PrismaClient): PersistenceDatabase {
  return {
    transaction: (operation) => client.$transaction(
      async (tx) => operation(tx as unknown as PersistenceTransaction),
    ),
  };
}
