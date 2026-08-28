import type {
  OpeningPrivateReplyInput,
  OpeningPrivateReplyResult,
  OpeningPrivateReplySender,
} from '@flowchat/contracts';
import { MetaCapabilityNotVerifiedError } from './errors.js';
import type { MetaHttpClient } from './http-client.js';

export class MetaOpeningPrivateReplySender implements OpeningPrivateReplySender {
  constructor(private readonly client: MetaHttpClient) {}

  async send(input: OpeningPrivateReplyInput): Promise<OpeningPrivateReplyResult> {
    void input;
    void this.client;
    throw new MetaCapabilityNotVerifiedError();
  }
}
