import { PrismaClient } from '@prisma/client';
import { locationNormFromDisplay } from '../src/lib/textNormalize.js';

const prisma = new PrismaClient();

async function main() {
  const spaces = await prisma.space.findMany({
    select: { id: true, location: true, locationNorm: true },
  });

  let mismatches = 0;
  for (const space of spaces) {
    const expected = locationNormFromDisplay(space.location);
    if (space.locationNorm !== expected) {
      console.error(
        `Space ${space.id}: location_norm="${space.locationNorm}" expected="${expected}" (location="${space.location}")`
      );
      mismatches += 1;
    }
  }

  if (mismatches > 0) {
    console.error(`FAIL: ${mismatches} location_norm mismatch(es) across ${spaces.length} space(s).`);
    process.exit(1);
  }

  console.log(`PASS: ${spaces.length} space(s) — location_norm consistent with location.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
