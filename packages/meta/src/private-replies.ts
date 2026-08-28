import type { MetaHttpClient } from './http-client.js';
import { messageResponseSchema, type SentMessage } from './messages.js';

export type SendPrivateReplyTextInput = Readonly<{
  instagramAccountId: string;
  commentId: string;
  accessToken: string;
  text: string;
}>;

export type SendButtonTemplateInput = Readonly<{
  instagramAccountId: string;
  recipientId: string;
  accessToken: string;
  text: string;
  button: Readonly<{ title: string; payload: string }>;
}>;

async function parseSentMessage(promise: Promise<unknown>): Promise<SentMessage> {
  const response = messageResponseSchema.parse(await promise);
  return { recipientId: response.recipient_id, messageId: response.message_id };
}

export function sendPrivateReplyText(
  client: MetaHttpClient,
  input: SendPrivateReplyTextInput,
): Promise<SentMessage> {
  return parseSentMessage(client.request({
    method: 'POST',
    path: `/${encodeURIComponent(input.instagramAccountId)}/messages`,
    accessToken: input.accessToken,
    body: { recipient: { comment_id: input.commentId }, message: { text: input.text } },
  }));
}

export function sendButtonTemplate(
  client: MetaHttpClient,
  input: SendButtonTemplateInput,
): Promise<SentMessage> {
  return parseSentMessage(client.request({
    method: 'POST',
    path: `/${encodeURIComponent(input.instagramAccountId)}/messages`,
    accessToken: input.accessToken,
    body: {
      recipient: { id: input.recipientId },
      message: {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'button',
            text: input.text,
            buttons: [{ type: 'postback', title: input.button.title, payload: input.button.payload }],
          },
        },
      },
    },
  }));
}
