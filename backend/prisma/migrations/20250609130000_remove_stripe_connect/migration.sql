-- DropIndex
DROP INDEX IF EXISTS "User_stripe_connect_account_id_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN IF EXISTS "stripe_connect_account_id";
