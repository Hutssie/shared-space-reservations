-- AlterTable
ALTER TABLE "User" ADD COLUMN "stripe_connect_account_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_stripe_connect_account_id_key" ON "User"("stripe_connect_account_id");
