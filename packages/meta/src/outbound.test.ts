import { describe, expect, it, vi } from 'vitest';
import type { MetaConfig } from '@flowchat/config';
import { MetaHttpClient } from './http-client.js';
import { replyToComment } from './comment-replies.js';
import { MetaCapabilityNotVerifiedError } from './errors.js';
import { sendDirectMessage } from './messages.js';
import { MetaOpeningPrivateReplySender } from './opening-private-reply-sender.js';
import { sendButtonTemplate, sendPrivateReplyText } from './private-replies.js';

const config: Pick<MetaConfig, 'graphApiVersion'> = { graphApiVersion: 'v-test' };

function clientReturning(payload: unknown) {
  const client = new MetaHttpClient(config, vi.fn());
  const request = vi.spyOn(client, 'request').mockResolvedValue(payload);
  return { client, request };
}

describe('verified outbound Meta operations', () => {
  it('sends a textual private reply addressed only by comment ID', async () => {
    const { client, request } = clientReturning({ recipient_id: 'u-1', message_id: 'mid-private' });
    await expect(
      sendPrivateReplyText(client, {
        instagramAccountId: 'ig-1', commentId: 'comment-1', accessToken: 'token', text: 'Olá',
      }),
    ).resolves.toEqual({ recipientId: 'u-1', messageId: 'mid-private' });
    expect(request).toHaveBeenCalledWith({
      method: 'POST', path: '/ig-1/messages', accessToken: 'token',
      body: { recipient: { comment_id: 'comment-1' }, message: { text: 'Olá' } },
    });
  });

  it('sends a regular postback button template only to an existing IGSID conversation', async () => {
    const { client, request } = clientReturning({ recipient_id: 'u-1', message_id: 'mid-button' });
    await sendButtonTemplate(client, {
      instagramAccountId: 'ig-1', recipientId: 'u-1', accessToken: 'token', text: 'Continue',
      button: { title: 'INICIAR AQUI', payload: 'FLOW_CONTINUE' },
    });
    expect(request).toHaveBeenCalledWith({
      method: 'POST', path: '/ig-1/messages', accessToken: 'token',
      body: {
        recipient: { id: 'u-1' },
        message: { attachment: { type: 'template', payload: { template_type: 'button', text: 'Continue', buttons: [
          { type: 'postback', title: 'INICIAR AQUI', payload: 'FLOW_CONTINUE' },
        ] } } },
      },
    });
  });

  it('sends a direct text message to an existing IGSID conversation', async () => {
    const { client, request } = clientReturning({ recipient_id: 'u-1', message_id: 'mid-direct' });
    await sendDirectMessage(client, {
      instagramAccountId: 'ig-1', recipientId: 'u-1', accessToken: 'token', text: 'Segunda DM',
    });
    expect(request).toHaveBeenCalledWith({
      method: 'POST', path: '/ig-1/messages', accessToken: 'token',
      body: { recipient: { id: 'u-1' }, message: { text: 'Segunda DM' } },
    });
  });

  it('publishes a public reply through the comment replies edge', async () => {
    const { client, request } = clientReturning({ id: 'reply-1' });
    await expect(replyToComment(client, {
      commentId: 'comment-1', accessToken: 'token', message: 'Resposta pública',
    })).resolves.toEqual({ commentId: 'reply-1' });
    expect(request).toHaveBeenCalledWith({
      method: 'POST', path: '/comment-1/replies', accessToken: 'token', body: { message: 'Resposta pública' },
    });
  });
});

it('blocks the unverified opening interactive private reply before HTTP', async () => {
  const { client, request } = clientReturning({ recipient_id: 'u-1', message_id: 'mid-1' });
  const sender = new MetaOpeningPrivateReplySender(client);
  await expect(sender.send({
    instagramAccountId: 'ig-1', commentId: 'comment-1', accessToken: 'token', text: 'Oi',
    button: { title: 'INICIAR AQUI', payload: 'FLOW_CONTINUE' }, providerRequestId: 'effect-1',
  })).rejects.toBeInstanceOf(MetaCapabilityNotVerifiedError);
  expect(request).not.toHaveBeenCalled();
});
