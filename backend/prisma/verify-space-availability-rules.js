import { PrismaClient } from '@prisma/client';
import pg from 'pg';
import { dateToYmd } from '../src/lib/spaceAvailabilityRules.js';

const prisma = new PrismaClient();

async function main() {
  const spaces = await prisma.space.findMany({
    include: {
      bannedDays: { select: { dayOfWeek: true } },
      blockedDates: { select: { id: true, startDate: true, endDate: true } },
    },
  });

  let issues = 0;
  for (const space of spaces) {
    if (space.weeklyScheduleEnabled && space.bannedDays.length === 0) {
      // enabled schedule with no banned days is valid (all days open)
    }
    if (!space.weeklyScheduleEnabled && space.bannedDays.length > 0) {
      console.error(`Space ${space.id}: banned day rows but weeklyScheduleEnabled=false`);
      issues += 1;
    }
    for (const row of space.blockedDates) {
      const start = dateToYmd(row.startDate);
      const end = dateToYmd(row.endDate);
      if (!start || !end || start > end) {
        console.error(`Space ${space.id}: invalid blocked range ${row.id}`);
        issues += 1;
      }
    }
  }

  if (issues > 0) {
    console.error(`FAIL: ${issues} issue(s) across ${spaces.length} space(s).`);
    process.exit(1);
  }

  console.log(`PASS: ${spaces.length} space(s) — relational availability rules consistent.`);

  const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (dbUrl) {
    const client = new pg.Client({ connectionString: dbUrl });
    await client.connect();
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const dateStr = dateToYmd(tomorrow);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[tomorrow.getUTCDay()];

    const explain = await client.query(
      `EXPLAIN ANALYZE
       SELECT s.id FROM "Space" s
       WHERE s.status = 'active'
         AND (s.weekly_schedule_enabled = false OR NOT EXISTS (
           SELECT 1 FROM space_banned_day b
           WHERE b.space_id = s.id AND b.day_of_week = $2
         ))
         AND NOT EXISTS (
           SELECT 1 FROM space_blocked_date d
           WHERE d.space_id = s.id
             AND d.start_date <= $1::date
             AND d.end_date >= $1::date
         )
       LIMIT 50`,
      [dateStr, dayName]
    );
    console.log('\nSample EXPLAIN (date + banned/blocked SQL pre-filter):');
    for (const row of explain.rows) console.log(row['QUERY PLAN']);
    await client.end();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
