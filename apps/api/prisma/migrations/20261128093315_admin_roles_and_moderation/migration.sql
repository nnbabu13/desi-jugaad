-- Admin roles, the listing review trail and platform settings (Stage A).
--
-- Runs AFTER 20261128093314, which lands PENDING/REJECTED, so this migration
-- may legally use PENDING as the rooms.status default.

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- AlterTable: review trail + new listings now default to PENDING, so nothing
-- is publicly visible until an admin approves it.
ALTER TABLE "rooms"
  ADD COLUMN "reviewNote" VARCHAR(500),
  ADD COLUMN "reviewedAt" TIMESTAMPTZ(3),
  ADD COLUMN "reviewedBy" UUID,
  ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- AlterTable: pre-existing drift surfaced by this diff - the schema declares a
-- client-side uuid default and timestamptz(3) for user_blocks.createdAt, while
-- the table still carried gen_random_uuid() and timestamptz(6). Non-Prisma
-- inserts always supply id themselves, so dropping the DB default is safe.
ALTER TABLE "user_blocks" ALTER COLUMN "id" DROP DEFAULT,
  ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "platform_settings" (
    "id" UUID NOT NULL,
    "key" VARCHAR(64) NOT NULL,
    "value" JSONB NOT NULL,
    "updatedBy" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_settings_key_key" ON "platform_settings"("key");
