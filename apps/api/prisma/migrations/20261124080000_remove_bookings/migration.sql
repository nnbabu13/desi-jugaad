-- The platform only shows availability and lets people chat to arrange a
-- stay (Craigslist-style), so the booking flow and its table are removed.
DROP TABLE "bookings";

DROP TYPE "BookingStatus";
