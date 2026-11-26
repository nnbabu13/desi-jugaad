-- Member-to-member blocking: a blocked pair can no longer start or continue
-- a conversation (safety surface reachable from chat and Settings).
CREATE TABLE "user_blocks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "blockerId" UUID NOT NULL,
    "blockedId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_blocks_blockerId_blockedId_key" ON "user_blocks"("blockerId", "blockedId");
CREATE INDEX "user_blocks_blockedId_idx" ON "user_blocks"("blockedId");

ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
