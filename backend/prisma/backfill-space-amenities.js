/**
 * Pre-drop migration only: requires Space.amenities_json column.
 * Run after 20250605120000_normalize_amenities and before 20250606130000_drop_legacy_json_columns.
 */
import { PrismaClient } from '@prisma/client';
import { seedAmenityCatalog, syncSpaceAmenities } from '../src/lib/amenities.js';

const prisma = new PrismaClient();

async function main() {
  await seedAmenityCatalog(prisma);

  let spaces;
  try {
    spaces = await prisma.$queryRaw`
      SELECT id, amenities_json FROM "Space"
    `;
  } catch (e) {
    console.error(
      'amenities_json column not found — backfill not needed (already on relational-only schema).'
    );
    process.exit(0);
  }

  let synced = 0;
  for (const space of spaces) {
    let raw = [];
    const json = space.amenities_json;
    if (json) {
      try {
        const parsed = JSON.parse(json);
        if (Array.isArray(parsed)) raw = parsed;
      } catch {
        console.warn(`Space ${space.id}: invalid amenities_json, skipping entries`);
      }
    }
    await syncSpaceAmenities(prisma, space.id, raw);
    synced += 1;
  }

  console.log(`Amenity catalog seeded; synced ${synced} space(s) to space_amenity.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
