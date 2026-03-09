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
   npx prisma generate
   npx prisma db push
   npx prisma db seed
   ```

3. Run:
   ```bash
   npm run dev
   ```

API base: `http://localhost:3000`. Frontend should set `VITE_API_URL=http://localhost:3000`.

## Seed users

- **Host**: `host@example.com` / `password123`
- **Guest**: `guest@example.com` / `password123`
