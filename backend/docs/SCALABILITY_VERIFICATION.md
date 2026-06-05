# Scalability verification (Phase 5)

Automated checks that Phases 1–4 behave correctly: SQL-filtered search totals, relational amenities/availability data, and booking exclusion.

## Quick run

```bash
cd backend
npm run db:deploy          # if migrations pending
npm run db:generate
npm run db:verify-scalability
npm test
```

**PASS** when every step exits 0.

## What each step checks

| Command | Verifies |
|---------|----------|
| `db:verify-amenities` | `space_amenity` rows match `amenitiesForResponse`; no unknown amenity ids |
| `db:verify-availability-rules` | `weekly_schedule_enabled` consistent with `space_banned_day`; valid blocked ranges |
| `db:verify-search-totals` | `GET /api/spaces` `total` matches Prisma / scan ground truth for amenity, category, and date filters |
| `db:verify-exclusion` | Concurrent confirmed bookings: one success, one `23P01` exclusion |
| `npm test` | Integration tests (pagination, date fixtures, response shape) |

## EXPLAIN appendix (thesis)

Capture query plans for the appendix:

```bash
npm run db:explain-scalability
npm run db:explain-scalability -- --save
```

Writes to `docs/appendix/explain-scalability.txt` with `--save`.

Legacy Phase 2 samples: `npm run db:explain-search`.

## Optional load bench

```bash
npm run db:bench-search
```

30 in-process requests to `amenities=wifi&date=tomorrow`; prints min / p50 / p95 / max. Not a CI gate.

## Upgrading from pre-drop schema

If your database still has `amenities_json`, `banned_days_json`, or `blocked_dates_json`:

1. `npm run db:backfill-amenities`
2. `npm run db:backfill-availability-rules`
3. `npm run db:verify-scalability`
4. `npm run db:deploy` (applies drop-column migration)
5. `npm run db:verify-scalability` and `npm test` again

## Committee lines

- Search `total` uses SQL `count` / bounded availability scan — cross-checked against the HTTP API.
- Legacy JSON columns removed after relational backfill and verification passed.
