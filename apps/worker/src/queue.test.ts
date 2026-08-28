import { describe, expect, it, vi } from 'vitest';
import { createEventQueue } from './queue.js';

describe('event queue', () => {
  it('creates the shared queue with bounded exponential retry', () => {
    const QueueCtor = vi.fn();

    createEventQueue({ host: 'localhost' }, QueueCtor as never);

    expect(QueueCtor).toHaveBeenCalledWith(
      'meta-events',
      expect.objectContaining({
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: 1000,
          removeOnFail: 5000,
        },
      }),
    );
  });
});
