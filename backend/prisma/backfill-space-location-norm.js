import { PrismaClient } from '@prisma/client';
import { locationNormFromDisplay } from '../src/lib/textNormalize.js';

const prisma = new PrismaClient();

async function main() {
  const spaces = await prisma.space.findMany({
    select: { id: true, location: true, locationNorm: true },
  });

  let updated = 0;
  for (const space of spaces) {
    const norm = locationNormFromDisplay(space.location);
    if (space.locationNorm === norm) continue;
    await prisma.space.update({
      where: { id: space.id },
      data: { locationNorm: norm },
    });
    updated += 1;
  }

  console.log(`Backfilled location_norm for ${updated} of ${spaces.length} space(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
