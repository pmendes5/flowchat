import type { InstagramPostbackReceived } from '@flowchat/contracts';
import { expect, it, vi } from 'vitest';
import { PersistenceService, type PersistenceDatabase } from './persistence.service.js';

const postbackEvent: InstagramPostbackReceived = {
  type: 'instagram.postback.received', eventId: 'mid-1', accountId: 'ig-1',
  occurredAt: '2026-08-28T12:00:00.000Z', senderId: 'u-1', recipientId: 'ig-1',
  payload: 'FLOW_CONTINUE', messageId: 'mid-1',
};
const sanitizedStoredWebhookPayload = { entryId: 'ig-1', messaging: { postback: { payload: 'FLOW_CONTINUE' } } };

it('upserts contact/conversation and stores the postback with opaque source payload', async () => {
  const tx = {
    instagramAccount: { findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'account-db' }) },
    webhookEvent: { findUniqueOrThrow: vi.fn().mockResolvedValue({ payload: sanitizedStoredWebhookPayload }) },
    contact: { upsert: vi.fn().mockResolvedValue({ id: 'contact-db' }) },
    conversation: {
      upsert: vi.fn().mockResolvedValue({ id: 'conversation-db' }),
      update: vi.fn().mockResolvedValue({ id: 'conversation-db' }),
    },
    message: { create: vi.fn().mockResolvedValue({ id: 'message-db' }), upsert: vi.fn().mockResolvedValue({ id: 'message-db' }) },
  };
  const database: PersistenceDatabase = { transaction: async (operation) => operation(tx) };
  const service = new PersistenceService(database);

  await expect(service.recordInbound(postbackEvent, 'webhook-db')).resolves.toEqual({
    contactId: 'contact-db', conversationId: 'conversation-db',
  });
  expect(tx.contact.upsert).toHaveBeenCalledWith(expect.objectContaining({
    where: { instagramAccountId_instagramScopedUserId: {
      instagramAccountId: 'account-db', instagramScopedUserId: 'u-1',
    } },
  }));
  expect(tx.message.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({
    conversationId: 'conversation-db', externalMessageId: 'mid-1', direction: 'INBOUND',
    type: 'POSTBACK', text: null, structuredPayload: { payload: 'FLOW_CONTINUE' },
    rawPayload: sanitizedStoredWebhookPayload,
  }) }));
});

it('stores only the caller-provided sanitized provider response for outbound messages', async () => {
  const create = vi.fn().mockResolvedValue({ id: 'message-db' });
  const database: PersistenceDatabase = {
    transaction: async (operation) => operation({ message: { create, upsert: vi.fn() } } as never),
  };
  const service = new PersistenceService(database);
  await service.recordOutbound({
    conversationId: 'conversation-db', externalMessageId: 'mid-out', type: 'PUBLIC_REPLY',
    text: 'Resposta', rawPayload: { id: 'reply-1' },
  });
  expect(create).toHaveBeenCalledWith({ data: {
    conversationId: 'conversation-db', externalMessageId: 'mid-out', direction: 'OUTBOUND',
    type: 'PUBLIC_REPLY', text: 'Resposta', structuredPayload: undefined, rawPayload: { id: 'reply-1' },
  } });
});
