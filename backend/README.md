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

## Seed users

- **Host**: `host@example.com` / `password123`
- **Guest**: `guest@example.com` / `password123`

