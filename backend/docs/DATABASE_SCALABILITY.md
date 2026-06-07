# Database design and search scalability

Roadmap for addressing professor feedback: JSON amenity blobs, in-memory filtering (`take: 500` / `1000` in `spaces.js`), and missing indexes.

Principles:

1. **Normalize data you filter on** — store amenities (and later blocked dates) in relational tables, not JSON.
2. **Filter in SQL** — let PostgreSQL reduce rows; paginate with `LIMIT` / `OFFSET` (or keyset) on the filtered set.
3. **Index access paths** — composite indexes matching real `WHERE` clauses (`status`, `category`, price, capacity, junction lookups).
4. **Migrate in order** — schema → backfill → dual-write → switch reads → switch writes → drop legacy column (never big-bang in production).

---

## Resolved pain points (Phases 1–5)

| Former issue | Resolution |
|--------------|------------|
| Amenity filter loaded **500** rows in Node | SQL `space_amenity` AND filter (Phase 1) |
| Date filter loaded **1000** rows with full joins | Batched scan + per-batch bookings (Phase 3) |
| AI search small in-memory pool | Shared `searchSpacesWithDateAvailability` (Phase 3) |
| `amenitiesJson` / banned/blocked JSON blobs | Relational tables; legacy columns dropped (Phases 1, 4, 5) |
| Missing composite indexes | `(status, …)` indexes (Phase 2) |


---

## Phase 1 — Amenities (implemented)

**Goal:** Amenity AND-filter runs in the database; correct `total` count; no 500-row pool.

**Status:** Done — `Amenity` + `space_amenity`, `npm run db:backfill-amenities`, SQL filter via `buildSpaceSearchWhere` / `amenityFilterClause`.

### 1.1 Schema

```prisma
model Amenity {
  id     String @id          // stable slug: wifi, parking, ...
  label  String
  spaces SpaceAmenity[]
}

model SpaceAmenity {
  spaceId   String @map("space_id")
  amenityId String @map("amenity_id")
  space     Space  @relation(...)
  amenity   Amenity @relation(...)
  @@id([spaceId, amenityId])
  @@index([amenityId])
  @@index([spaceId])
}
```

Seed `Amenity` from `AMENITY_ID_TO_LABELS` in [`amenities.js`](../src/lib/amenities.js) — one label per id, aligned with frontend `AmenitiesList` in `FilterDropdowns.tsx`.

### 1.2 Backfill

Script `prisma/backfill-space-amenities.js`:

- Parse each `amenitiesJson` array entry.
- Resolve to canonical `amenityId` (id, catalog label, or `AMENITY_LEGACY_LABEL_ALIASES`).
- `INSERT` into `SpaceAmenity` (idempotent).

### 1.3 Query pattern (AND semantics)

For amenity ids `[wifi, parking]` require **both**:

```sql
SELECT space_id
FROM space_amenity
WHERE amenity_id IN ('wifi', 'parking')
GROUP BY space_id
HAVING COUNT(DISTINCT amenity_id) = 2
```

In Prisma: `where: { amenities: { every: { amenityId: { in: ids } } } } }` only works for simple cases; for exact AND on a set, prefer `every` with multiple conditions or raw/subquery helper `spaceIdsMatchingAllAmenities(prisma, ids)`.

Apply as `where: { id: { in: matchingIds }, ...buildSpaceWhereClause }` then `findMany` with proper `take` / `skip` and `count`.

### 1.4 API changes

- `spaceToResponse`: `amenities` from `space.amenities.map(a => a.amenityId)` (include relation).
- `POST` / `PATCH` space: sync `SpaceAmenity` rows from payload (transaction); optionally keep writing `amenitiesJson` during transition.
- Remove amenity branch that uses `takePool = 500` and `.filter()`.

### 1.5 AI search

Reuse `spaceIdsMatchingAllAmenities` in `ai-search.js` instead of in-memory filter.

### 1.6 Deprecation (done in Phase 5)

- Dual-write stopped; `amenities_json` column dropped.

**Committee line:** “Amenities are modeled as a many-to-many relationship with indexed junction table; search uses SQL aggregation instead of loading hundreds of rows into the application tier.”

---

## Phase 2 — Search indexes on `Space` (implemented)

**Goal:** Faster filters already expressed in `buildSpaceWhereClause`.

**Status:** Migration `20250605130000_space_search_indexes` adds:


| Index                       | Supports                               |
| --------------------------- | -------------------------------------- |
| `(status, category)`        | Active listings by category            |
| `(status, price_per_hour)`  | Price range on active spaces           |
| `(status, capacity)`        | Min capacity                           |
| `(status, square_meters)`   | Min/max size filters                   |
| `(status, created_at DESC)` | Default sort `orderBy: createdAt desc` |


Dropped legacy single-column `category` index (superseded by `(status, category)` for search).

**Verify:** `npm run db:explain-search` (prints `EXPLAIN ANALYZE` for sample queries).

Optional (not implemented): `pg_trgm` GIN on `location` / `title` for `ILIKE '%…%'` — text search remains sequential scan by design until needed.

