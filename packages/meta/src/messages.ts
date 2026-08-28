import { z } from 'zod';
import type { MetaHttpClient } from './http-client.js';

export type SendDirectMessageInput = Readonly<{
  instagramAccountId: string;
  recipientId: string;
  accessToken: string;
  text: string;
}>;

const messageResponseSchema = z
  .object({ recipient_id: z.string().min(1), message_id: z.string().min(1) })
  .passthrough();

export type SentMessage = Readonly<{ recipientId: string; messageId: string }>;

export async function sendDirectMessage(
  client: MetaHttpClient,
  input: SendDirectMessageInput,
): Promise<SentMessage> {
  const response = messageResponseSchema.parse(await client.request<unknown>({
    method: 'POST',
    path: `/${encodeURIComponent(input.instagramAccountId)}/messages`,
    accessToken: input.accessToken,
    body: { recipient: { id: input.recipientId }, message: { text: input.text } },
  }));
  return { recipientId: response.recipient_id, messageId: response.message_id };
}

export { messageResponseSchema };
