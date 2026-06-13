# Studiu de caz: identificarea și eliminarea unui bottleneck de autentificare prin stress testing

**Aplicație:** Shared Space Reservations (Node.js / Express + PostgreSQL / pgvector)
**Mediu de testare:** o singură instanță în Docker, pe `localhost` (Windows 11)
**Data măsurătorilor:** 12 iunie 2026

---

## 1. Scop și context

Obiectivul a fost documentarea **limitelor reale de performanță** ale aplicației (număr de utilizatori concurenți, degradarea latenței, praguri de eroare), nu estimări teoretice. Această secțiune descrie un ciclu complet de inginerie a performanței:

> **măsurare → diagnostic la nivel de cod → intervenție minimă → re-măsurare → validarea modelului teoretic**

Studiul se concentrează pe singurul endpoint care s-a *rupt* sub sarcină — autentificarea (`POST /api/auth/login`) — pentru că restul endpoint-urilor au rezistat la întreaga gamă de concurență testată.

---

## 2. Cum a fost construit stress test-ul

S-a folosit un **orchestrator determinist**, scris în JavaScript (Node.js), fără niciun serviciu extern (`stress-test/run-local-stress-test.js`). Strategia:

- **Model de tip „pool de workeri”:** pentru fiecare nivel de concurență *N*, se mențin **exact *N* cereri în zbor simultan**. De îndată ce o cerere se încheie, un worker liber lansează imediat alta — astfel sarcina reală asupra serverului rămâne constantă la *N*.
- **Escaladare automată a concurenței:** `5 → 10 → 25 → 50 → 100 → 150 → 200 → 300 → 500 → 750 → 1000 → 1500 → 2000`.
- **Condiții de oprire automată** (per endpoint), care marchează **punctul de rupere**:
  - rata de erori **> 5%** (status HTTP ≥ 400 sau timeout/conexiune refuzată), **sau**
  - latența **p95 > 5000 ms**.
- **Punctul de degradare a latenței** este înregistrat separat ca primul nivel cu **p95 > 1000 ms**.
- **Metrici colectate per nivel:** percentile de latență (p50/p90/p95/p99), latența maximă, rata de erori și throughput-ul real măsurat (req/s).

Endpoint-urile testate au acoperit atât operații read-only publice (`/api/health`, listări de spații, detaliu spațiu), cât și operații autentificate (`/api/bookings`) și operația dependentă de CPU (`/api/auth/login`).

---

## 3. Observația: bottleneck-ul de autentificare

**Sursă:** `stress-test-report-bcryptjs-before.md`

Rezultatele pentru `POST /api/auth/login` au ieșit imediat în evidență ca anomalie:


| Concurență | Cereri | Erori | err% | p50  | p95  | max  | **req/s** |
| ---------- | ------ | ----- | ---- | ---- | ---- | ---- | --------- |
| 5          | 50     | 0     | 0.0% | 341  | 502  | 552  | **13.7**  |
| 10         | 50     | 0     | 0.0% | 597  | 1291 | 1555 | **14.9**  |
| 25         | 75     | 0     | 0.0% | 1139 | 5474 | 5671 | **13.1**  |


*Escaladare oprită la **25** concurenți (p95 = 5474 ms > 5000 ms).*

Limitele înregistrate automat:

- **Throughput maxim:** ~**15 req/s**
- **Concurență maximă sustenabilă:** **10** utilizatori
- **Degradarea latenței:** încă de la **10** concurenți (p95 = 1291 ms)
- **Punct de rupere:** **25** concurenți

### Semnătura clasică „CPU-bound”

Indiciul decisiv a fost: **throughput-ul a rămas plat (~15 req/s) indiferent de concurență.** La 5, 10 sau 25 de utilizatori simultani, serverul procesa tot ~15 cereri pe secundă — singura diferență fiind că latența creștea exploziv pe măsură ce cererile se aglomerau la coadă. Acesta este comportamentul tipic al unei operații care **saturează un singur nucleu de procesor**: capacitatea de lucru este fixă, iar concurența suplimentară doar lungește coada de așteptare.

---

## 4. Diagnosticul la nivelul codului

Inspecția codului sursă a confirmat cauza și a dezvăluit o nuanță importantă.

Autentificarea folosește **bcrypt** pentru verificarea parolei (`backend/src/routes/auth.js`):

