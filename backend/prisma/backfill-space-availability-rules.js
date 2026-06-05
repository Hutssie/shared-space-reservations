/**
 * Pre-drop migration only: requires banned_days_json and blocked_dates_json columns.
 * Run after 20250606120000_normalize_availability_rules and before 20250606130000_drop_legacy_json_columns.
 */
import { PrismaClient } from '@prisma/client';
import {
  syncSpaceBannedDays,
  syncSpaceBlockedDates,
  parseBannedDaysFromJson,
  parseBlockedDatesFromJson,
} from '../src/lib/spaceAvailabilityRules.js';

const prisma = new PrismaClient();

async function main() {
  let spaces;
  try {
    spaces = await prisma.$queryRaw`
      SELECT id, banned_days_json, blocked_dates_json FROM "Space"
    `;
  } catch (e) {
    console.error(
      'banned_days_json / blocked_dates_json not found — backfill not needed (relational-only schema).'
    );
    process.exit(0);
  }

  let synced = 0;
  let bannedRowCount = 0;
  let blockedRowCount = 0;
  let warnings = 0;

  for (const space of spaces) {
    const banned = parseBannedDaysFromJson(space.banned_days_json);
    if (space.banned_days_json != null) {
      try {
        const arr = JSON.parse(space.banned_days_json);
        if (!Array.isArray(arr)) warnings += 1;
      } catch {
        warnings += 1;
      }
    }

    const blocks = parseBlockedDatesFromJson(space.blocked_dates_json);
    if (space.blocked_dates_json != null) {
      try {
        const arr = JSON.parse(space.blocked_dates_json);
        if (!Array.isArray(arr)) warnings += 1;
      } catch {
        warnings += 1;
      }
    }

    await prisma.$transaction(async (tx) => {
      await syncSpaceBannedDays(tx, space.id, banned.weeklyScheduleEnabled ? banned.dayNames : null);
      const blockedPayload =
        blocks.length > 0 ? blocks : space.blocked_dates_json != null ? [] : null;
      await syncSpaceBlockedDates(tx, space.id, blockedPayload, { forBackfill: true });
    });

    bannedRowCount += banned.dayNames.length;
    blockedRowCount += blocks.length;
    synced += 1;
  }

  console.log(
    `Availability rules backfill: ${synced} space(s), ${bannedRowCount} banned-day row(s), ${blockedRowCount} blocked-date row(s), ${warnings} parse warning(s).`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
