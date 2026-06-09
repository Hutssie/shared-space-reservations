# Shared Space Reservations – Web Application

University project: **Web Application for Intelligent Management of Shared Space Reservations**.

- **Frontend**: React (Vite).
- **Backend**: Node.js + Express + Prisma + PostgreSQL.

## Running the project from GitHub

### Prerequisites

Install:

- **[Node.js](https://nodejs.org/)** (LTS)
- **[PostgreSQL](https://www.postgresql.org/download/)** (14+)
- **[pgvector](https://github.com/pgvector/pgvector)** — required for AI search semantic embeddings (`Space.embedding` uses the PostgreSQL `vector` type). The app enables it via migration (`CREATE EXTENSION vector`).

**Install pgvector**

- **Linux (Debian/Ubuntu)** — if your Postgres version is packaged:
  ```bash
  sudo apt install postgresql-16-pgvector   # replace 16 with your Postgres major version
  ```
- **macOS (Homebrew Postgres):**
  ```bash
  brew install pgvector
  ```
- **Windows** — build from source (needs [Visual Studio C++ build tools](https://learn.microsoft.com/en-us/cpp/build/building-on-the-command-line)). Open **“x64 Native Tools Command Prompt for VS”** as Administrator, then (replace `18` with your Postgres major version):
  ```cmd
  set "PGROOT=C:\Program Files\PostgreSQL\18"
  cd %TEMP%
  git clone --branch v0.8.2 https://github.com/pgvector/pgvector.git
  cd pgvector
  nmake /F Makefile.win
  nmake /F Makefile.win install
  ```
  Troubleshooting: [pgvector Windows notes](https://github.com/pgvector/pgvector#installation-notes---windows).
- **Docker (alternative)** — use a Postgres image that includes pgvector (e.g. `pgvector/pgvector:pg16`) and point `DATABASE_URL` at that container.

**Verify** (optional, in `psql` connected to your database):

```sql
CREATE EXTENSION IF NOT EXISTS vector;
SELECT extname FROM pg_extension WHERE extname = 'vector';
```

If `CREATE EXTENSION` fails, install pgvector for your Postgres version before running `npm run db:deploy`.

### Clone the repo

```bash
git clone https://github.com/Hutssie/shared-space-reservations.git
cd shared-space-reservations
```

### Option A — Restore from database dump (fastest)

If you have a `.dump` file and `.env` files from the author:

```powershell
# Create DB (adjust psql path/version as needed)
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h localhost -p 5432 -U postgres -c "CREATE DATABASE space_reservations;"

# Restore dump
$env:PGPASSWORD = '<local_db_password>'
& "C:\Program Files\PostgreSQL\18\bin\pg_restore.exe" --no-owner --no-privileges -h localhost -p 5432 -U postgres -d space_reservations "[PATH to space_reservations.dump]"
Remove-Item Env:PGPASSWORD
```

Copy `.env` into `backend/` and `frontend/`, then start both apps (see Quick start below). If the dump predates the embedding migration, run `npm run db:deploy` and `npm run db:backfill-embeddings` in `backend/` (requires `GEMINI_API_KEY`).

### Option B — Fresh setup from migrations

**Backend** (`backend/`):

1. Create a PostgreSQL database (e.g. `space_reservations`).
2. Copy `.env.example` → `.env` and set at minimum:
  - `DATABASE_URL` — e.g. `postgresql://postgres:password@localhost:5432/space_reservations`
  - `JWT_SECRET` — any string for local dev
  - `CORS_ORIGIN=http://localhost:5173`
  - `GEMINI_API_KEY` — required for AI search and semantic retrieval ([Google AI Studio](https://aistudio.google.com/))
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — required for checkout ([Stripe test keys](https://dashboard.stripe.com/test/apikeys))
3. Install and init:

```bash
cd backend
npm install
npm run db:generate
npm run db:deploy
npm run db:backfill-embeddings   # embed active spaces for AI semantic search
npm run dev
```

API: `http://localhost:3000`

**Frontend** (`frontend/`):

1. Copy `.env.example` → `.env`:
  - `VITE_API_URL=http://localhost:3000`
  - `VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...`
  - Optional: `VITE_GOOGLE_MAPS_API_KEY` for maps
2. Run:

```bash
cd frontend
npm install
npm run dev
```

App: `http://localhost:5173`

---

## Quick start (summary)

Same as Option B above. Prefer `npm run db:deploy` over `prisma db push` so committed migrations (amenities, billing, embeddings, etc.) apply in order. See [backend/README.md](backend/README.md) for per-migration backfill notes.

**Seed users** (password `Password123`):

- Host: `host@example.com`
- Guest: `guest@example.com`
- Admin: `admin@example.com`

---

## Project layout


| Path            | Role                                                                            |
| --------------- | ------------------------------------------------------------------------------- |
| `backend/`      | Express API, Prisma, auth (JWT), spaces, bookings, payments (Stripe), AI search |
| `frontend/`     | React app, Tailwind + Radix UI, API client, checkout, AI search modal           |
| `backend/docs/` | Architecture docs (RAG, billing, scalability, recommendations)                  |


---

## Intelligent features

### Hybrid recommendations

Popularity + content + collaborative filtering + location boost for home and Find a Space. See [backend/docs/RECOMMENDATIONS.md](backend/docs/RECOMMENDATIONS.md).

**API:** `GET /api/spaces/recommended`, `GET /api/spaces/featured-this-month`, `GET /api/spaces?sort=recommended`

**Evaluation:**

```bash
cd backend
npm run db:evaluate-recommendations
```

### AI search (RAG + semantic retrieval)

Conversational search with Gemini function calling, backend policy gates, hybrid personalization, and pgvector semantic retrieval for listing recall and ranking. See [backend/docs/AI_RAG.md](backend/docs/AI_RAG.md).

**API:** `POST /api/ai-search/chat`

### Billing

Stripe Payment Intents for Instant Book and Request to Book. See [backend/docs/BILLING.md](backend/docs/BILLING.md).

---

## Documentation index


| Doc                                                                                  | Topic                                 |
| ------------------------------------------------------------------------------------ | ------------------------------------- |
| [backend/README.md](backend/README.md)                                               | API setup, migrations, backfills      |
| [backend/docs/AI_RAG.md](backend/docs/AI_RAG.md)                                     | AI search, RAG, semantic embeddings   |
| [backend/docs/RECOMMENDATIONS.md](backend/docs/RECOMMENDATIONS.md)                   | Hybrid recommender                    |
| [backend/docs/BILLING.md](backend/docs/BILLING.md)                                   | Stripe checkout flow                  |
| [backend/docs/CONCURRENCY.md](backend/docs/CONCURRENCY.md)                           | Booking correctness                   |
| [backend/docs/DATABASE_SCALABILITY.md](backend/docs/DATABASE_SCALABILITY.md)         | Search filters, indexes, availability |
| [backend/docs/SCALABILITY_VERIFICATION.md](backend/docs/SCALABILITY_VERIFICATION.md) | Automated verification runbook        |


**Tests:** `cd backend && npm test` (133 tests).