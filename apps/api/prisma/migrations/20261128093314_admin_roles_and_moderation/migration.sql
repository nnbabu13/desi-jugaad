-- Moderation states used by admin listing review.
--
-- Deliberately split from the rest of this stage: PostgreSQL refuses to USE an
-- enum value added in the same transaction
-- ("ERROR: unsafe use of new value PENDING ... must be committed before they
-- can be used"), and the companion migration sets rooms.status's default to
-- PENDING. Verified against this database with a rehearsal that rolled back.
--
-- Two values are still fine in one transaction here (PG 16); only the later
-- *use* of PENDING has to wait for this migration to commit.

ALTER TYPE "ListingStatus" ADD VALUE 'PENDING';
ALTER TYPE "ListingStatus" ADD VALUE 'REJECTED';