**Location diacritics (Phase D4):** `Space.location_norm` stores a folded lowercase copy of `location` for accent-insensitive search (Romanian `ăâîșț` and general Latin accents). Index `(status, location_norm)`. Chosen over PostgreSQL `unaccent()` for Prisma-native queries. Commands: `npm run db:backfill-location-norm`, `npm run db:verify-location-norm`.

**Location segment matching (Phase D4.1):** Structured location filters use segment-exact Prisma predicates (`buildLocationNormExactFilter` in [`textNormalize.js`](../src/lib/textNormalize.js)) — whole comma-separated parts only, preventing substring false positives (`roma`/`rome` vs `…, romania`). Autocomplete uses prefix mode (`buildLocationNormPrefixFilter`); free-text `q` OR search keeps substring `contains`. Same helpers used in AI search, browse, and geo text fallback. Optional future: `pg_trgm` / geocoder aliases for typo tolerance and Rome/Roma spelling variants — not required for substring bugs.

**Booking** already has `@@index([spaceId, date])` — keep using it for date-filter booking fetches; restrict `spaceId: { in: ids }` to **paginated candidate ids only** (after Phase 1), not 1000 arbitrary rows.

---

## Phase 3 — Date availability (implemented)

Availability logic (hourly slots, banned weekdays, blocked JSON ranges, bookings) remains in application code, but **how** candidates are scanned changed.

**Status:** `[src/lib/spaceAvailabilitySearch.js](../src/lib/spaceAvailabilitySearch.js)`


| Before                                                    | After                                                                                           |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Single `findMany` up to **1000** rows with full `include` | Batches of **100** (`DATE_FILTER_BATCH_SIZE`), max **2000** candidates (`MAX_SCAN_DATE_FILTER`) |
| Bookings loaded for entire pool at once                   | Bookings loaded **per batch** only                                                              |
| Full host/review/amenity join during scan                 | Lightweight `select` during scan; **full hydrate** only for the result page                     |


**API:** `GET /api/spaces?date=…` uses `searchSpacesWithDateAvailability`. Optional response field `availabilityScanCapped: true` if the scan hit the cap before exhausting all SQL-filtered rows.

**AI search:** Same helper with `targetAvailable: 6` and `maxScan: 400` (stops early once six available spaces are found).

**Still JS (document honestly):** hourly slot overlap and operating-hour windows are evaluated in application code after SQL narrows candidates.

---

## Phase 4 — Blocked dates and banned days (implemented)

**Status:** [`src/lib/spaceAvailabilityRules.js`](../src/lib/spaceAvailabilityRules.js), migration `20250606120000_normalize_availability_rules`.

| Before | After |
|--------|--------|
| `bannedDaysJson` / `blockedDatesJson` parsed on every availability check | `space_banned_day` + `space_blocked_date` tables |
| Date search filtered blocked/banned in Node only | SQL pre-filter via `dateAvailabilitySqlWhere` in `searchSpacesWithDateAvailability` |
| `bannedDays: null` vs `[]` ambiguous from rows alone | `weekly_schedule_enabled` on `Space` |

**Tables:**

- `space_banned_day` — `(space_id, day_of_week)` PK
- `space_blocked_date` — `id`, `space_id`, `start_date`, `end_date`, index `(space_id, start_date)`

**API:** PATCH still accepts `bannedDaysJson` / `blockedDatesJson` request fields; sync writes relational rows only. Legacy DB columns **dropped** in Phase 5.

**Commands:** `npm run db:backfill-availability-rules`, `npm run db:verify-availability-rules`

**Still JSON (unchanged):** `imagesJson`, `notifications.dataJson`

---

## Phase 5 — Verification + legacy JSON drop (implemented)

**Status:** [SCALABILITY_VERIFICATION.md](./SCALABILITY_VERIFICATION.md)

| Deliverable | Command |
|-------------|---------|
| Unified verification | `npm run db:verify-scalability` |
| Search totals vs API | `db:verify-search-totals` (in suite) |
| Integration tests | `npm test` |
| EXPLAIN appendix | `npm run db:explain-scalability -- --save` |
| Optional bench | `npm run db:bench-search` |
| Drop `amenities_json`, `banned_days_json`, `blocked_dates_json` | Migration `20250606130000_drop_legacy_json_columns` |

---

## Suggested implementation order

```text
1. Amenity + SpaceAmenity + backfill + SQL amenity filter (removes 500 pool)
2. Composite indexes on Space
3. ~~Date filter: paginate candidates + bookings for page only~~ (done)
4. ~~blockedDates / bannedDays normalization~~ (done)
5. ~~Drop `amenities_json`, `banned_days_json`, `blocked_dates_json`~~ (done)
```

## Commands (as you add migrations)

```bash
npm run db:migrate          # new migration
npm run db:backfill-...       # per backfill script
npm run db:generate
```

## Related docs

- [CONCURRENCY.md](./CONCURRENCY.md) — booking correctness
- [SCALABILITY_VERIFICATION.md](./SCALABILITY_VERIFICATION.md) — Phase 5 verification runbook

