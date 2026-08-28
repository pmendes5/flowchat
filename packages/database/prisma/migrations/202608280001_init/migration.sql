CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');
CREATE TYPE "WebhookStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'COMMENT', 'POSTBACK', 'PRIVATE_REPLY', 'PUBLIC_REPLY');
CREATE TYPE "ExternalEffectKind" AS ENUM ('COMMENT_PUBLIC_REPLY', 'COMMENT_PRIVATE_REPLY', 'POSTBACK_SECOND_DM');
CREATE TYPE "ExternalEffectStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'UNCERTAIN');

CREATE TABLE "InstagramAccount" (
  "id" TEXT NOT NULL,
  "instagramUserId" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "accessTokenEncrypted" TEXT NOT NULL,
  "tokenExpiresAt" TIMESTAMP(3),
  "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InstagramAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebhookEvent" (
  "id" TEXT NOT NULL,
  "externalEventId" TEXT,
  "dedupKey" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "WebhookStatus" NOT NULL DEFAULT 'PENDING',
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "error" TEXT,
  CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Contact" (
  "id" TEXT NOT NULL,
  "instagramAccountId" TEXT NOT NULL,
  "instagramScopedUserId" TEXT NOT NULL,
  "username" TEXT,
  "name" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Conversation" (
  "id" TEXT NOT NULL,
  "instagramAccountId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "status" "ConversationStatus" NOT NULL DEFAULT 'OPEN',
  "lastMessageAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Message" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "externalMessageId" TEXT,
  "direction" "MessageDirection" NOT NULL,
  "type" "MessageType" NOT NULL,
  "text" TEXT,
  "structuredPayload" JSONB,
  "rawPayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExternalEffect" (
  "id" TEXT NOT NULL,
  "sourceEventId" TEXT NOT NULL,
  "kind" "ExternalEffectKind" NOT NULL,
  "status" "ExternalEffectStatus" NOT NULL DEFAULT 'PENDING',
  "providerRequestId" TEXT NOT NULL,
  "providerResultId" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastErrorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "ExternalEffect_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InstagramAccount_instagramUserId_key" ON "InstagramAccount"("instagramUserId");
CREATE UNIQUE INDEX "WebhookEvent_dedupKey_key" ON "WebhookEvent"("dedupKey");
CREATE INDEX "WebhookEvent_status_receivedAt_idx" ON "WebhookEvent"("status", "receivedAt");
CREATE UNIQUE INDEX "Contact_instagramAccountId_instagramScopedUserId_key" ON "Contact"("instagramAccountId", "instagramScopedUserId");
CREATE UNIQUE INDEX "Conversation_instagramAccountId_contactId_key" ON "Conversation"("instagramAccountId", "contactId");
CREATE INDEX "Conversation_lastMessageAt_idx" ON "Conversation"("lastMessageAt");
CREATE UNIQUE INDEX "Message_externalMessageId_key" ON "Message"("externalMessageId");
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");
CREATE UNIQUE INDEX "ExternalEffect_providerRequestId_key" ON "ExternalEffect"("providerRequestId");
CREATE UNIQUE INDEX "ExternalEffect_sourceEventId_kind_key" ON "ExternalEffect"("sourceEventId", "kind");
CREATE INDEX "ExternalEffect_status_createdAt_idx" ON "ExternalEffect"("status", "createdAt");

ALTER TABLE "Contact" ADD CONSTRAINT "Contact_instagramAccountId_fkey" FOREIGN KEY ("instagramAccountId") REFERENCES "InstagramAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_instagramAccountId_fkey" FOREIGN KEY ("instagramAccountId") REFERENCES "InstagramAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExternalEffect" ADD CONSTRAINT "ExternalEffect_sourceEventId_fkey" FOREIGN KEY ("sourceEventId") REFERENCES "WebhookEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
