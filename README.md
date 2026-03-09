# Shared Space Reservations – Web Application

University project: **Web Application for Intelligent Management of Shared Space Reservations**.

- **Frontend**: React (Vite) in `mockUpFrontend/` – design from Figma Make AI.
- **Backend**: Node.js + Express + Prisma + PostgreSQL in `backend/`.

## Running the project from GitHub (for reviewers)

To run this project locally (e.g. after cloning from GitHub):

1. **Prerequisites**: Install [Node.js](https://nodejs.org/) (LTS) and [PostgreSQL](https://www.postgresql.org/download/).
2. **Clone the repo** (if you haven’t already):
   ```bash
   git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   cd YOUR_REPO_NAME
   ```
3. **Backend**:
   - Create a PostgreSQL database (e.g. `space_reservations`).
   - In `backend/`: copy `.env.example` to `.env`, set `DATABASE_URL` (e.g. `postgresql://postgres:password@localhost:5432/space_reservations`), `JWT_SECRET` (any string), and `CORS_ORIGIN=http://localhost:5173`.
   - Run: `npm install` → `npx prisma generate` → `npx prisma db push` → `npx prisma db seed` → `npm run dev`.
   - API will be at `http://localhost:3000`.
4. **Frontend**: In `mockUpFrontend/`: copy `.env.example` to `.env` with `VITE_API_URL=http://localhost:3000`, then run `npm install` and `npm run dev`. App at `http://localhost:5173`.
5. **Seed accounts**: `host@example.com` / `Password123`, `guest@example.com` / `Password123`. The seed also creates sample listings so you can browse and test bookings.

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

**Seed users**: `host@example.com` / `Password123`, `guest@example.com` / `Password123`.

### 2. Frontend

1. In `mockUpFrontend/`:
   - Copy `.env.example` to `.env` and set `VITE_API_URL=http://localhost:3000` (if different).
   - Run:
     ```bash
     npm install
     npm run dev
     ```
   - App runs at `http://localhost:5173`.

### 3. E2E check

- **Register/Login**: Open `/auth/register` or `/auth/login`, create account or sign in with `guest@example.com` / `Password123`.
- **Search**: Go to `/find`, use filters; results come from the API.
- **Book**: Open a space, pick date and time, click “Request to Book” / “Instant Book”; booking is created via API.
- **Dashboard**: `/dashboard` – “My Bookings” and “Favorites” load from API.
- **Host**: Log in as `host@example.com` (or a user who has listed spaces). `/host` shows host listings from API; “Manage Listings” and “Edit” load/update via API.
- **List space**: `/list-your-space` – complete the flow and “Complete Listing”; space is created via API.

## How to restart the application

Use this whenever you want a clean run (e.g. after pulling code, changing env, or if something stops working).

### Step 1: Stop what's already running

- **Backend**: In the terminal where the API is running, press `Ctrl+C` (or close that terminal).
- **Frontend**: Same in the terminal where Vite is running – `Ctrl+C`.
- If you're not sure which terminals: close any terminal that ran `npm run dev` or `npm run start` in `backend/` or `mockUpFrontend/`.

### Step 2: Start the backend

1. Open a terminal.
2. Go to the backend folder and start the API:

   ```bash
   cd backend
   npm run start
   ```

   For auto-restart on file changes use:

   ```bash
   cd backend
   npm run dev
   ```

3. Wait until you see something like: `API running at http://localhost:3000`.
4. Optional check: open `http://localhost:3000/api/health` in a browser – you should see `{"ok":true}`.

### Step 3: Start the frontend

1. Open **another** terminal (leave the backend running).
2. Go to the frontend folder and start the app:

   ```bash
   cd mockUpFrontend
   npm run dev
   ```

3. Wait until you see the local URL (e.g. `http://localhost:5173`).
4. Open that URL in your browser – you should see the app and be able to log in with `guest@example.com` / `password123`.

### Step 4 (optional): If the app still acts broken

- **Database / seed**: Ensure PostgreSQL is running, then in `backend/` run:

  ```bash
  cd backend
  npm run db:push
  npm run db:seed
  ```

- **Env**: In `backend/.env` have at least:
  - `DATABASE_URL` – your Postgres connection string.
  - `JWT_SECRET` – any non-empty string.
  - `CORS_ORIGIN=http://localhost:5173` – so the frontend can call the API.

After that, repeat **Step 1 → Step 2 → Step 3** to restart cleanly.

### Running E2E tests

From the **project root** (not inside `backend` or `mockUpFrontend`):

```bash
npm run e2e
```

Playwright will start both backend and frontend if they aren't already running. To run with servers already up, start backend and frontend yourself (Steps 2 and 3), then run `npm run e2e` from the root.

## Project layout

- `backend/` – Express app, Prisma schema, auth (JWT), routes: auth, users, spaces, bookings, reviews, favorites, host.
- `mockUpFrontend/` – React app, Tailwind + Radix UI, API client and auth context, pages wired to the backend.

---

## Sharing this project on GitHub

1. Create a new repository on [GitHub](https://github.com/new) (e.g. `shared-space-reservations`). Do **not** add a README, .gitignore, or license yet.
2. In your project folder (e.g. `UniProject`), open a terminal and run:

   ```bash
   git init
   git add .
   git commit -m "Initial commit: Shared Space Reservations web app"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```

   Replace `YOUR_USERNAME` and `YOUR_REPO_NAME` with your GitHub username and repo name.

3. Your `.env` files are ignored by `.gitignore`, so they are **not** pushed. Anyone who clones the repo must create their own `.env` from the `.env.example` files (see "Running the project from GitHub" above).
4. Share the repository link with your professor. They can clone it and follow the README to run the app locally with a local PostgreSQL database and see all seed data (listings, users, etc.).
