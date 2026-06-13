# Raport Stress Test — Shared Space Reservations

**Data**: 2026-06-12T21:33:27.024Z  
**Target**: http://localhost:3000  
**Metodă**: orchestrator determinist (fără AI), Node.js `fetch` cu pool de concurență  
**Mediu**: aplicație Node.js/Express + PostgreSQL (pgvector) în Docker  

## 1. Metodologie

Fiecare endpoint a fost supus unei escaladări de concurență: pentru fiecare nivel s-au menținut exact *N* cereri în zbor simultan (pool de workeri), cu un total de ~10× *N* cereri per nivel. Escaladarea s-a oprit automat la primul nivel care a depășit unul dintre praguri:

- rata de erori **> 5.0%** (status ≥ 400 sau timeout/conexiune refuzată), sau
- latența **p95 > 5000ms**.

Niveluri de concurență testate: 5 → 10 → 25 → 50 → 100 → 150 → 200 → 300 → 500 → 750 → 1000 → 1500 → 2000. Timeout per cerere: 15s. Punctul de degradare a latenței este definit ca primul nivel cu **p95 > 1000ms**.

| Metrică | Semnificație |
|---------|--------------|
| p50 / p90 / p95 / p99 | Percentile de latență (ms) — ex. p95 = 95% din cereri sub această valoare |
| max | Cea mai lentă cerere (ms) |
| err% | Procent cereri eșuate (status ≥ 400 sau timeout) |
| req/s | Debit real măsurat (throughput) pe durata nivelului |

## 2. Limite identificate

| Endpoint | Tip limită | Valoare | Descriere |
|----------|-----------|---------|-----------|
| `/api/health` | max_sustainable_concurrency | 2000 concurenți | Cel mai mare nivel de concurență fără a depăși pragurile (erori ≤ 5%, p95 ≤ 5s). |
| `/api/health` | max_throughput | 2765.0 req/s | Debitul maxim observat în zona sănătoasă. |
| `/api/spaces?page=1&limit=20` | latency_degrades_at | 100 concurenți | p95 = 1180ms (> 1000ms) la 100 cereri concurente. |
| `/api/spaces?page=1&limit=20` | max_sustainable_concurrency | 2000 concurenți | Cel mai mare nivel de concurență fără a depăși pragurile (erori ≤ 5%, p95 ≤ 5s). |
| `/api/spaces?page=1&limit=20` | max_throughput | 210.1 req/s | Debitul maxim observat în zona sănătoasă. |
| `/api/spaces?page=10&limit=20` | latency_degrades_at | 100 concurenți | p95 = 1672ms (> 1000ms) la 100 cereri concurente. |
| `/api/spaces?page=10&limit=20` | max_sustainable_concurrency | 2000 concurenți | Cel mai mare nivel de concurență fără a depăși pragurile (erori ≤ 5%, p95 ≤ 5s). |
| `/api/spaces?page=10&limit=20` | max_throughput | 176.8 req/s | Debitul maxim observat în zona sănătoasă. |
| `/api/spaces?page=1&limit=20&city=Brooklyn` | latency_degrades_at | 100 concurenți | p95 = 1122ms (> 1000ms) la 100 cereri concurente. |
| `/api/spaces?page=1&limit=20&city=Brooklyn` | max_sustainable_concurrency | 2000 concurenți | Cel mai mare nivel de concurență fără a depăși pragurile (erori ≤ 5%, p95 ≤ 5s). |
| `/api/spaces?page=1&limit=20&city=Brooklyn` | max_throughput | 195.1 req/s | Debitul maxim observat în zona sănătoasă. |
| `/api/spaces/cmqbd8v0802mi1238c36s0449` | latency_degrades_at | 200 concurenți | p95 = 1250ms (> 1000ms) la 200 cereri concurente. |
| `/api/spaces/cmqbd8v0802mi1238c36s0449` | max_sustainable_concurrency | 2000 concurenți | Cel mai mare nivel de concurență fără a depăși pragurile (erori ≤ 5%, p95 ≤ 5s). |
| `/api/spaces/cmqbd8v0802mi1238c36s0449` | max_throughput | 471.7 req/s | Debitul maxim observat în zona sănătoasă. |
| `/api/auth/login` | latency_degrades_at | 100 concurenți | p95 = 1527ms (> 1000ms) la 100 cereri concurente. |
| `/api/auth/login` | breaking_point | 500 concurenți | Punct de rupere: p95 7396ms (> 5000ms). |
| `/api/auth/login` | max_sustainable_concurrency | 300 concurenți | Cel mai mare nivel de concurență fără a depăși pragurile (erori ≤ 5%, p95 ≤ 5s). |
| `/api/auth/login` | max_throughput | 67.2 req/s | Debitul maxim observat în zona sănătoasă. |
| `/api/bookings` | latency_degrades_at | 150 concurenți | p95 = 1793ms (> 1000ms) la 150 cereri concurente. |
| `/api/bookings` | max_sustainable_concurrency | 2000 concurenți | Cel mai mare nivel de concurență fără a depăși pragurile (erori ≤ 5%, p95 ≤ 5s). |
| `/api/bookings` | max_throughput | 328.4 req/s | Debitul maxim observat în zona sănătoasă. |