```js
if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
  return res.status(401).json({ error: 'Invalid email or password' });
}
```

Costul computațional al bcrypt este **intenționat** — este o măsură de securitate împotriva atacurilor brute-force, configurată la **factorul de cost 10** (`2^10 = 1024` runde), valoarea standard recomandată în industrie. Până aici, lentoarea era justificată.

**Problema reală** era însă alegerea pachetului. Aplicația importa:

```js
import bcrypt from 'bcryptjs';   // ← implementare în JavaScript pur
```

Există două pachete distincte, cu același API dar cu comportament fundamental diferit la rulare:


| Pachet                           | Implementare   | Comportament în Node.js                                                                                                                  |
| -------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `bcryptjs` (cel folosit inițial) | JavaScript pur | Rulează integral pe **firul principal** (event loop). Chiar și cu `await`, calculul nu este paralelizat — blochează singurul fir.        |
| `bcrypt` (binding nativ C++)     | Cod nativ      | Deleagă calculul către **thread pool-ul libuv** (4 fire, implicit). Nu blochează event loop-ul; mai multe verificări rulează în paralel. |


Node.js are un model **single-threaded** pentru execuția JavaScript. Folosind `bcryptjs`, fiecare verificare de parolă monopoliza singurul fir pentru durata întregului calcul (~65 ms), serializând complet autentificările. La ~15 verificări/secundă × 65 ms ≈ 1.0, un nucleu era practic 100% ocupat.

> **Concluzia diagnosticului:** limita de ~15 req/s **nu** era pur și simplu „costul intenționat al bcrypt”. Era costul bcrypt **amplificat de o alegere de implementare sub-optimă** (JavaScript pur în loc de binding nativ). Prima componentă este justificată din securitate; a doua este o ineficiență reparabilă, fără a slăbi securitatea.

---

## 5. Intervenția aplicată

Reparația a fost minimă și fără migrare de date.

**1. Schimbarea pachetului** în cele 3 fișiere care îl foloseau (`auth.js`, `prisma/seed.js`, `prisma/seed-test-users.js`):

```diff
- import bcrypt from 'bcryptjs';
+ import bcrypt from 'bcrypt';
```

API-ul (`bcrypt.hash(...)`, `bcrypt.compare(...)`) este identic, deci nicio altă modificare de cod nu a fost necesară. **Factorul de cost a rămas 10** — securitatea este neschimbată; doar implementarea s-a îmbunătățit.

**2. Actualizarea dependenței** în `package.json`: eliminarea `bcryptjs ^2.4.3`, adăugarea `bcrypt ^6.0.0`.

**3. Compatibilitatea hash-urilor:** ambele pachete implementează **același algoritm** OpenBSD bcrypt și produc același format standard (`$2a$` / `$2b$`). În consecință, parolele deja existente în baza de date (create cândva cu `bcryptjs`) sunt verificate corect de `bcrypt` nativ — **fără re-hash, fără migrare**.

### Validarea schimbării

- ✅ Imaginea Docker s-a reconstruit cu succes (compilarea / încărcarea binarului nativ funcționează pe Alpine Linux).
- ✅ **Test end-to-end:** autentificare reală cu un cont preexistent (`host@example.com`) → răspuns HTTP 200 cu token JWT valid. Acest test dovedește practic compatibilitatea: `bcrypt` nativ a verificat un hash generat anterior de `bcryptjs`.

---

## 6. Re-măsurarea: rezultatul după intervenție

**Sursă:** `stress-test-report-bcrypt-native-after.md`

Același test, aceeași mașină, același cont. Rezultatele pentru `POST /api/auth/login`:


| Concurență | Cereri | Erori | err% | p50  | p95  | max  | **req/s** |
| ---------- | ------ | ----- | ---- | ---- | ---- | ---- | --------- |
| 5          | 50     | 0     | 0.0% | 67   | 99   | 108  | **65.0**  |
| 10         | 50     | 0     | 0.0% | 154  | 217  | 230  | **55.9**  |
| 25         | 75     | 0     | 0.0% | 352  | 402  | 411  | **67.2**  |
| 50         | 150    | 0     | 0.0% | 740  | 798  | 883  | **62.0**  |
| 100        | 300    | 0     | 0.0% | 1505 | 1527 | 1623 | **66.0**  |
| 150        | 300    | 0     | 0.0% | 2192 | 2344 | 2395 | **64.9**  |
| 200        | 300    | 0     | 0.0% | 2424 | 3146 | 3323 | **64.1**  |
| 300        | 300    | 0     | 0.0% | 2383 | 4473 | 4668 | **63.4**  |
| 500        | 300    | 0     | 0.0% | 3724 | 7396 | 7639 | **39.2**  |


