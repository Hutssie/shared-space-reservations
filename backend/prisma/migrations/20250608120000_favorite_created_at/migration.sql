-- AlterTable
ALTER TABLE "Favorite" ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Favorite_user_id_created_at_idx" ON "Favorite"("user_id", "created_at");
