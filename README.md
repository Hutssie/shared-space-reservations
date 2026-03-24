# Shared Space Reservations – Web Application

University project: **Web Application for Intelligent Management of Shared Space Reservations**.

- **Frontend**: React (Vite) in `frontend/` – design done in Figma.
- **Backend**: Node.js + Express + Prisma + PostgreSQL in `backend/`.

## Running the project from GitHub

To run this project locally:

1. **Prerequisites**: Install [Node.js](https://nodejs.org/) (LTS) and [PostgreSQL](https://www.postgresql.org/download/).

2. **Clone the repo**:
   git clone https://github.com/Hutssie/shared-space-reservations.git

3. **Backend**:
   Either create your own database and env values OR direct transfer everything:
   
      Direct transfer everything path:(commands are powershell)
         - Create local DB `& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h localhost -p 5432 -U postgres -c "CREATE DATABASE space_reservations;"`
         - Restore the DB: directly transfer the .dump file and run:
            - $env:PGPASSWORD = '<local_db_password>'
& "C:\Program Files\PostgreSQL\18\bin\pg_restore.exe" --no-owner --no-privileges -h localhost -p 5432 -U postgres -d space_reservations "[PATH to space_reservations.dump]"
Remove-Item Env:PGPASSWORD
         - Directly transfer .env files

      Create your own from 0 path:
         - Create a PostgreSQL database (e.g. `space_reservations`)
         - In `backend/`: copy `.env.example` to `.env`, set `DATABASE_URL` (e.g. `postgresql://postgres:password@localhost:5432/space_reservations`), `JWT_SECRET` (any string), and `CORS_ORIGIN=http://localhost:5173`.
         - Run: `npm install` → `npx prisma generate` → `npx prisma db push` → `npx prisma db seed` → `npm run dev`
         - API will be at `http://localhost:3000`.
         - In `frontend/`: copy `.env.example` to `.env` with `VITE_API_URL=http://localhost:3000` and `VITE_GOOGLE_MAPS_API_KEY`, then run `npm install` and `npm run dev`. App at `http://localhost:5173`. 

---

## Quick start

### 1. Backend (API + database)

1. Install PostgreSQL and create a database (e.g. `space_reservations`).
2. In `backend/`:
   - Copy `.env.example` to `.env`.
   - Set `DATABASE_URL` (e.g. `postgresql://user:password@localhost:5432/space_reservations`), `JWT_SECRET`, and optionally `PORT` and `CORS_ORIGIN`.
   - Run:
     ```bash
     npm install
     npx prisma generate
     npx prisma db push
     npx prisma db seed
     npm run dev
     ```
   - API runs at `http://localhost:3000`.


### 2. Frontend

1. In `frontend/`:
   - Copy `.env.example` to `.env` and set `VITE_API_URL=http://localhost:3000` (if different).
   - Run:
     ```bash
     npm install
     npm run dev
     ```
   - App runs at `http://localhost:5173`.


## Project layout

- `backend/` – Express app, Prisma schema, auth (JWT), routes: auth, users, spaces, bookings, reviews, favorites, host.
- `frontend/` – React app, Tailwind + Radix UI, API client and auth context, pages wired to the backend.

---
