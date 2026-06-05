-- AlterTable
ALTER TABLE "Space" ADD COLUMN "weekly_schedule_enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "space_banned_day" (
    "space_id" TEXT NOT NULL,
    "day_of_week" TEXT NOT NULL,

    CONSTRAINT "space_banned_day_pkey" PRIMARY KEY ("space_id","day_of_week")
);

-- CreateTable
CREATE TABLE "space_blocked_date" (
    "id" TEXT NOT NULL,
    "space_id" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "space_blocked_date_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "space_blocked_date_space_id_start_date_idx" ON "space_blocked_date"("space_id", "start_date");

-- AddForeignKey
ALTER TABLE "space_banned_day" ADD CONSTRAINT "space_banned_day_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "space_blocked_date" ADD CONSTRAINT "space_blocked_date_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;
