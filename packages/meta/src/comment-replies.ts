import { z } from 'zod';
import type { MetaHttpClient } from './http-client.js';

export type ReplyToCommentInput = Readonly<{
  commentId: string;
  accessToken: string;
  message: string;
}>;

const responseSchema = z.object({ id: z.string().min(1) }).passthrough();

export async function replyToComment(
  client: MetaHttpClient,
  input: ReplyToCommentInput,
): Promise<{ commentId: string }> {
  const response = responseSchema.parse(await client.request<unknown>({
    method: 'POST',
    path: `/${encodeURIComponent(input.commentId)}/replies`,
    accessToken: input.accessToken,
    body: { message: input.message },
  }));
  return { commentId: response.id };
}
