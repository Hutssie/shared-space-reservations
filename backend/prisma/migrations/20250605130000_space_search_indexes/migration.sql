-- Composite indexes aligned with buildSpaceWhereClause + default listing sort (status = active).

CREATE INDEX "Space_status_category_idx" ON "Space"("status", "category");

CREATE INDEX "Space_status_price_per_hour_idx" ON "Space"("status", "price_per_hour");

CREATE INDEX "Space_status_capacity_idx" ON "Space"("status", "capacity");

CREATE INDEX "Space_status_square_meters_idx" ON "Space"("status", "square_meters");

CREATE INDEX "Space_status_created_at_idx" ON "Space"("status", "created_at" DESC);

-- Replaced by status+category for typical search; host/category-only paths are rare.
DROP INDEX IF EXISTS "Space_category_idx";
