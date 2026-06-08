ALTER TABLE "User" ADD COLUMN "password_changed_at" TIMESTAMP(3);

UPDATE "User" SET "password_changed_at" = "created_at" WHERE "password_changed_at" IS NULL;