## 3. Rezultate detaliate pe endpoint

### Health check

`GET /api/health`

| Concurență | Cereri | Erori | err% | p50 | p90 | p95 | p99 | max | req/s |
|-----------:|-------:|------:|-----:|----:|----:|----:|----:|----:|------:|
| 5 | 50 | 0 | 0.0% | 6 | 14 | 19 | 23 | 23 | 649.4 |
| 10 | 50 | 0 | 0.0% | 11 | 22 | 23 | 32 | 32 | 675.7 |
| 25 | 75 | 0 | 0.0% | 19 | 38 | 41 | 43 | 43 | 1000.0 |
| 50 | 150 | 0 | 0.0% | 35 | 84 | 86 | 89 | 89 | 967.7 |
| 100 | 300 | 0 | 0.0% | 62 | 156 | 223 | 224 | 225 | 1027.4 |
| 150 | 450 | 0 | 0.0% | 69 | 108 | 235 | 237 | 238 | 1437.7 |
| 200 | 600 | 0 | 0.0% | 91 | 360 | 368 | 413 | 419 | 1162.8 |
| 300 | 600 | 0 | 0.0% | 148 | 282 | 286 | 289 | 290 | 1538.5 |
| 500 | 600 | 0 | 0.0% | 287 | 366 | 368 | 372 | 373 | 1250.0 |
| 750 | 600 | 0 | 0.0% | 119 | 181 | 187 | 191 | 193 | 1954.4 |
| 1000 | 600 | 0 | 0.0% | 139 | 160 | 164 | 171 | 178 | 1749.3 |
| 1500 | 600 | 0 | 0.0% | 84 | 133 | 139 | 142 | 142 | 2586.2 |
| 2000 | 600 | 0 | 0.0% | 85 | 115 | 119 | 122 | 122 | 2765.0 |

_Aplicația a rezistat la toate nivelurile testate (max 2000 concurenți)._

### Listare spații (implicit)

`GET /api/spaces?page=1&limit=20`

| Concurență | Cereri | Erori | err% | p50 | p90 | p95 | p99 | max | req/s |
|-----------:|-------:|------:|-----:|----:|----:|----:|----:|----:|------:|
| 5 | 50 | 0 | 0.0% | 33 | 40 | 55 | 75 | 75 | 146.2 |
| 10 | 50 | 0 | 0.0% | 67 | 75 | 75 | 86 | 86 | 151.1 |
| 25 | 75 | 0 | 0.0% | 116 | 131 | 144 | 156 | 156 | 191.3 |
| 50 | 150 | 0 | 0.0% | 157 | 452 | 678 | 694 | 697 | 210.1 |
| 100 | 300 | 0 | 0.0% | 348 | 951 | 1180 | 1563 | 1573 | 188.1 |
| 150 | 450 | 0 | 0.0% | 656 | 2234 | 2840 | 2904 | 2911 | 152.5 |
| 200 | 600 | 0 | 0.0% | 949 | 1130 | 3539 | 3619 | 3636 | 162.0 |
| 300 | 600 | 0 | 0.0% | 999 | 3087 | 3282 | 3413 | 3446 | 171.0 |
| 500 | 600 | 0 | 0.0% | 1698 | 3101 | 3171 | 3286 | 3307 | 172.4 |
| 750 | 600 | 0 | 0.0% | 1995 | 3063 | 3197 | 3294 | 3376 | 176.5 |
| 1000 | 600 | 0 | 0.0% | 2019 | 3024 | 3142 | 3382 | 3417 | 175.4 |
| 1500 | 600 | 0 | 0.0% | 1613 | 2678 | 2795 | 2895 | 2905 | 205.1 |
| 2000 | 600 | 0 | 0.0% | 1785 | 2892 | 2973 | 3068 | 3078 | 192.6 |

_Aplicația a rezistat la toate nivelurile testate (max 2000 concurenți)._

### Listare spații (paginare adâncă)

`GET /api/spaces?page=10&limit=20`

