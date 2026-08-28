import { describe, expect, it } from 'vitest';
import { createMockedMetaFlowHarness } from '../helpers/mocked-meta-flow.js';

describe('Sprint 1 flow without OAuth or real Meta calls', () => {
  it('keeps every external effect singular across duplicate comment and postback jobs', async () => {
    const harness = createMockedMetaFlowHarness();
    await harness.deliverComment('webhook-comment');
    await harness.deliverComment('webhook-comment');
    await harness.deliverPostback('webhook-postback');
    await harness.deliverPostback('webhook-postback');

    expect(harness.counts()).toEqual({ publicReplies: 1, privateReplies: 1, secondDms: 1 });
    expect(harness.timeline()).toEqual([
      'public reply',
      'opening private reply: INICIAR AQUI/FLOW_CONTINUE',
      'second DM',
    ]);
    expect(harness.realMetaCalls()).toBe(0);
  });
});
