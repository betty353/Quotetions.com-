CREATE TABLE IF NOT EXISTS "InternalChatMessage" (
  "id" TEXT NOT NULL,
  "companyId" TEXT,
  "senderId" TEXT NOT NULL,
  "recipientId" TEXT,
  "message" TEXT NOT NULL,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InternalChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InternalChatMessage_companyId_idx" ON "InternalChatMessage"("companyId");
CREATE INDEX IF NOT EXISTS "InternalChatMessage_senderId_idx" ON "InternalChatMessage"("senderId");
CREATE INDEX IF NOT EXISTS "InternalChatMessage_recipientId_idx" ON "InternalChatMessage"("recipientId");
CREATE INDEX IF NOT EXISTS "InternalChatMessage_createdAt_idx" ON "InternalChatMessage"("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InternalChatMessage_companyId_fkey') THEN
    ALTER TABLE "InternalChatMessage"
      ADD CONSTRAINT "InternalChatMessage_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InternalChatMessage_senderId_fkey') THEN
    ALTER TABLE "InternalChatMessage"
      ADD CONSTRAINT "InternalChatMessage_senderId_fkey"
      FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InternalChatMessage_recipientId_fkey') THEN
    ALTER TABLE "InternalChatMessage"
      ADD CONSTRAINT "InternalChatMessage_recipientId_fkey"
      FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
