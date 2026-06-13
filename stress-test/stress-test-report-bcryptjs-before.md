# Raport Stress Test — Shared Space Reservations

**Data**: 2026-06-12T21:01:16.103Z  
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
| `/api/health` | max_throughput | 3108.8 req/s | Debitul maxim observat în zona sănătoasă. |
| `/api/spaces?page=1&limit=20` | latency_degrades_at | 100 concurenți | p95 = 1696ms (> 1000ms) la 100 cereri concurente. |
| `/api/spaces?page=1&limit=20` | max_sustainable_concurrency | 2000 concurenți | Cel mai mare nivel de concurență fără a depăși pragurile (erori ≤ 5%, p95 ≤ 5s). |
| `/api/spaces?page=1&limit=20` | max_throughput | 206.0 req/s | Debitul maxim observat în zona sănătoasă. |
| `/api/spaces?page=10&limit=20` | latency_degrades_at | 50 concurenți | p95 = 1163ms (> 1000ms) la 50 cereri concurente. |
| `/api/spaces?page=10&limit=20` | max_sustainable_concurrency | 2000 concurenți | Cel mai mare nivel de concurență fără a depăși pragurile (erori ≤ 5%, p95 ≤ 5s). |
| `/api/spaces?page=10&limit=20` | max_throughput | 203.9 req/s | Debitul maxim observat în zona sănătoasă. |
| `/api/spaces?page=1&limit=20&city=Brooklyn` | latency_degrades_at | 100 concurenți | p95 = 1377ms (> 1000ms) la 100 cereri concurente. |
| `/api/spaces?page=1&limit=20&city=Brooklyn` | max_sustainable_concurrency | 2000 concurenți | Cel mai mare nivel de concurență fără a depăși pragurile (erori ≤ 5%, p95 ≤ 5s). |
| `/api/spaces?page=1&limit=20&city=Brooklyn` | max_throughput | 202.6 req/s | Debitul maxim observat în zona sănătoasă. |
| `/api/spaces/cmqbd8v0802mi1238c36s0449` | latency_degrades_at | 200 concurenți | p95 = 1200ms (> 1000ms) la 200 cereri concurente. |
| `/api/spaces/cmqbd8v0802mi1238c36s0449` | max_sustainable_concurrency | 2000 concurenți | Cel mai mare nivel de concurență fără a depăși pragurile (erori ≤ 5%, p95 ≤ 5s). |
| `/api/spaces/cmqbd8v0802mi1238c36s0449` | max_throughput | 478.9 req/s | Debitul maxim observat în zona sănătoasă. |
| `/api/auth/login` | latency_degrades_at | 10 concurenți | p95 = 1291ms (> 1000ms) la 10 cereri concurente. |
| `/api/auth/login` | breaking_point | 25 concurenți | Punct de rupere: p95 5474ms (> 5000ms). |
| `/api/auth/login` | max_sustainable_concurrency | 10 concurenți | Cel mai mare nivel de concurență fără a depăși pragurile (erori ≤ 5%, p95 ≤ 5s). |
| `/api/auth/login` | max_throughput | 14.9 req/s | Debitul maxim observat în zona sănătoasă. |
| `/api/bookings` | latency_degrades_at | 150 concurenți | p95 = 1344ms (> 1000ms) la 150 cereri concurente. |
| `/api/bookings` | max_sustainable_concurrency | 2000 concurenți | Cel mai mare nivel de concurență fără a depăși pragurile (erori ≤ 5%, p95 ≤ 5s). |
| `/api/bookings` | max_throughput | 357.1 req/s | Debitul maxim observat în zona sănătoasă. |

## 3. Rezultate detaliate pe endpoint

### Health check

`GET /api/health`

