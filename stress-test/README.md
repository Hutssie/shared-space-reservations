# Stress Testing — Shared Space Reservations

Modulul măsoară **limitele de performanță** ale aplicației (concurență maximă, degradarea latenței, praguri de eroare) și produce un raport Markdown pentru documentația de licență.

Orchestratorul determinist din `run-local-stress-test.js` escaladează automat concurența pe fiecare endpoint important, menținând exact *N* cereri în zbor simultan, și se oprește când:

- rata de erori **> 5%**, sau
- latența **p95 > 5000ms**.

Înregistrează automat, per endpoint: punctul de degradare a latenței (p95 > 1s), punctul de rupere, concurența maximă sustenabilă și debitul maxim (req/s).

---

## Prerequisite

- Docker + Docker Compose
- Node.js ≥ 20

## Pași

### 1. Pornire aplicație în Docker

```bash
# Din rădăcina proiectului:
docker compose up -d --build

# Verificare că rulează:
docker compose ps
curl http://localhost:3000/api/health
```

### 2. Migrare bază de date + seed (prima rulare)

```bash
cd stress-test
npm install
node setup-db.js
```

> `setup-db.js` rulează `prisma migrate deploy` + `prisma/seed.js` față de DB-ul din Docker.

### 3. Rulare stress test

```powershell
npm start
```

Opțional — rulare blândă plafonată la 50 concurenți:

```powershell
$env:MAX_CONCURRENCY = "50"; npm start
```

Opțional — include și `POST /api/auth/register` (atenție: apelează Mailtrap):

```powershell
$env:INCLUDE_REGISTER = "1"; npm start
```

Raportul se salvează în `stress-test/stress-test-report.md`.

### 4. Oprire Docker

```bash
docker compose down          # oprire containere
docker compose down -v       # oprire + ștergere volum DB
```

---

## Ce măsoară

| Metrică     | Descriere                                             |
| ----------- | ----------------------------------------------------- |
| `p50`       | Latența mediană (50% din cereri sub această valoare)  |
| `p95`       | Latența pentru 95% din cereri                         |
| `p99`       | Latența pentru 99% din cereri                         |
| `max`       | Cea mai lentă cerere                                  |
| `errorRate` | Procentul de cereri eșuate (status ≥ 400 sau timeout) |

## Parametri modificabili

| Parametru                    | Implicit                | Rol                                                            |
| ---------------------------- | ----------------------- | -------------------------------------------------------------- |
| `BASE_URL` (env)             | `http://localhost:3000` | URL aplicație                                                  |
| `MAX_CONCURRENCY` (env)      | nelimitat               | Plafonează nivelul maxim de concurență                         |
| `INCLUDE_REGISTER` (env)     | dezactivat              | Adaugă testul pe `POST /api/auth/register` (apelează Mailtrap) |
| `STOP_ERROR_RATE` (const)    | `0.05`                  | Prag de oprire pe rata de erori                                |
| `STOP_P95_MS` (const)        | `5000`                  | Prag de oprire pe latența p95                                  |
| `CONCURRENCY_LEVELS` (const) | `5…2000`                | Nivelurile de concurență testate                               |
| Timeout per cerere           | `15s`                   | `AbortSignal.timeout(15_000)`                                  |
