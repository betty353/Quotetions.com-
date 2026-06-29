ALTER TABLE "InternalChatMessage"
  ADD COLUMN IF NOT EXISTS "replyToId" TEXT,
  ADD COLUMN IF NOT EXISTS "attachmentUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "attachmentName" TEXT,
  ADD COLUMN IF NOT EXISTS "attachmentType" TEXT,
  ADD COLUMN IF NOT EXISTS "linkType" TEXT,
  ADD COLUMN IF NOT EXISTS "linkId" TEXT,
  ADD COLUMN IF NOT EXISTS "linkLabel" TEXT,
  ADD COLUMN IF NOT EXISTS "isPinned" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "editedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedById" TEXT;

CREATE INDEX IF NOT EXISTS "InternalChatMessage_replyToId_idx" ON "InternalChatMessage"("replyToId");
CREATE INDEX IF NOT EXISTS "InternalChatMessage_isPinned_idx" ON "InternalChatMessage"("isPinned");

CREATE TABLE IF NOT EXISTS "InternalChatPresence" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InternalChatPresence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InternalChatPresence_companyId_userId_key" ON "InternalChatPresence"("companyId", "userId");
CREATE INDEX IF NOT EXISTS "InternalChatPresence_companyId_idx" ON "InternalChatPresence"("companyId");
CREATE INDEX IF NOT EXISTS "InternalChatPresence_userId_idx" ON "InternalChatPresence"("userId");
CREATE INDEX IF NOT EXISTS "InternalChatPresence_lastSeenAt_idx" ON "InternalChatPresence"("lastSeenAt");

CREATE TABLE IF NOT EXISTS "InternalChatTyping" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "recipientId" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InternalChatTyping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InternalChatTyping_companyId_userId_channel_key" ON "InternalChatTyping"("companyId", "userId", "channel");
CREATE INDEX IF NOT EXISTS "InternalChatTyping_companyId_idx" ON "InternalChatTyping"("companyId");
CREATE INDEX IF NOT EXISTS "InternalChatTyping_userId_idx" ON "InternalChatTyping"("userId");
CREATE INDEX IF NOT EXISTS "InternalChatTyping_channel_idx" ON "InternalChatTyping"("channel");
CREATE INDEX IF NOT EXISTS "InternalChatTyping_expiresAt_idx" ON "InternalChatTyping"("expiresAt");
