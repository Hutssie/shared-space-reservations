/**
 * Optional: run after indexes to capture EXPLAIN for thesis / verification.
 * Usage: node prisma/explain-space-search.js
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function explain(label, query) {
  const rows = await query;
  console.log(`\n=== ${label} ===`);
  for (const row of rows) {
    const line = row['QUERY PLAN'] ?? Object.values(row)[0];
    console.log(line);
  }
}

async function main() {
  await explain(
    'Active by category (Photo Studio)',
    prisma.$queryRaw`
      EXPLAIN (ANALYZE, BUFFERS)
      SELECT id FROM "Space" WHERE status = ${'active'} AND category = ${'Photo Studio'} LIMIT 50
    `
  );

  await explain(
    'Active, price range, newest first',
    prisma.$queryRaw`
      EXPLAIN (ANALYZE, BUFFERS)
      SELECT id FROM "Space"
      WHERE status = ${'active'} AND price_per_hour >= ${50} AND price_per_hour <= ${200}
      ORDER BY created_at DESC LIMIT 50
    `
  );

  await explain(
    'Active with min capacity',
    prisma.$queryRaw`
      EXPLAIN (ANALYZE, BUFFERS)
      SELECT id FROM "Space" WHERE status = ${'active'} AND capacity >= ${10}
      ORDER BY created_at DESC LIMIT 50
    `
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
