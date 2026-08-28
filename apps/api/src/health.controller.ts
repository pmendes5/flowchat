import { Controller, Get, Inject } from '@nestjs/common';

export const HEALTH_PROBES = Symbol('HEALTH_PROBES');

export interface HealthProbes {
  database(): Promise<boolean>;
  redis(): Promise<boolean>;
}

@Controller('health')
export class HealthController {
  constructor(@Inject(HEALTH_PROBES) private readonly probes: HealthProbes) {}

  @Get()
  async health() {
    const [database, redis] = await Promise.all([
      this.probes.database(),
      this.probes.redis(),
    ]);

    return {
      status: database && redis ? 'ok' : 'degraded',
      database: database ? 'up' : 'down',
      redis: redis ? 'up' : 'down',
    };
  }
}
