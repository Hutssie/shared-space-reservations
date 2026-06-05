/**
 * EXPLAIN (ANALYZE, BUFFERS) for thesis / Phase 5 verification.
 * Usage: node prisma/explain-scalability-suite.js [--save]
 */
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const save = process.argv.includes('--save');
const lines = [];

function log(line = '') {
  console.log(line);
  lines.push(line);
}

async function explain(label, query) {
  const rows = await query;
  log(`\n=== ${label} ===`);
  for (const row of rows) {
    const line = row['QUERY PLAN'] ?? Object.values(row)[0];
    log(line);
  }
}

async function main() {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const dateStr = tomorrow.toISOString().slice(0, 10);
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = dayNames[tomorrow.getUTCDay()];

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
    'Amenity AND (wifi + ac) via junction',
    prisma.$queryRaw`
      EXPLAIN (ANALYZE, BUFFERS)
      SELECT s.id FROM "Space" s
      WHERE s.status = ${'active'}
        AND EXISTS (SELECT 1 FROM space_amenity sa WHERE sa.space_id = s.id AND sa.amenity_id = ${'wifi'})
        AND EXISTS (SELECT 1 FROM space_amenity sa WHERE sa.space_id = s.id AND sa.amenity_id = ${'ac'})
      LIMIT 50
    `
  );

  await explain(
    'Date pre-filter: banned weekday + blocked range',
    prisma.$queryRaw`
      EXPLAIN (ANALYZE, BUFFERS)
      SELECT s.id FROM "Space" s
      WHERE s.status = ${'active'}
        AND (s.weekly_schedule_enabled = false OR NOT EXISTS (
          SELECT 1 FROM space_banned_day b
          WHERE b.space_id = s.id AND b.day_of_week = ${dayName}
        ))
        AND NOT EXISTS (
          SELECT 1 FROM space_blocked_date d
          WHERE d.space_id = s.id
            AND d.start_date <= ${dateStr}::date
            AND d.end_date >= ${dateStr}::date
        )
      LIMIT 50
    `
  );

  await explain(
    'Combined: active + wifi amenity + date SQL clauses',
    prisma.$queryRaw`
      EXPLAIN (ANALYZE, BUFFERS)
      SELECT s.id FROM "Space" s
      WHERE s.status = ${'active'}
        AND EXISTS (SELECT 1 FROM space_amenity sa WHERE sa.space_id = s.id AND sa.amenity_id = ${'wifi'})
        AND (s.weekly_schedule_enabled = false OR NOT EXISTS (
          SELECT 1 FROM space_banned_day b
          WHERE b.space_id = s.id AND b.day_of_week = ${dayName}
        ))
        AND NOT EXISTS (
          SELECT 1 FROM space_blocked_date d
          WHERE d.space_id = s.id
            AND d.start_date <= ${dateStr}::date
            AND d.end_date >= ${dateStr}::date
        )
      LIMIT 50
    `
  );

  if (save) {
    const outDir = path.join(__dirname, '..', 'docs', 'appendix');
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, 'explain-scalability.txt');
    fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
    log(`\nSaved to ${outPath}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
