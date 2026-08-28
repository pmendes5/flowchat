import { z } from 'zod';

const eventFields = {
  eventId: z.string().min(1),
  accountId: z.string().min(1),
  occurredAt: z.string().datetime(),
};

export const instagramCommentCreatedSchema = z
  .object({
    type: z.literal('instagram.comment.created'),
    ...eventFields,
    commentId: z.string().min(1),
    mediaId: z.string().min(1),
    actorId: z.string().min(1),
    text: z.string(),
  })
  .strict();

export type InstagramCommentCreated = z.infer<typeof instagramCommentCreatedSchema>;

export const instagramPostbackReceivedSchema = z
  .object({
    type: z.literal('instagram.postback.received'),
    ...eventFields,
    senderId: z.string().min(1),
    recipientId: z.string().min(1),
    payload: z.string().min(1),
    messageId: z.string().min(1).optional(),
  })
  .strict();

export type InstagramPostbackReceived = z.infer<typeof instagramPostbackReceivedSchema>;

export const instagramMessageReceivedSchema = z
  .object({
    type: z.literal('instagram.message.received'),
    ...eventFields,
    senderId: z.string().min(1),
    recipientId: z.string().min(1),
    messageId: z.string().min(1),
    text: z.string().optional(),
  })
  .strict();

export type InstagramMessageReceived = z.infer<typeof instagramMessageReceivedSchema>;

export const instagramEventSchema = z.discriminatedUnion('type', [
  instagramCommentCreatedSchema,
  instagramPostbackReceivedSchema,
  instagramMessageReceivedSchema,
]);

export type InstagramEvent = z.infer<typeof instagramEventSchema>;

export const parseInstagramEvent = (input: unknown): InstagramEvent => instagramEventSchema.parse(input);