| Concurență | Cereri | Erori | err% | p50 | p90 | p95 | p99 | max | req/s |
|-----------:|-------:|------:|-----:|----:|----:|----:|----:|----:|------:|
| 5 | 50 | 0 | 0.0% | 3 | 9 | 10 | 17 | 17 | 1111.1 |
| 10 | 50 | 0 | 0.0% | 6 | 13 | 14 | 17 | 17 | 1315.8 |
| 25 | 75 | 0 | 0.0% | 14 | 33 | 35 | 41 | 41 | 1229.5 |
| 50 | 150 | 0 | 0.0% | 26 | 66 | 67 | 72 | 73 | 1363.6 |
| 100 | 300 | 0 | 0.0% | 54 | 124 | 130 | 169 | 177 | 1327.4 |
| 150 | 450 | 0 | 0.0% | 41 | 81 | 84 | 154 | 155 | 2445.7 |
| 200 | 600 | 0 | 0.0% | 56 | 233 | 241 | 245 | 246 | 1941.7 |
| 300 | 600 | 0 | 0.0% | 109 | 245 | 246 | 248 | 248 | 1904.8 |
| 500 | 600 | 0 | 0.0% | 236 | 267 | 268 | 284 | 287 | 1591.5 |
| 750 | 600 | 0 | 0.0% | 112 | 136 | 141 | 147 | 149 | 2531.6 |
| 1000 | 600 | 0 | 0.0% | 79 | 100 | 105 | 109 | 109 | 3108.8 |
| 1500 | 600 | 0 | 0.0% | 77 | 90 | 100 | 109 | 110 | 3000.0 |
| 2000 | 600 | 0 | 0.0% | 72 | 98 | 112 | 122 | 124 | 2803.7 |

_Aplicația a rezistat la toate nivelurile testate (max 2000 concurenți)._

### Listare spații (implicit)

`GET /api/spaces?page=1&limit=20`

| Concurență | Cereri | Erori | err% | p50 | p90 | p95 | p99 | max | req/s |
|-----------:|-------:|------:|-----:|----:|----:|----:|----:|----:|------:|
| 5 | 50 | 0 | 0.0% | 31 | 57 | 87 | 93 | 93 | 142.0 |
| 10 | 50 | 0 | 0.0% | 61 | 65 | 66 | 82 | 82 | 157.7 |
| 25 | 75 | 0 | 0.0% | 108 | 131 | 148 | 152 | 152 | 206.0 |
| 50 | 150 | 0 | 0.0% | 197 | 434 | 674 | 740 | 753 | 163.0 |
| 100 | 300 | 0 | 0.0% | 359 | 1637 | 1696 | 1763 | 1768 | 167.3 |
| 150 | 450 | 0 | 0.0% | 595 | 1917 | 2520 | 2591 | 2605 | 169.2 |
| 200 | 600 | 0 | 0.0% | 934 | 1162 | 2343 | 2907 | 2967 | 179.6 |
| 300 | 600 | 0 | 0.0% | 1025 | 2876 | 2990 | 3078 | 3088 | 190.0 |
| 500 | 600 | 0 | 0.0% | 1805 | 3457 | 3701 | 3898 | 3952 | 146.9 |
| 750 | 600 | 0 | 0.0% | 2315 | 3626 | 3809 | 3919 | 3926 | 142.6 |
| 1000 | 600 | 0 | 0.0% | 2332 | 3470 | 3594 | 3691 | 3697 | 161.9 |
| 1500 | 600 | 0 | 0.0% | 1800 | 3235 | 3459 | 3570 | 3579 | 166.9 |
| 2000 | 600 | 0 | 0.0% | 2148 | 3454 | 3571 | 3659 | 3669 | 162.0 |

_Aplicația a rezistat la toate nivelurile testate (max 2000 concurenți)._

### Listare spații (paginare adâncă)

`GET /api/spaces?page=10&limit=20`

