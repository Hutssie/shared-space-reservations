-- AlterTable
ALTER TABLE "User" ADD COLUMN "stripe_customer_id" TEXT;

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "service_fee_cents" INTEGER;

-- CreateTable
CREATE TABLE "payment" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "space_id" TEXT NOT NULL,
    "booking_id" TEXT,
    "stripe_payment_intent_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "capture_method" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_stripe_customer_id_key" ON "User"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_booking_id_key" ON "payment"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_stripe_payment_intent_id_key" ON "payment"("stripe_payment_intent_id");

-- CreateIndex
CREATE INDEX "payment_user_id_idx" ON "payment"("user_id");

-- CreateIndex
CREATE INDEX "payment_space_id_idx" ON "payment"("space_id");

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
