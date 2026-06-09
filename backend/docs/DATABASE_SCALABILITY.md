# Database design and search scalability

How listing search, filters, and availability scale in PostgreSQL — without loading hundreds of rows into Node for every request.

## Design principles

1. **Normalize data you filter on** — amenities, banned weekdays, and blocked date ranges live in relational tables, not JSON blobs.
2. **Filter in SQL** — PostgreSQL reduces the candidate set; the API paginates with `LIMIT` / `OFFSET` on that set.
3. **Index access paths** — composite indexes match real `WHERE` clauses (`status`, `category`, price, capacity, junction lookups).
4. **Bounded scans** — date availability walks candidates in batches with a hard cap; full joins run only for the result page.

---

## Overview

| Concern | How it works today |
|---------|-------------------|
| Amenity AND-filter | `space_amenity` junction + SQL aggregation |
| Category, price, capacity, size | Composite indexes on `Space` |
| Location text | `location_norm` column + segment-exact or prefix matching |
| Date + availability | Batched scan + per-batch bookings; shared by browse and AI search |
| Host blocked/banned rules | `space_banned_day` + `space_blocked_date`; SQL pre-filter before slot checks |
| Legacy JSON columns | Dropped after relational backfill (`amenities_json`, `banned_days_json`, `blocked_dates_json`) |

---

## Amenities

**Goal:** Require **all** selected amenities (AND semantics) in the database with a correct `total` count.

**Schema:** `Amenity` catalog + `SpaceAmenity` many-to-many junction (indexed on `amenity_id` and `space_id`).

**Query pattern** — for ids `[wifi, parking]` require both:

```sql
SELECT space_id
FROM space_amenity
WHERE amenity_id IN ('wifi', 'parking')
GROUP BY space_id
HAVING COUNT(DISTINCT amenity_id) = 2
```

**API:** `spaceToResponse` reads amenity ids from the junction. Create/update syncs `SpaceAmenity` in a transaction. AI search reuses the same SQL helper instead of in-memory filtering.

**Backfill / verify:** `npm run db:backfill-amenities`, `npm run db:verify-amenities`

**Committee line:** “Amenities are modeled as a many-to-many relationship with indexed junction table; search uses SQL aggregation instead of loading hundreds of rows into the application tier.”

---

## Search indexes and location matching

**Composite indexes** on `Space` (migration `20250605130000_space_search_indexes`):

| Index | Supports |
|-------|----------|
| `(status, category)` | Active listings by category |
| `(status, price_per_hour)` | Price range on active spaces |
| `(status, capacity)` | Min capacity |
| `(status, square_meters)` | Min/max size filters |
| `(status, created_at DESC)` | Default sort |

**Verify plans:** `npm run db:explain-search`

**Location normalization:** `Space.location_norm` stores a folded lowercase copy of `location` for accent-insensitive search (Romanian diacritics and general Latin accents). Index `(status, location_norm)`. Commands: `npm run db:backfill-location-norm`, `npm run db:verify-location-norm`.

**Segment matching:** Structured location filters use segment-exact predicates (`buildLocationNormExactFilter` in [`textNormalize.js`](../src/lib/textNormalize.js)) — whole comma-separated parts only, so `roma` does not false-match `Craiova, Romania`. Autocomplete uses prefix mode; free-text `q` search keeps substring `contains` for discovery. Same helpers are used in AI search, browse, and geo text fallback.

**Bookings index:** `@@index([spaceId, date])` supports date-filter booking fetches scoped to paginated candidate ids only.

---

## Date availability search

Hourly slots, banned weekdays, blocked ranges, and existing bookings are evaluated in application code — but **how candidates are scanned** keeps memory and query cost bounded.

**Implementation:** [`spaceAvailabilitySearch.js`](../src/lib/spaceAvailabilitySearch.js)

| Aspect | Behavior |
|--------|----------|
| Batch size | **100** candidates per batch (`DATE_FILTER_BATCH_SIZE`) |
| Scan cap | **2000** candidates max (`MAX_SCAN_DATE_FILTER`) |
| Bookings | Loaded **per batch**, not for the entire pool at once |
| Hydration | Lightweight `select` during scan; full host/review/amenity join only for the **result page** |

**Browse API:** `GET /api/spaces?date=…` uses `searchSpacesWithDateAvailability`. Response may include `availabilityScanCapped: true` if the scan hit the cap before exhausting all SQL-filtered rows.

**AI search:** Same helper with `targetAvailable: 6` and `maxScan: 400` (stops early once six available spaces are found).

---

## Blocked dates and banned days

**Tables:**

- `space_banned_day` — `(space_id, day_of_week)` primary key
- `space_blocked_date` — `id`, `space_id`, `start_date`, `end_date`, index `(space_id, start_date)`

**Behavior:** Host PATCH still accepts `bannedDaysJson` / `blockedDatesJson` in the request body; the API syncs relational rows only. `weekly_schedule_enabled` on `Space` disambiguates “no weekly schedule” vs “explicit empty schedule”. Date search applies SQL pre-filter via `dateAvailabilitySqlWhere` before slot overlap checks.

**Backfill / verify:** `npm run db:backfill-availability-rules`, `npm run db:verify-availability-rules`

**Still JSON (by design):** `imagesJson`, `notifications.dataJson`

---

## Verification and legacy cleanup

Automated checks confirm SQL-filtered totals, relational data integrity, and booking exclusion constraints. See [SCALABILITY_VERIFICATION.md](./SCALABILITY_VERIFICATION.md).

| Check | Command |
|-------|---------|
| Full suite | `npm run db:verify-scalability` |
| Integration tests | `npm test` |
| EXPLAIN appendix | `npm run db:explain-scalability -- --save` |
| Optional bench | `npm run db:bench-search` |

---

## Operational commands

```bash
npm run db:migrate          # create/apply new migration
npm run db:deploy           # apply committed migrations
npm run db:backfill-...     # per-topic backfill scripts
npm run db:generate
```

---

## Related docs

- [CONCURRENCY.md](./CONCURRENCY.md) — booking correctness
- [SCALABILITY_VERIFICATION.md](./SCALABILITY_VERIFICATION.md) — verification runbook
- [AI_RAG.md](./AI_RAG.md) — AI search semantic embeddings (`Space.embedding`, pgvector HNSW)