| Concurență | Cereri | Erori | err% | p50 | p90 | p95 | p99 | max | req/s |
|-----------:|-------:|------:|-----:|----:|----:|----:|----:|----:|------:|
| 5 | 50 | 0 | 0.0% | 31 | 78 | 79 | 80 | 80 | 140.4 |
| 10 | 50 | 0 | 0.0% | 65 | 70 | 76 | 85 | 85 | 151.5 |
| 25 | 75 | 0 | 0.0% | 149 | 296 | 392 | 465 | 465 | 137.1 |
| 50 | 150 | 0 | 0.0% | 213 | 683 | 907 | 930 | 936 | 157.1 |
| 100 | 300 | 0 | 0.0% | 363 | 1363 | 1672 | 1721 | 1727 | 171.4 |
| 150 | 450 | 0 | 0.0% | 601 | 2655 | 2813 | 2937 | 2965 | 149.5 |
| 200 | 600 | 0 | 0.0% | 828 | 978 | 3181 | 3342 | 3349 | 176.8 |
| 300 | 600 | 0 | 0.0% | 1128 | 3256 | 3404 | 3514 | 3529 | 166.8 |
| 500 | 600 | 0 | 0.0% | 1943 | 3943 | 4075 | 4159 | 4171 | 140.9 |
| 750 | 600 | 0 | 0.0% | 1987 | 3137 | 3270 | 3439 | 3450 | 171.0 |
| 1000 | 600 | 0 | 0.0% | 2677 | 3709 | 4032 | 4132 | 4137 | 144.6 |
| 1500 | 600 | 0 | 0.0% | 2077 | 3217 | 3397 | 3533 | 3542 | 168.8 |
| 2000 | 600 | 0 | 0.0% | 2262 | 3648 | 3841 | 4029 | 4042 | 146.8 |

_Aplicația a rezistat la toate nivelurile testate (max 2000 concurenți)._

### Listare spații (filtrare oraș)

`GET /api/spaces?page=1&limit=20&city=Brooklyn`

| Concurență | Cereri | Erori | err% | p50 | p90 | p95 | p99 | max | req/s |
|-----------:|-------:|------:|-----:|----:|----:|----:|----:|----:|------:|
| 5 | 50 | 0 | 0.0% | 45 | 66 | 70 | 82 | 82 | 103.5 |
| 10 | 50 | 0 | 0.0% | 73 | 87 | 101 | 105 | 105 | 133.0 |
| 25 | 75 | 0 | 0.0% | 148 | 186 | 194 | 199 | 199 | 150.9 |
| 50 | 150 | 0 | 0.0% | 205 | 490 | 637 | 711 | 730 | 177.7 |
| 100 | 300 | 0 | 0.0% | 430 | 949 | 1122 | 1397 | 1431 | 190.0 |
| 150 | 450 | 0 | 0.0% | 841 | 2697 | 3461 | 3620 | 3645 | 122.5 |
| 200 | 600 | 0 | 0.0% | 935 | 1340 | 3640 | 3730 | 3751 | 157.0 |
| 300 | 600 | 0 | 0.0% | 1127 | 3101 | 3206 | 3298 | 3316 | 177.7 |
| 500 | 600 | 0 | 0.0% | 1691 | 3000 | 3102 | 3190 | 3213 | 180.1 |
| 750 | 600 | 0 | 0.0% | 1750 | 2781 | 2898 | 2986 | 2992 | 192.4 |
| 1000 | 600 | 0 | 0.0% | 1761 | 2786 | 2975 | 3064 | 3071 | 195.1 |
| 1500 | 600 | 0 | 0.0% | 2009 | 3038 | 3177 | 3275 | 3283 | 180.5 |
| 2000 | 600 | 0 | 0.0% | 2152 | 3246 | 3564 | 3756 | 3773 | 158.1 |

_Aplicația a rezistat la toate nivelurile testate (max 2000 concurenți)._

### Detalii spațiu

`GET /api/spaces/cmqbd8v0802mi1238c36s0449`

| Concurență | Cereri | Erori | err% | p50 | p90 | p95 | p99 | max | req/s |
|-----------:|-------:|------:|-----:|----:|----:|----:|----:|----:|------:|
| 5 | 50 | 0 | 0.0% | 23 | 45 | 46 | 64 | 64 | 171.8 |
| 10 | 50 | 0 | 0.0% | 25 | 40 | 41 | 53 | 53 | 340.1 |
| 25 | 75 | 0 | 0.0% | 63 | 70 | 74 | 75 | 75 | 371.3 |
| 50 | 150 | 0 | 0.0% | 66 | 319 | 342 | 348 | 351 | 409.8 |
| 100 | 300 | 0 | 0.0% | 136 | 670 | 701 | 716 | 720 | 402.7 |
| 150 | 450 | 0 | 0.0% | 223 | 768 | 888 | 921 | 928 | 471.7 |
| 200 | 600 | 0 | 0.0% | 324 | 472 | 1250 | 1299 | 1307 | 431.7 |
| 300 | 600 | 0 | 0.0% | 503 | 1397 | 1449 | 1486 | 1497 | 387.6 |
| 500 | 600 | 0 | 0.0% | 869 | 1759 | 1822 | 1845 | 1854 | 282.5 |
| 750 | 600 | 0 | 0.0% | 1381 | 1729 | 1810 | 1870 | 1881 | 286.7 |
| 1000 | 600 | 0 | 0.0% | 1551 | 1590 | 1598 | 1601 | 1602 | 342.9 |
| 1500 | 600 | 0 | 0.0% | 1299 | 1315 | 1318 | 1322 | 1322 | 421.3 |
| 2000 | 600 | 0 | 0.0% | 1235 | 1268 | 1272 | 1276 | 1278 | 439.9 |