| Concurență | Cereri | Erori | err% | p50 | p90 | p95 | p99 | max | req/s |
|-----------:|-------:|------:|-----:|----:|----:|----:|----:|----:|------:|
| 5 | 50 | 0 | 0.0% | 31 | 41 | 42 | 46 | 46 | 148.4 |
| 10 | 50 | 0 | 0.0% | 95 | 170 | 175 | 197 | 197 | 95.1 |
| 25 | 75 | 0 | 0.0% | 189 | 321 | 505 | 573 | 573 | 104.9 |
| 50 | 150 | 0 | 0.0% | 284 | 898 | 1163 | 1239 | 1240 | 119.0 |
| 100 | 300 | 0 | 0.0% | 373 | 1479 | 1874 | 1940 | 1945 | 151.4 |
| 150 | 450 | 0 | 0.0% | 625 | 2596 | 2857 | 2934 | 2942 | 150.1 |
| 200 | 600 | 0 | 0.0% | 780 | 909 | 2718 | 2987 | 3017 | 196.8 |
| 300 | 600 | 0 | 0.0% | 979 | 2678 | 2793 | 2858 | 2880 | 201.4 |
| 500 | 600 | 0 | 0.0% | 1298 | 2647 | 2758 | 2853 | 2859 | 203.9 |
| 750 | 600 | 0 | 0.0% | 1848 | 3013 | 3152 | 3246 | 3256 | 180.1 |
| 1000 | 600 | 0 | 0.0% | 1873 | 2957 | 3159 | 3266 | 3271 | 183.2 |
| 1500 | 600 | 0 | 0.0% | 2198 | 3182 | 3381 | 3483 | 3487 | 171.1 |
| 2000 | 600 | 0 | 0.0% | 1774 | 2963 | 3188 | 3277 | 3282 | 182.3 |

_Aplicația a rezistat la toate nivelurile testate (max 2000 concurenți)._

### Listare spații (filtrare oraș)

`GET /api/spaces?page=1&limit=20&city=Brooklyn`

| Concurență | Cereri | Erori | err% | p50 | p90 | p95 | p99 | max | req/s |
|-----------:|-------:|------:|-----:|----:|----:|----:|----:|----:|------:|
| 5 | 50 | 0 | 0.0% | 32 | 37 | 38 | 41 | 41 | 150.2 |
| 10 | 50 | 0 | 0.0% | 73 | 99 | 101 | 116 | 116 | 137.4 |
| 25 | 75 | 0 | 0.0% | 131 | 163 | 186 | 211 | 211 | 165.2 |
| 50 | 150 | 0 | 0.0% | 266 | 369 | 469 | 603 | 635 | 162.9 |
| 100 | 300 | 0 | 0.0% | 310 | 1209 | 1377 | 1482 | 1497 | 193.2 |
| 150 | 450 | 0 | 0.0% | 535 | 1138 | 1771 | 2030 | 2074 | 202.6 |
| 200 | 600 | 0 | 0.0% | 1084 | 1321 | 3989 | 4125 | 4145 | 143.1 |
| 300 | 600 | 0 | 0.0% | 1114 | 3281 | 3365 | 3473 | 3492 | 163.0 |
| 500 | 600 | 0 | 0.0% | 2103 | 3307 | 3443 | 3546 | 3567 | 152.1 |
| 750 | 600 | 0 | 0.0% | 1742 | 2764 | 2884 | 2972 | 2980 | 196.4 |
| 1000 | 600 | 0 | 0.0% | 1679 | 2885 | 2996 | 3084 | 3091 | 193.2 |
| 1500 | 600 | 0 | 0.0% | 1742 | 2793 | 2905 | 2994 | 2999 | 196.0 |
| 2000 | 600 | 0 | 0.0% | 1732 | 2735 | 2922 | 3018 | 3023 | 198.2 |

_Aplicația a rezistat la toate nivelurile testate (max 2000 concurenți)._

### Detalii spațiu

`GET /api/spaces/cmqbd8v0802mi1238c36s0449`

| Concurență | Cereri | Erori | err% | p50 | p90 | p95 | p99 | max | req/s |
|-----------:|-------:|------:|-----:|----:|----:|----:|----:|----:|------:|
| 5 | 50 | 0 | 0.0% | 11 | 20 | 27 | 28 | 28 | 406.5 |
| 10 | 50 | 0 | 0.0% | 21 | 26 | 27 | 33 | 33 | 434.8 |
| 25 | 75 | 0 | 0.0% | 47 | 67 | 68 | 81 | 81 | 431.0 |
| 50 | 150 | 0 | 0.0% | 93 | 163 | 165 | 317 | 324 | 422.5 |
| 100 | 300 | 0 | 0.0% | 129 | 583 | 611 | 623 | 624 | 444.4 |
| 150 | 450 | 0 | 0.0% | 202 | 779 | 881 | 909 | 913 | 467.8 |
| 200 | 600 | 0 | 0.0% | 373 | 399 | 1200 | 1237 | 1243 | 459.1 |
| 300 | 600 | 0 | 0.0% | 452 | 1107 | 1168 | 1210 | 1215 | 468.4 |
| 500 | 600 | 0 | 0.0% | 740 | 1168 | 1233 | 1274 | 1286 | 425.5 |
| 750 | 600 | 0 | 0.0% | 1085 | 1168 | 1222 | 1263 | 1268 | 440.9 |
| 1000 | 600 | 0 | 0.0% | 1147 | 1185 | 1189 | 1192 | 1193 | 467.7 |
| 1500 | 600 | 0 | 0.0% | 1177 | 1219 | 1224 | 1227 | 1227 | 459.1 |
| 2000 | 600 | 0 | 0.0% | 1119 | 1151 | 1155 | 1158 | 1159 | 478.9 |

