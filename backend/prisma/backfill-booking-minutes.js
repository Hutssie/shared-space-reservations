import { PrismaClient } from '@prisma/client';
import { resolveBookingMinutes, rangesOverlap } from '../src/lib/bookingTime.js';

const prisma = new PrismaClient();

async function main() {
  const bookings = await prisma.$queryRaw`
    SELECT id, space_id AS "spaceId", date, start_time AS "startTime", end_time AS "endTime", status,
           start_minutes AS "startMinutes", end_minutes AS "endMinutes"
    FROM "Booking"
    WHERE start_minutes IS NULL OR end_minutes IS NULL
  `;

  for (const b of bookings) {
    const resolved = resolveBookingMinutes(b.startTime, b.endTime);
    if (resolved.error) {
      console.error(`Booking ${b.id}: ${resolved.error} (${b.startTime} - ${b.endTime})`);
      process.exit(1);
    }
    await prisma.$executeRaw`
      UPDATE "Booking"
      SET start_minutes = ${resolved.startMinutes}, end_minutes = ${resolved.endMinutes}
      WHERE id = ${b.id}
    `;
  }

  if (bookings.length > 0) {
    console.log(`Backfilled start_minutes/end_minutes on ${bookings.length} booking(s).`);
  } else {
    console.log('All bookings already have start_minutes/end_minutes.');
  }

  const confirmed = await prisma.$queryRaw`
    SELECT id, space_id AS "spaceId", date, start_minutes AS "startMinutes", end_minutes AS "endMinutes"
    FROM "Booking"
    WHERE status = 'confirmed'
  `;

  const byDay = new Map();
  for (const b of confirmed) {
    const date = b.date instanceof Date ? b.date : new Date(b.date);
    const key = `${b.spaceId}:${date.toISOString().slice(0, 10)}`;
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push({
      id: b.id,
      startMinutes: Number(b.startMinutes),
      endMinutes: Number(b.endMinutes),
    });
  }

  const conflicts = [];
  for (const [, group] of byDay) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        if (rangesOverlap(a.startMinutes, a.endMinutes, b.startMinutes, b.endMinutes)) {
          conflicts.push([a.id, b.id]);
        }
      }
    }
  }

  if (conflicts.length > 0) {
    console.error('Overlapping confirmed bookings found (cancel or adjust before running exclusion migration):');
    for (const [idA, idB] of conflicts) {
      console.error(`  - ${idA} overlaps ${idB}`);
    }
    process.exit(1);
  }

  console.log('No overlapping confirmed bookings; safe to apply booking_exclusion_constraint migration.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
