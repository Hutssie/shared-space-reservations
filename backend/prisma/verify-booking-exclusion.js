/**
 * Verifies bookings_no_confirmed_overlap: two concurrent confirmed inserts for the same slot
 * should yield exactly one success and one exclusion failure.
 */
import { PrismaClient } from '@prisma/client';
import { resolveBookingMinutes } from '../src/lib/bookingTime.js';

const prisma = new PrismaClient();

async function insertConfirmed({ userId, spaceId, date, startTime, endTime }) {
  const { startMinutes, endMinutes } = resolveBookingMinutes(startTime, endTime);
  const id = `verify_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  await prisma.$executeRaw`
    INSERT INTO "Booking" (
      id, user_id, space_id, date, start_time, end_time, start_minutes, end_minutes,
      status, total_price, created_at
    ) VALUES (
      ${id}, ${userId}, ${spaceId}, ${date}::date, ${startTime}, ${endTime},
      ${startMinutes}, ${endMinutes}, 'confirmed', 100, NOW()
    )
  `;
  return id;
}

async function main() {
  const spaces = await prisma.$queryRaw`
    SELECT id FROM "Space" WHERE is_instant_bookable = true AND status = 'active' LIMIT 1
  `;
  if (!spaces.length) {
    console.error('No instant-bookable active space found.');
    process.exit(1);
  }
  const spaceId = spaces[0].id;

  const users = await prisma.$queryRaw`
    SELECT id FROM "User" ORDER BY created_at ASC LIMIT 2
  `;
  if (users.length < 2) {
    console.error('Need at least two users in the database.');
    process.exit(1);
  }

  const farDate = new Date();
  farDate.setUTCFullYear(farDate.getUTCFullYear() + 2);
  const dateStr = farDate.toISOString().slice(0, 10);
  const startTime = '03:00 AM';
  const endTime = '05:00 AM';

  const results = await Promise.allSettled([
    insertConfirmed({ userId: users[0].id, spaceId, date: dateStr, startTime, endTime }),
    insertConfirmed({ userId: users[1].id, spaceId, date: dateStr, startTime, endTime }),
  ]);

  const ok = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;
  const exclusionFailures = results.filter(
    (r) => r.status === 'rejected' && String(r.reason?.message || r.reason).includes('bookings_no_confirmed_overlap')
  ).length;

  for (const r of results) {
    if (r.status === 'rejected') {
      console.log('Rejected:', r.reason?.message || r.reason);
    } else {
      console.log('Inserted:', r.value);
      await prisma.$executeRaw`DELETE FROM "Booking" WHERE id = ${r.value}`;
    }
  }

  if (ok === 1 && failed === 1 && exclusionFailures === 1) {
    console.log('PASS: exclusion constraint blocked the second confirmed booking.');
    process.exit(0);
  }

  console.error(`FAIL: expected 1 success and 1 exclusion error; got ${ok} ok, ${failed} failed (${exclusionFailures} exclusion).`);
  process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
