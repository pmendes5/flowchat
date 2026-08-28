import { z } from 'zod';

export const envSchema = z.object({
  META_APP_ID: z.string().min(1),
  META_APP_SECRET: z.string().min(1),
  META_WEBHOOK_VERIFY_TOKEN: z.string().min(1),
  META_REDIRECT_URI: z.url(),
  META_GRAPH_API_VERSION: z.string().regex(/^v\d+\.\d+$/),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  APP_ENCRYPTION_KEY: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3001),
});

export type Environment = z.infer<typeof envSchema>;
