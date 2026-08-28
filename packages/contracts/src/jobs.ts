import { z } from 'zod';
import { instagramEventSchema } from './events.js';

export const PROCESS_WEBHOOK_QUEUE = 'meta-events';

export const processWebhookJobSchema = z
  .object({
    webhookEventId: z.string().min(1),
    event: instagramEventSchema,
  })
  .strict();

export type ProcessWebhookJob = z.infer<typeof processWebhookJobSchema>;

export const parseProcessWebhookJob = (input: unknown): ProcessWebhookJob => processWebhookJobSchema.parse(input);
