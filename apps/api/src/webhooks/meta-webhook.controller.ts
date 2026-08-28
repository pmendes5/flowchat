import type { MetaConfig } from '@flowchat/config';
import { createHash, timingSafeEqual } from 'node:crypto';
import { Controller, ForbiddenException, Get, Header, Headers, HttpCode, Inject, Post, Query, Req } from '@nestjs/common';
import type { WebhookIngestionService } from './webhook-ingestion.service.js';

export const META_WEBHOOK_CONFIG = Symbol('META_WEBHOOK_CONFIG');
export const WEBHOOK_INGESTION_SERVICE = Symbol('WEBHOOK_INGESTION_SERVICE');
const VERIFIED_SUBSCRIBE_MODE = 'subscribe';

function safeEqual(candidate: unknown, expected: string): boolean {
  if (typeof candidate !== 'string') return false;
  const candidateHash = createHash('sha256').update(candidate).digest();
  const expectedHash = createHash('sha256').update(expected).digest();
  return timingSafeEqual(candidateHash, expectedHash);
}

@Controller('webhooks/meta')
export class MetaWebhookController {
  constructor(
    @Inject(META_WEBHOOK_CONFIG) private readonly config: MetaConfig,
    @Inject(WEBHOOK_INGESTION_SERVICE) private readonly ingestion: WebhookIngestionService,
  ) {}

  @Get()
  @Header('Content-Type', 'text/plain; charset=utf-8')
  verify(
    @Query('hub.mode') mode: unknown,
    @Query('hub.verify_token') token: unknown,
    @Query('hub.challenge') challenge: unknown,
  ): string {
    if (
      mode !== VERIFIED_SUBSCRIBE_MODE ||
      !safeEqual(token, this.config.webhookVerifyToken) ||
      typeof challenge !== 'string' ||
      challenge.length === 0
    ) {
      throw new ForbiddenException('Webhook verification failed');
    }
    return challenge;
  }

  @Post()
  @HttpCode(200)
  ingest(
    @Req() request: { rawBody?: Buffer },
    @Headers('x-hub-signature-256') signature: string | undefined,
  ): Promise<{ accepted: number }> {
    if (request.rawBody === undefined) {
      throw new ForbiddenException('Webhook raw body unavailable');
    }
    return this.ingestion.ingest(request.rawBody, signature);
  }
}
