import type { MetaConfig } from '@flowchat/config';
import type { DynamicModule } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { META_WEBHOOK_CONFIG, MetaWebhookController } from './meta-webhook.controller.js';
import { WEBHOOK_INGESTION_SERVICE } from './meta-webhook.controller.js';
import { WebhookIngestionService, type WebhookIngestionDependencies } from './webhook-ingestion.service.js';

@Module({})
export class WebhooksModule {
  static register(config: MetaConfig, dependencies: WebhookIngestionDependencies): DynamicModule {
    return {
      module: WebhooksModule,
      controllers: [MetaWebhookController],
      providers: [
        { provide: META_WEBHOOK_CONFIG, useValue: config },
        {
          provide: WEBHOOK_INGESTION_SERVICE,
          useValue: new WebhookIngestionService(config.appSecret, dependencies),
        },
      ],
    };
  }
}
