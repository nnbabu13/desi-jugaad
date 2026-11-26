-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED');

-- CreateTable
CREATE TABLE "rooms" (
    "id" UUID NOT NULL,
    "hostId" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "accommodationType" VARCHAR(40) NOT NULL DEFAULT 'room_shared',
    "furnished" VARCHAR(20) NOT NULL DEFAULT 'unfurnished',
    "rent" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'GBP',
    "area" VARCHAR(160),
    "rooms" SMALLINT NOT NULL DEFAULT 1,
    "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "ListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "demoData" BOOLEAN NOT NULL DEFAULT false,
    "cityId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "participantA" UUID NOT NULL,
    "participantB" UUID NOT NULL,
    "roomId" UUID,
    "lastMessageAt" TIMESTAMPTZ(3),
    "lastMessagePreview" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "guestId" UUID NOT NULL,
    "checkIn" DATE NOT NULL,
    "checkOut" DATE NOT NULL,
    "guests" INTEGER NOT NULL DEFAULT 1,
    "nights" INTEGER NOT NULL,
    "totalPrice" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'GBP',
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rooms_status_cityId_idx" ON "rooms"("status", "cityId");

-- CreateIndex
CREATE INDEX "rooms_hostId_status_idx" ON "rooms"("hostId", "status");

-- CreateIndex
CREATE INDEX "conversations_participantB_idx" ON "conversations"("participantB");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_participantA_participantB_key" ON "conversations"("participantA", "participantB");

-- CreateIndex
CREATE INDEX "messages_conversationId_createdAt_idx" ON "messages"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "bookings_guestId_status_idx" ON "bookings"("guestId", "status");

-- CreateIndex
CREATE INDEX "bookings_roomId_status_idx" ON "bookings"("roomId", "status");

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_participantA_fkey" FOREIGN KEY ("participantA") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_participantB_fkey" FOREIGN KEY ("participantB") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
