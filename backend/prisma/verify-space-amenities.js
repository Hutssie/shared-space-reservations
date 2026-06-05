import { PrismaClient } from '@prisma/client';
import { amenitiesForResponse, isKnownAmenityId } from '../src/lib/amenities.js';

const prisma = new PrismaClient();

function setsEqual(a, b) {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  for (const x of b) if (!sa.has(x)) return false;
  return true;
}

async function main() {
  const spaces = await prisma.space.findMany({
    include: { amenities: { select: { amenityId: true }, orderBy: { amenityId: 'asc' } } },
  });

  let mismatches = 0;
  let emptyAmenities = 0;
  let unknownIds = 0;

  for (const space of spaces) {
    const rowIds = space.amenities.map((a) => a.amenityId).sort();
    const responseIds = [...amenitiesForResponse(space)].sort();

    if (!setsEqual(rowIds, responseIds)) {
      console.error(`Space ${space.id}: amenity mismatch rows=[${rowIds}] response=[${responseIds}]`);
      mismatches += 1;
    }

    for (const id of rowIds) {
      if (!isKnownAmenityId(id)) {
        console.error(`Space ${space.id}: unknown amenity id "${id}"`);
        unknownIds += 1;
      }
    }

    if (rowIds.length === 0 && space.status === 'active') {
      emptyAmenities += 1;
    }
  }

  if (mismatches > 0 || unknownIds > 0) {
    console.error(
      `FAIL: ${mismatches} mismatch(es), ${unknownIds} unknown id(s) across ${spaces.length} space(s).`
    );
    process.exit(1);
  }

  console.log(
    `PASS: ${spaces.length} space(s) — amenity relations consistent (${emptyAmenities} active with zero amenities, informational).`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
