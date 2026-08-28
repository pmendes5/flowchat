import type { InstagramPostbackReceived } from '@flowchat/contracts';
import { expect, it, vi } from 'vitest';
import { PostbackHandler } from './postback-handler.js';
import { SPRINT_ONE_BEHAVIOR } from './sprint-one-config.js';

const event: InstagramPostbackReceived = {
  type: 'instagram.postback.received', eventId: 'mid-1', accountId: 'ig-1',
  occurredAt: '2026-08-28T12:00:00.000Z', senderId: 'u-1', recipientId: 'ig-1',
  payload: 'FLOW_CONTINUE', messageId: 'mid-1',
};

function dependencies() {
  return {
    effects: { run: vi.fn().mockImplementation(async (_input, operation) => operation()) },
    persistence: {
      recordInbound: vi.fn().mockResolvedValue({ contactId: 'contact-db', conversationId: 'conversation-db' }),
      recordOutbound: vi.fn().mockResolvedValue(undefined),
    },
    credentials: { get: vi.fn().mockResolvedValue({ instagramAccountId: 'ig-1', accessToken: 'token' }) },
    sendDirectMessage: vi.fn().mockResolvedValue({ recipientId: 'u-1', messageId: 'mid-second' }),
  };
}

it('sends the continuation once for FLOW_CONTINUE', async () => {
  const deps = dependencies();
  await expect(new PostbackHandler(deps).handle(event, 'webhook-db')).resolves.toBe('continued');
  expect(deps.effects.run).toHaveBeenCalledWith({
    sourceEventId: 'webhook-db', kind: 'POSTBACK_SECOND_DM',
  }, expect.any(Function));
  expect(deps.sendDirectMessage).toHaveBeenCalledWith({
    instagramAccountId: 'ig-1', recipientId: 'u-1', accessToken: 'token',
    text: SPRINT_ONE_BEHAVIOR.continuation,
  });
  expect(deps.persistence.recordOutbound).toHaveBeenCalledOnce();
});

it('safely ignores an unknown payload after persisting inbound', async () => {
  const deps = dependencies();
  await expect(new PostbackHandler(deps).handle({ ...event, payload: 'UNKNOWN' }, 'webhook-db'))
    .resolves.toBe('ignored');
  expect(deps.persistence.recordInbound).toHaveBeenCalledOnce();
  expect(deps.effects.run).not.toHaveBeenCalled();
  expect(deps.sendDirectMessage).not.toHaveBeenCalled();
});
