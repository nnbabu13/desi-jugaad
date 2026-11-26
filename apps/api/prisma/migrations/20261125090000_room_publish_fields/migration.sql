-- Listing details collected by the publish wizard (available-from date,
-- bills flag, house rules) so the data users type is really stored.
ALTER TABLE "rooms" ADD COLUMN "availableFrom" DATE;
ALTER TABLE "rooms" ADD COLUMN "billsIncluded" BOOLEAN;
ALTER TABLE "rooms" ADD COLUMN "houseRules" TEXT;
