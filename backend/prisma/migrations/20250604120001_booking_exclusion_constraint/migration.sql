-- Run prisma/backfill-booking-minutes.js before applying this migration on existing databases.

ALTER TABLE "Booking" ALTER COLUMN "start_minutes" SET NOT NULL;
ALTER TABLE "Booking" ALTER COLUMN "end_minutes" SET NOT NULL;

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Booking"
  ADD CONSTRAINT bookings_no_confirmed_overlap
  EXCLUDE USING gist (
    space_id WITH =,
    date WITH =,
    int4range(start_minutes, end_minutes, '[)') WITH &&
  )
  WHERE (status = 'confirmed');
