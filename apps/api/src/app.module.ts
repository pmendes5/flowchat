import type { DynamicModule } from '@nestjs/common';
import { Module } from '@nestjs/common';
import {
  HEALTH_PROBES,
  HealthController,
  type HealthProbes,
} from './health.controller.js';

@Module({})
export class AppModule {
  static register(probes: HealthProbes): DynamicModule {
    return {
      module: AppModule,
      controllers: [HealthController],
      providers: [{ provide: HEALTH_PROBES, useValue: probes }],
    };
  }
}
