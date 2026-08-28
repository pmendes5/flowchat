export type OpeningPrivateReplyInput = Readonly<{
  instagramAccountId: string;
  commentId: string;
  accessToken: string;
  text: string;
  button: Readonly<{ title: string; payload: string }>;
  providerRequestId: string;
}>;

export type OpeningPrivateReplyResult = Readonly<{
  recipientId: string;
  messageId: string;
}>;

export interface OpeningPrivateReplySender {
  send(input: OpeningPrivateReplyInput): Promise<OpeningPrivateReplyResult>;
}
