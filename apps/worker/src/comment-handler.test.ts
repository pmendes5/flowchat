import type { InstagramCommentCreated, OpeningPrivateReplySender } from '@flowchat/contracts';
import { expect, it, vi } from 'vitest';
import { CommentHandler, containsKeyword } from './comment-handler.js';

const event: InstagramCommentCreated = {
  type: 'instagram.comment.created', eventId: 'comment-1', accountId: 'ig-1',
  occurredAt: '2026-08-28T12:00:00.000Z', commentId: 'comment-1', mediaId: 'media-1',
  actorId: 'u-1', text: 'Eu quero',
};

it.each(['QUERO', 'eu quero agora', 'QuErO!', 'eu ＱＵＥＲＯ'])('matches %s case-insensitively', (text) => {
  expect(containsKeyword(text)).toBe(true);
});

it('uses independent effects and the opening sender port', async () => {
  const effectRun = vi.fn().mockImplementation(async (_input, operation) => operation({ providerRequestId: 'effect-id' }));
  const openingPrivateReplySender: OpeningPrivateReplySender = {
    send: vi.fn().mockResolvedValue({ recipientId: 'u-1', messageId: 'mid-private' }),
  };
  const dependencies = {
    effects: { run: effectRun },
    persistence: {
      recordInbound: vi.fn().mockResolvedValue({ contactId: 'contact-db', conversationId: 'conversation-db' }),
      recordOutbound: vi.fn().mockResolvedValue(undefined),
    },
    credentials: { get: vi.fn().mockResolvedValue({ instagramAccountId: 'ig-1', accessToken: 'token' }) },
    publicReply: vi.fn().mockResolvedValue({ commentId: 'public-reply-1' }),
    openingPrivateReplySender,
  };
  await new CommentHandler(dependencies).handle(event, 'webhook-db');

  expect(effectRun).toHaveBeenNthCalledWith(1, {
    sourceEventId: 'webhook-db', kind: 'COMMENT_PUBLIC_REPLY',
  }, expect.any(Function));
  expect(effectRun).toHaveBeenNthCalledWith(2, {
    sourceEventId: 'webhook-db', kind: 'COMMENT_PRIVATE_REPLY',
  }, expect.any(Function));
  expect(openingPrivateReplySender.send).toHaveBeenCalledWith(expect.objectContaining({
    commentId: 'comment-1', text: expect.stringContaining('QUERO'),
    button: { title: 'INICIAR AQUI', payload: 'FLOW_CONTINUE' },
  }));
  expect(dependencies.persistence.recordInbound).toHaveBeenCalledBefore(dependencies.publicReply);
  expect(dependencies.persistence.recordOutbound).toHaveBeenCalledTimes(2);
});

it('persists but produces no effects when the keyword is absent', async () => {
  const effects = { run: vi.fn() };
  const persistence = {
    recordInbound: vi.fn().mockResolvedValue({ contactId: 'contact-db', conversationId: 'conversation-db' }),
    recordOutbound: vi.fn(),
  };
  const handler = new CommentHandler({
    effects, persistence, credentials: { get: vi.fn() }, publicReply: vi.fn(),
    openingPrivateReplySender: { send: vi.fn() },
  });
  await handler.handle({ ...event, text: 'Tenho interesse' }, 'webhook-db');
  expect(persistence.recordInbound).toHaveBeenCalledOnce();
  expect(effects.run).not.toHaveBeenCalled();
});
