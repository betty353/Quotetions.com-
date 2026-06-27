DROP INDEX IF EXISTS "User_firebaseUid_key";
ALTER TABLE "User" DROP COLUMN IF EXISTS "firebaseUid";