*Escaladare oprită la **500** concurenți (p95 = 7396 ms > 5000 ms).*

---

## 7. Comparația înainte / după


| Metrică                            | Înainte (`bcryptjs`) | După (`bcrypt` nativ) | Îmbunătățire    |
| ---------------------------------- | -------------------- | --------------------- | --------------- |
| **Throughput maxim**               | 15 req/s             | **67 req/s**          | **≈ 4.5×**      |
| **Concurență sustenabilă**         | 10                   | **300**               | **30×**         |
| **Punct de degradare (p95 > 1 s)** | 10 conc.             | **100 conc.**         | 10×             |
| **Punct de rupere (p95 > 5 s)**    | 25 conc.             | **500 conc.**         | **20×**         |
| **p95 la 25 de concurenți**        | 5474 ms ⛔            | **402 ms** ✅          | ≈ 13× mai rapid |


La 25 de utilizatori simultani — punctul în care varianta inițială *se rupea* (p95 = 5.4 s) — varianta nativă răspunde în **402 ms** și rezistă confortabil până la **300** de concurenți. Autentificarea a încetat să mai fie o gâtuire catastrofală și a devenit un endpoint normal.

---

## 8. Interpretare: validarea modelului teoretic

Factorul de îmbunătățire a throughput-ului este **67 / 15 ≈ 4.5×**.

Această valoare **nu este întâmplătoare**: corespunde celor **4 fire ale thread pool-ului libuv** (`UV_THREADPOOL_SIZE`, implicit 4). Mutând calculul bcrypt de pe firul principal (un singur fir) pe thread pool (patru fire), patru verificări de parolă rulează acum în paralel — de unde și creșterea de ~4×.

Acesta este un rezultat valoros din punct de vedere metodologic: **măsurătoarea empirică confirmă cantitativ modelul teoretic**. Diagnosticul „`bcryptjs` blochează event loop-ul; `bcrypt` nativ paralelizează pe 4 fire” a prezis un câștig de ~4×, iar testul l-a confirmat (4.5×).

### Observație: cele două regimuri de saturare sunt independente

Endpoint-urile read-only au rămas practic neschimbate între cele două rulări (de ex. listarea de spații: ~206 req/s înainte, ~210 req/s după). Acest lucru era **așteptat și corect**: intervenția a vizat exclusiv regimul **CPU-bound** (bcrypt), nu regimul **I/O-bound** al celorlalte endpoint-uri (limitat de pool-ul de conexiuni la baza de date). Faptul că reparația a afectat *doar* endpoint-ul vizat confirmă că diagnosticul a izolat corect cauza.

---

## 9. Concluzii

1. **Stress testing-ul a expus o limită reală**, nu una presupusă: autentificarea se rupea la doar 25 de utilizatori concurenți, cu un throughput plafonat la ~15 req/s.
2. **Diagnosticul la nivel de cod a separat cauza justificată de cea reparabilă:** costul bcrypt (securitate, de păstrat) vs. implementarea în JavaScript pur (ineficiență, de înlocuit).
3. **Intervenția a fost minimă și sigură:** trei linii de import schimbate, zero modificări de logică, zero migrare de date, securitate (cost 10) neschimbată.
4. **Rezultatul a fost validat cantitativ:** throughput × 4.5, concurență sustenabilă × 30, punct de rupere × 20 — iar factorul de ~4.5× confirmă modelul teoretic al thread pool-ului libuv.

Limita rămasă, de ordinul a ~200 req/s pe endpoint-urile de listare, este de natură **I/O-bound** (dimensiunea pool-ului de conexiuni la PostgreSQL) și constituie o direcție separată de optimizare.

---

### Anexă: fișiere de referință

- Orchestrator stress test: `stress-test/run-local-stress-test.js`
- Raport „înainte” (`bcryptjs`): `stress-test/stress-test-report-bcryptjs-before.md`
- Raport „după” (`bcrypt` nativ): `stress-test/stress-test-report-bcrypt-native-after.md`

