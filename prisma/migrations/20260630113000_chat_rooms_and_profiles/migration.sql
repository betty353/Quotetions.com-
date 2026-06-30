ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "profileImageUrl" TEXT;

CREATE TABLE IF NOT EXISTS "InternalChatRoom" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdById" TEXT NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InternalChatRoom_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InternalChatRoomMember" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "addedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InternalChatRoomMember_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "InternalChatMessage" ADD COLUMN IF NOT EXISTS "roomId" TEXT;

CREATE INDEX IF NOT EXISTS "InternalChatMessage_roomId_idx" ON "InternalChatMessage"("roomId");
CREATE INDEX IF NOT EXISTS "InternalChatRoom_companyId_idx" ON "InternalChatRoom"("companyId");
CREATE INDEX IF NOT EXISTS "InternalChatRoom_createdById_idx" ON "InternalChatRoom"("createdById");
CREATE UNIQUE INDEX IF NOT EXISTS "InternalChatRoomMember_roomId_userId_key" ON "InternalChatRoomMember"("roomId", "userId");
CREATE INDEX IF NOT EXISTS "InternalChatRoomMember_companyId_idx" ON "InternalChatRoomMember"("companyId");
CREATE INDEX IF NOT EXISTS "InternalChatRoomMember_roomId_idx" ON "InternalChatRoomMember"("roomId");
CREATE INDEX IF NOT EXISTS "InternalChatRoomMember_userId_idx" ON "InternalChatRoomMember"("userId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InternalChatRoom_companyId_fkey') THEN
    ALTER TABLE "InternalChatRoom"
      ADD CONSTRAINT "InternalChatRoom_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InternalChatRoomMember_companyId_fkey') THEN
    ALTER TABLE "InternalChatRoomMember"
      ADD CONSTRAINT "InternalChatRoomMember_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InternalChatRoomMember_roomId_fkey') THEN
    ALTER TABLE "InternalChatRoomMember"
      ADD CONSTRAINT "InternalChatRoomMember_roomId_fkey"
      FOREIGN KEY ("roomId") REFERENCES "InternalChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InternalChatRoomMember_userId_fkey') THEN
    ALTER TABLE "InternalChatRoomMember"
      ADD CONSTRAINT "InternalChatRoomMember_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InternalChatMessage_roomId_fkey') THEN
    ALTER TABLE "InternalChatMessage"
      ADD CONSTRAINT "InternalChatMessage_roomId_fkey"
      FOREIGN KEY ("roomId") REFERENCES "InternalChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
