-- CreateTable
CREATE TABLE "Amenity" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "Amenity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "space_amenity" (
    "space_id" TEXT NOT NULL,
    "amenity_id" TEXT NOT NULL,

    CONSTRAINT "space_amenity_pkey" PRIMARY KEY ("space_id","amenity_id")
);

-- CreateIndex
CREATE INDEX "space_amenity_amenity_id_idx" ON "space_amenity"("amenity_id");

-- AddForeignKey
ALTER TABLE "space_amenity" ADD CONSTRAINT "space_amenity_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "space_amenity" ADD CONSTRAINT "space_amenity_amenity_id_fkey" FOREIGN KEY ("amenity_id") REFERENCES "Amenity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
