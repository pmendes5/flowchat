import type { DynamicModule } from '@nestjs/common';
import { Module } from '@nestjs/common';
import {
  HEALTH_PROBES,
  HealthController,
  type HealthProbes,
} from './health.controller.js';
import type { MetaConfig } from '@flowchat/config';
import { WebhooksModule } from './webhooks/webhooks.module.js';
import type { WebhookIngestionDependencies } from './webhooks/webhook-ingestion.service.js';

@Module({})
export class AppModule {
  static register(
    probes: HealthProbes,
    metaConfig: MetaConfig,
    webhookDependencies: WebhookIngestionDependencies,
  ): DynamicModule {
    return {
      module: AppModule,
      imports: [WebhooksModule.register(metaConfig, webhookDependencies)],
      controllers: [HealthController],
      providers: [{ provide: HEALTH_PROBES, useValue: probes }],
    };
  }
}
