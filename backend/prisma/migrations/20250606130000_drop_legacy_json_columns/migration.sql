-- Drop legacy JSON columns (data lives in space_amenity, space_banned_day, space_blocked_date)
ALTER TABLE "Space" DROP COLUMN IF EXISTS "amenities_json";
ALTER TABLE "Space" DROP COLUMN IF EXISTS "banned_days_json";
ALTER TABLE "Space" DROP COLUMN IF EXISTS "blocked_dates_json";