_Aplicația a rezistat la toate nivelurile testate (max 2000 concurenți)._

### Autentificare (bcrypt)

`POST /api/auth/login`

| Concurență | Cereri | Erori | err% | p50 | p90 | p95 | p99 | max | req/s |
|-----------:|-------:|------:|-----:|----:|----:|----:|----:|----:|------:|
| 5 | 50 | 0 | 0.0% | 67 | 98 | 99 | 108 | 108 | 65.0 |
| 10 | 50 | 0 | 0.0% | 154 | 207 | 217 | 230 | 230 | 55.9 |
| 25 | 75 | 0 | 0.0% | 352 | 393 | 402 | 411 | 411 | 67.2 |
| 50 | 150 | 0 | 0.0% | 740 | 794 | 798 | 878 | 883 | 62.0 |
| 100 | 300 | 0 | 0.0% | 1505 | 1523 | 1527 | 1607 | 1623 | 66.0 |
| 150 | 300 | 0 | 0.0% | 2192 | 2321 | 2344 | 2355 | 2395 | 64.9 |
| 200 | 300 | 0 | 0.0% | 2424 | 3129 | 3146 | 3320 | 3323 | 64.1 |
| 300 | 300 | 0 | 0.0% | 2383 | 4245 | 4473 | 4649 | 4668 | 63.4 |
| 500 | 300 | 0 | 0.0% | 3724 | 7060 | 7396 | 7628 | 7639 | 39.2 |

_Escaladare oprită la **500** concurenți (prag depășit)._

### Listare rezervări (auth)

`GET /api/bookings`

| Concurență | Cereri | Erori | err% | p50 | p90 | p95 | p99 | max | req/s |
|-----------:|-------:|------:|-----:|----:|----:|----:|----:|----:|------:|
| 5 | 50 | 0 | 0.0% | 26 | 33 | 35 | 41 | 41 | 188.0 |
| 10 | 50 | 0 | 0.0% | 30 | 84 | 100 | 118 | 118 | 218.3 |
| 25 | 75 | 0 | 0.0% | 51 | 181 | 210 | 233 | 233 | 289.6 |
| 50 | 150 | 0 | 0.0% | 118 | 479 | 494 | 547 | 561 | 245.1 |
| 100 | 300 | 0 | 0.0% | 210 | 907 | 988 | 1038 | 1048 | 274.0 |
| 150 | 450 | 0 | 0.0% | 450 | 867 | 1793 | 1860 | 1874 | 229.5 |
| 200 | 600 | 0 | 0.0% | 624 | 692 | 2083 | 2403 | 2453 | 228.9 |
| 300 | 600 | 0 | 0.0% | 1061 | 2613 | 2738 | 2854 | 2872 | 199.1 |
| 500 | 600 | 0 | 0.0% | 1784 | 2621 | 2709 | 2800 | 2823 | 199.7 |
| 750 | 600 | 0 | 0.0% | 1524 | 1781 | 1928 | 2016 | 2026 | 287.1 |
| 1000 | 600 | 0 | 0.0% | 1784 | 1920 | 1926 | 1932 | 1932 | 294.0 |
| 1500 | 600 | 0 | 0.0% | 1763 | 1855 | 1858 | 1860 | 1860 | 303.6 |
| 2000 | 600 | 0 | 0.0% | 1629 | 1732 | 1737 | 1740 | 1740 | 328.4 |

_Aplicația a rezistat la toate nivelurile testate (max 2000 concurenți)._

## 4. Observații și recomandări

- Endpoint-urile read-only (`GET /api/spaces`, `GET /api/health`) tolerează concurența cea mai mare; gâtuirea apare de regulă la operațiile dependente de CPU/bcrypt (`POST /api/auth/login`) și la interogările grele de bază de date.
- Degradarea latenței (p95 peste prag) precede de obicei apariția erorilor — este un indicator timpuriu al saturării pool-ului de conexiuni / event-loop-ului.
- Valorile sunt măsurate pe o singură instanță Docker; scalarea orizontală (mai multe replici + load balancer) ar deplasa punctele de rupere în sus.
