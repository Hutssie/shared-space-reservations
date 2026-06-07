-- AlterTable
ALTER TABLE "Space" ADD COLUMN "location_norm" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "Space_status_location_norm_idx" ON "Space"("status", "location_norm");
