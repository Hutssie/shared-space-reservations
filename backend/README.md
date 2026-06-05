# Shared Space Reservations API

Node.js + Express + Prisma + PostgreSQL.

## Setup

1. Copy `.env.example` to `.env` and set:
  - `DATABASE_URL` — PostgreSQL connection string (e.g. `postgresql://user:password@localhost:5432/space_reservations`)
  - `JWT_SECRET` — secret for signing JWTs
  - `PORT` — default 3000
  - `CORS_ORIGIN` — default `http://localhost:5173`
2. Install and init DB:
  ```bash
   npm install
   npm run db:generate
   npm run db:deploy
   npm run db:seed
  ```
   **Upgrading an existing database** (created earlier with `db push`, no migration history):
   Confirm the exclusion constraint with `npm run db:verify-exclusion`.
   For local schema experiments only, `npm run db:push` remains available; prefer `npm run db:migrate` for changes that should be committed.
3. Run:
  ```bash
   npm run dev
  ```

API base: `http://localhost:3000`. Frontend should set `VITE_API_URL=http://localhost:3000`.

## Documentation

- [Booking concurrency](docs/CONCURRENCY.md)
- [Database design and scalability roadmap](docs/DATABASE_SCALABILITY.md)
- [Scalability verification (Phase 5)](docs/SCALABILITY_VERIFICATION.md)

After pulling amenity migrations: `npm run db:deploy` then `npm run db:backfill-amenities`.

After pulling search-index migration: `npm run db:deploy`. Optional: `npm run db:explain-search`.

After pulling availability-rules migration: `npm run db:deploy` then `npm run db:backfill-availability-rules`. Optional: `npm run db:verify-availability-rules`.

After pulling drop-json migration (`20250606130000`): `npm run db:deploy` then `npm run db:verify-scalability` and `npm test`.

**Verification:** `npm run db:verify-scalability` · `npm test` · optional `npm run db:explain-scalability -- --save`

**Date availability (`GET /api/spaces?date=YYYY-MM-DD`):** candidates are scanned in batches of 100 (up to 2000 rows) with bookings loaded per batch; only the result page is fully hydrated. If more matching spaces exist beyond the scan cap, the response may include `availabilityScanCapped: true`. See [DATABASE_SCALABILITY.md](docs/DATABASE_SCALABILITY.md) Phase 3.

## Seed users

- **Host**: `host@example.com` / `password123`
- **Guest**: `guest@example.com` / `password123`

