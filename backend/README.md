# Shared Space Reservations API

Node.js + Express + Prisma + PostgreSQL.

## Setup

1. Copy `.env.example` to `.env` and set:
  - `DATABASE_URL` — PostgreSQL connection string (e.g. `postgresql://user:password@localhost:5432/space_reservations`)
  - `JWT_SECRET` — secret for signing JWTs
  - `GEMINI_API_KEY` — required for AI search and semantic embeddings ([Google AI Studio](https://aistudio.google.com/))
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — required for checkout (see [docs/BILLING.md](docs/BILLING.md))
  - `PORT` — default 3000
  - `CORS_ORIGIN` — default `http://localhost:5173`
2. Install and init DB:
  ```bash
   npm install
   npm run db:generate
   ```
   **Fresh empty database** (no tables yet, or a failed first `db:deploy`):
   ```bash
   npm run db:bootstrap          # creates schema via db push + baselines migrations
   npm run db:seed
   npm run db:backfill-embeddings   # requires GEMINI_API_KEY; semantic AI search
   ```
   If bootstrap reports existing tables from a partial run, reset and retry:
   ```bash
   npm run db:bootstrap -- --force
   ```
   **Existing database upgraded from an earlier `db push` baseline:**
   ```bash
   npm run db:deploy
   npm run db:seed
   npm run db:backfill-embeddings
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

- [Hybrid recommendations](docs/RECOMMENDATIONS.md)
- [AI search RAG + semantic retrieval](docs/AI_RAG.md)
- [Billing (Stripe)](docs/BILLING.md)
- [Booking concurrency](docs/CONCURRENCY.md)
- [Database design and search scalability](docs/DATABASE_SCALABILITY.md)
- [Scalability verification](docs/SCALABILITY_VERIFICATION.md)

After pulling email verification migration (`20250609140000`): `npm run db:deploy`.

After pulling amenity migrations: `npm run db:deploy` then `npm run db:backfill-amenities`.

After pulling search-index migration: `npm run db:deploy`. Optional: `npm run db:explain-search`.

After pulling availability-rules migration: `npm run db:deploy` then `npm run db:backfill-availability-rules`. Optional: `npm run db:verify-availability-rules`.

After pulling drop-json migration (`20250606130000`): `npm run db:deploy` then `npm run db:verify-scalability` and `npm test`.

After pulling the space-embedding migration (`20250609160000`): `npm run db:deploy` then `npm run db:backfill-embeddings` (requires `GEMINI_API_KEY`; missing-only by default, pass `-- --all` to re-embed every active space). Powers AI-search semantic retrieval — see [docs/AI_RAG.md](docs/AI_RAG.md).

**Verification:** `npm run db:verify-scalability` · `npm test` · optional `npm run db:explain-scalability -- --save`

**Date availability (`GET /api/spaces?date=YYYY-MM-DD`):** candidates are scanned in batches of 100 (up to 2000 rows) with bookings loaded per batch; only the result page is fully hydrated. If more matching spaces exist beyond the scan cap, the response may include `availabilityScanCapped: true`. See [DATABASE_SCALABILITY.md](docs/DATABASE_SCALABILITY.md#date-availability-search).

## Seed users

- **Host**: `host@example.com` / `Password123`
- **Guest**: `guest@example.com` / `Password123`
- **Admin**: `admin@example.com` / `Password123`