_Aplicația a rezistat la toate nivelurile testate (max 2000 concurenți)._

### Autentificare (bcrypt)

`POST /api/auth/login`

| Concurență | Cereri | Erori | err% | p50 | p90 | p95 | p99 | max | req/s |
|-----------:|-------:|------:|-----:|----:|----:|----:|----:|----:|------:|
| 5 | 50 | 0 | 0.0% | 341 | 478 | 502 | 552 | 552 | 13.7 |
| 10 | 50 | 0 | 0.0% | 597 | 1062 | 1291 | 1555 | 1555 | 14.9 |
| 25 | 75 | 0 | 0.0% | 1139 | 4825 | 5474 | 5671 | 5671 | 13.1 |

_Escaladare oprită la **25** concurenți (prag depășit)._

### Listare rezervări (auth)

`GET /api/bookings`

| Concurență | Cereri | Erori | err% | p50 | p90 | p95 | p99 | max | req/s |
|-----------:|-------:|------:|-----:|----:|----:|----:|----:|----:|------:|
| 5 | 50 | 0 | 0.0% | 13 | 18 | 19 | 21 | 21 | 357.1 |
| 10 | 50 | 0 | 0.0% | 29 | 56 | 56 | 57 | 57 | 277.8 |
| 25 | 75 | 0 | 0.0% | 67 | 71 | 72 | 100 | 100 | 352.1 |
| 50 | 150 | 0 | 0.0% | 94 | 388 | 411 | 453 | 456 | 303.6 |
| 100 | 300 | 0 | 0.0% | 178 | 786 | 869 | 907 | 912 | 317.1 |
| 150 | 450 | 0 | 0.0% | 319 | 921 | 1344 | 1412 | 1428 | 300.8 |
| 200 | 600 | 0 | 0.0% | 462 | 726 | 1409 | 1723 | 1737 | 321.2 |
| 300 | 600 | 0 | 0.0% | 924 | 2176 | 2310 | 2422 | 2454 | 225.6 |
| 500 | 600 | 0 | 0.0% | 1534 | 2241 | 2327 | 2398 | 2411 | 224.1 |
| 750 | 600 | 0 | 0.0% | 1906 | 2021 | 2105 | 2195 | 2206 | 259.4 |
| 1000 | 600 | 0 | 0.0% | 1517 | 1722 | 1722 | 1723 | 1724 | 332.6 |
| 1500 | 600 | 0 | 0.0% | 1506 | 1724 | 1730 | 1734 | 1735 | 331.9 |
| 2000 | 600 | 0 | 0.0% | 1496 | 1693 | 1695 | 1695 | 1696 | 340.1 |

_Aplicația a rezistat la toate nivelurile testate (max 2000 concurenți)._

## 4. Observații și recomandări

- Endpoint-urile read-only (`GET /api/spaces`, `GET /api/health`) tolerează concurența cea mai mare; gâtuirea apare de regulă la operațiile dependente de CPU/bcrypt (`POST /api/auth/login`) și la interogările grele de bază de date.
- Degradarea latenței (p95 peste prag) precede de obicei apariția erorilor — este un indicator timpuriu al saturării pool-ului de conexiuni / event-loop-ului.
- Valorile sunt măsurate pe o singură instanță Docker; scalarea orizontală (mai multe replici + load balancer) ar deplasa punctele de rupere în sus.
