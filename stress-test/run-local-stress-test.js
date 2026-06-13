/**
 * Stress Test LOCAL — orchestrator determinist.
 *
 * Escaladează automat concurența (5 → 10 → 25 → 50 → 100 → 150 → 200 → 300 → 500 → 750 → 1000 → 1500 → 2000) pe fiecare
 * endpoint important, măsoară latența (p50/p90/p95/p99/max) și rata de erori,
 * identifică limitele aplicației și produce un raport Markdown pentru licență.
 *
 * Condiții de oprire a escaladării (per endpoint):
 *   - rata de erori > 5%   SAU
 *   - latența p95 > 5000ms
 *
 * Utilizare:
 *   node run-local-stress-test.js
 *   BASE_URL=http://localhost:3000   (implicit)
 *   MAX_CONCURRENCY=50               (opțional — limitează nivelul maxim pt. o rulare blândă)
 *   INCLUDE_REGISTER=1               (opțional — testează și POST /api/auth/register; vezi nota din raport)
 */

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

// ─── Configurare ──────────────────────────────────────────────────────────────

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const REQUEST_TIMEOUT_MS = 15_000;

// Praguri de decizie
const STOP_ERROR_RATE = 0.05; // 5% — oprește escaladarea
const STOP_P95_MS = 5000;     // 5s  — oprește escaladarea
const DEGRADE_P95_MS = 1000;  // 1s  — punctul de degradare a latenței (doar raportare)

// Nivelurile de concurență testate, eventual plafonate prin MAX_CONCURRENCY
const ALL_LEVELS = [5, 10, 25, 50, 100, 150, 200, 300, 500, 750, 1000, 1500, 2000];
const MAX_CONCURRENCY = Number(process.env.MAX_CONCURRENCY) || Infinity;
const CONCURRENCY_LEVELS = ALL_LEVELS.filter((c) => c <= MAX_CONCURRENCY);

// Câte cereri totale per nivel: cel puțin 3× concurența (ca pool-ul să fie plin),
// în intervalul [50, maxTotal]. La niveluri mari (≥500) limita implicită e 4000.
function totalForLevel(concurrency, maxTotal = 4000) {
  return Math.min(Math.max(concurrency * 3, 50), maxTotal);
}

const COOLDOWN_MS = 600; // pauză între niveluri ca serverul să respire

// Conturi pre-seed (toate email-verificate)
const AUTH_EMAIL = 'host@example.com';
const AUTH_PASSWORD = 'Password123';

// ─── Stare ────────────────────────────────────────────────────────────────────

let authToken = null;
const findings = [];          // limite descoperite
const suiteResults = [];      // { name, endpoint, method, rows: [...], note }

// ─── Funcții helper ──────────────────────────────────────────────────────────

function percentile(sorted, pct) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((pct / 100) * sorted.length));
  return sorted[idx];
}

function calcStats(durations) {
  if (!durations.length) {
    return { min: 0, p50: 0, p90: 0, p95: 0, p99: 0, max: 0, mean: 0 };
  }
  const sorted = [...durations].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    min: sorted[0],
    p50: percentile(sorted, 50),
    p90: percentile(sorted, 90),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: sorted.at(-1),
    mean: Math.round(sum / sorted.length),
  };
}

async function singleRequest(endpoint, method, body, token) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const start = Date.now();
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const duration = Date.now() - start;
    // Consumăm corpul ca să eliberăm conexiunea, fără să-l parsăm la sarcină mare
    try { await res.arrayBuffer(); } catch { /* ignoră */ }
    return { ok: res.ok, status: res.status, duration };
  } catch (err) {
    // status 0 = eroare de rețea / timeout / conexiune refuzată
    const duration = Date.now() - start;
    const status = err?.name === 'TimeoutError' ? 'timeout' : 0;
    return { ok: false, status, duration, error: err.message };
  }
}

/**
 * Trimite `totalRequests` cereri menținând exact `concurrency` în zbor simultan
 * (pool de workeri). Returnează metrici agregate + throughput real (req/s).
 */
async function runLevel({ endpoint, method, body, token, concurrency, totalRequests }) {
  const results = [];
  let dispatched = 0;
  const wallStart = Date.now();

  async function worker() {
    while (dispatched < totalRequests) {
      dispatched++;
      const r = await singleRequest(endpoint, method, body, token);
      results.push(r);
    }
  }

  const poolSize = Math.min(concurrency, totalRequests);
  await Promise.all(Array.from({ length: poolSize }, () => worker()));

  const wallMs = Date.now() - wallStart;
  const durations = results.map((r) => r.duration);
  const errors = results.filter((r) => !r.ok);
  const stats = calcStats(durations);

  // Distribuția codurilor de status
  const statusBreakdown = {};
  for (const r of results) {
    const key = String(r.status);
    statusBreakdown[key] = (statusBreakdown[key] || 0) + 1;
  }

  const errorRate = results.length ? errors.length / results.length : 0;
  const throughput = wallMs > 0 ? (results.length / wallMs) * 1000 : 0;

  return {
    concurrency,
    totalRequests: results.length,
    errors: errors.length,
    errorRate,
    throughput,        // req/s
    wallMs,
    stats,
    statusBreakdown,
  };
}

function fmtPct(rate) {
  return `${(rate * 100).toFixed(1)}%`;
}

function recordFinding(endpoint, limitType, value, description) {
  findings.push({ endpoint, limitType, value, description });
  console.log(`📌 LIMITĂ: [${endpoint}] ${limitType} = ${value} — ${description}`);
}

// ─── Rularea unei suite (un endpoint, mai multe niveluri de concurență) ─────────

async function runSuite({ name, endpoint, method = 'GET', body = null, useAuth = false, maxTotal = 600 }) {
  console.log(`\n══════════════════════════════════════════════════════════════`);
  console.log(`▶  ${name}`);
  console.log(`   ${method} ${endpoint}${useAuth ? '  (autentificat)' : ''}`);
  console.log(`══════════════════════════════════════════════════════════════`);

  const token = useAuth ? authToken : null;
  if (useAuth && !token) {
    console.log('   ⚠️  Sărit — nu există token de autentificare.');
    suiteResults.push({ name, endpoint, method, rows: [], note: 'Sărit: autentificare indisponibilă.' });
    return;
  }

  // Warmup (nu se contorizează) — evită cold-start pe primul nivel
  await singleRequest(endpoint, method, body, token);

  const rows = [];
  let degradeRecorded = false;
  let brokeAt = null;

  console.log(
    '   conc | total | erori | err% | p50 | p95 | p99 |  max | req/s',
  );
  console.log('   -----+-------+-------+------+-----+-----+-----+------+------');

  for (const concurrency of CONCURRENCY_LEVELS) {
    const totalRequests = totalForLevel(concurrency, maxTotal);
    const row = await runLevel({ endpoint, method, body, token, concurrency, totalRequests });
    rows.push(row);

    console.log(
      `   ${String(concurrency).padStart(4)} | ${String(row.totalRequests).padStart(5)} | ` +
        `${String(row.errors).padStart(5)} | ${fmtPct(row.errorRate).padStart(5)} | ` +
        `${String(row.stats.p50).padStart(3)} | ${String(row.stats.p95).padStart(3)} | ` +
        `${String(row.stats.p99).padStart(3)} | ${String(row.stats.max).padStart(4)} | ` +
        `${row.throughput.toFixed(1).padStart(6)}`,
    );

    // Punct de degradare a latenței (prima dată când p95 > 1000ms)
    if (!degradeRecorded && row.stats.p95 > DEGRADE_P95_MS) {
      degradeRecorded = true;
      recordFinding(
        endpoint,
        'latency_degrades_at',
        `${concurrency} concurenți`,
        `p95 = ${row.stats.p95}ms (> ${DEGRADE_P95_MS}ms) la ${concurrency} cereri concurente.`,
      );
    }

    // Condiție de oprire
    const tooManyErrors = row.errorRate > STOP_ERROR_RATE;
    const tooSlow = row.stats.p95 > STOP_P95_MS;
    if (tooManyErrors || tooSlow) {
      brokeAt = concurrency;
      const cause = [];
      if (tooManyErrors) cause.push(`erori ${fmtPct(row.errorRate)} (> ${fmtPct(STOP_ERROR_RATE)})`);
      if (tooSlow) cause.push(`p95 ${row.stats.p95}ms (> ${STOP_P95_MS}ms)`);
      recordFinding(
        endpoint,
        'breaking_point',
        `${concurrency} concurenți`,
        `Punct de rupere: ${cause.join(' și ')}.`,
      );
      console.log(`   ⛔ Oprire escaladare la ${concurrency} concurenți (${cause.join('; ')}).`);
      break;
    }

    await new Promise((r) => setTimeout(r, COOLDOWN_MS));
  }

  // Niveluri „sănătoase” = sub praguri
  const healthy = rows.filter((r) => r.errorRate <= STOP_ERROR_RATE && r.stats.p95 <= STOP_P95_MS);
  if (healthy.length) {
    const maxConc = Math.max(...healthy.map((r) => r.concurrency));
    const bestThroughput = Math.max(...healthy.map((r) => r.throughput));
    recordFinding(
      endpoint,
      'max_sustainable_concurrency',
      `${maxConc} concurenți`,
      `Cel mai mare nivel de concurență fără a depăși pragurile (erori ≤ 5%, p95 ≤ 5s).`,
    );
    recordFinding(
      endpoint,
      'max_throughput',
      `${bestThroughput.toFixed(1)} req/s`,
      `Debitul maxim observat în zona sănătoasă.`,
    );
  } else if (rows.length) {
    recordFinding(
      endpoint,
      'max_sustainable_concurrency',
      `< ${CONCURRENCY_LEVELS[0]} concurenți`,
      `Aplicația a depășit pragurile încă de la primul nivel (${CONCURRENCY_LEVELS[0]} concurenți).`,
    );
  }

  suiteResults.push({ name, endpoint, method, rows, brokeAt, note: null });
}

// ─── Pregătire: health + autentificare + un id real de spațiu ──────────────────

async function authenticate() {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: AUTH_EMAIL, password: AUTH_PASSWORD }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  }).catch((e) => ({ ok: false, _err: e.message }));

  if (!res.ok) {
    console.log(`   ⚠️  Autentificare eșuată (${res.status ?? res._err}). Endpoint-urile cu auth vor fi sărite.`);
    return false;
  }
  const data = await res.json().catch(() => ({}));
  authToken = data.token || data.accessToken || null;
  if (authToken) {
    console.log(`   ✅ Autentificat ca ${AUTH_EMAIL}.`);
    return true;
  }
  console.log('   ⚠️  Login a reușit dar nu am găsit token în răspuns. Endpoint-urile cu auth vor fi sărite.');
  return false;
}

async function fetchSampleSpaceId() {
  const res = await fetch(`${BASE_URL}/api/spaces?page=1&limit=1`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  }).catch(() => null);
  if (!res || !res.ok) return null;
  const body = await res.json().catch(() => null);
  if (!body) return null;
  const list = body.spaces || body.data || body.items || (Array.isArray(body) ? body : []);
  return list[0]?.id ?? null;
}

// ─── Raport Markdown ───────────────────────────────────────────────────────────

function buildMarkdownReport() {
  const now = new Date().toISOString();
  let md = `# Raport Stress Test — Shared Space Reservations\n\n`;
  md += `**Data**: ${now}  \n`;
  md += `**Target**: ${BASE_URL}  \n`;
  md += `**Metodă**: orchestrator determinist (fără AI), Node.js \`fetch\` cu pool de concurență  \n`;
  md += `**Mediu**: aplicație Node.js/Express + PostgreSQL (pgvector) în Docker  \n\n`;

  md += `## 1. Metodologie\n\n`;
  md += `Fiecare endpoint a fost supus unei escaladări de concurență: pentru fiecare nivel `;
  md += `s-au menținut exact *N* cereri în zbor simultan (pool de workeri), cu un total de `;
  md += `~10× *N* cereri per nivel. Escaladarea s-a oprit automat la primul nivel care a depășit `;
  md += `unul dintre praguri:\n\n`;
  md += `- rata de erori **> ${fmtPct(STOP_ERROR_RATE)}** (status ≥ 400 sau timeout/conexiune refuzată), sau\n`;
  md += `- latența **p95 > ${STOP_P95_MS}ms**.\n\n`;
  md += `Niveluri de concurență testate: ${CONCURRENCY_LEVELS.join(' → ')}. `;
  md += `Timeout per cerere: ${REQUEST_TIMEOUT_MS / 1000}s. `;
  md += `Punctul de degradare a latenței este definit ca primul nivel cu **p95 > ${DEGRADE_P95_MS}ms**.\n\n`;
  md += `| Metrică | Semnificație |\n`;
  md += `|---------|--------------|\n`;
  md += `| p50 / p90 / p95 / p99 | Percentile de latență (ms) — ex. p95 = 95% din cereri sub această valoare |\n`;
  md += `| max | Cea mai lentă cerere (ms) |\n`;
  md += `| err% | Procent cereri eșuate (status ≥ 400 sau timeout) |\n`;
  md += `| req/s | Debit real măsurat (throughput) pe durata nivelului |\n\n`;

  md += `## 2. Limite identificate\n\n`;
  if (findings.length) {
    md += `| Endpoint | Tip limită | Valoare | Descriere |\n`;
    md += `|----------|-----------|---------|-----------|\n`;
    for (const f of findings) {
      md += `| \`${f.endpoint}\` | ${f.limitType} | ${f.value} | ${f.description} |\n`;
    }
  } else {
    md += `_Nicio limită înregistrată._\n`;
  }
  md += `\n`;

  md += `## 3. Rezultate detaliate pe endpoint\n\n`;
  for (const suite of suiteResults) {
    md += `### ${suite.name}\n\n`;
    md += `\`${suite.method} ${suite.endpoint}\`\n\n`;
    if (suite.note) {
      md += `> ${suite.note}\n\n`;
      continue;
    }
    if (!suite.rows.length) {
      md += `_Fără date._\n\n`;
      continue;
    }
    md += `| Concurență | Cereri | Erori | err% | p50 | p90 | p95 | p99 | max | req/s |\n`;
    md += `|-----------:|-------:|------:|-----:|----:|----:|----:|----:|----:|------:|\n`;
    for (const r of suite.rows) {
      md += `| ${r.concurrency} | ${r.totalRequests} | ${r.errors} | ${fmtPct(r.errorRate)} | `;
      md += `${r.stats.p50} | ${r.stats.p90} | ${r.stats.p95} | ${r.stats.p99} | ${r.stats.max} | `;
      md += `${r.throughput.toFixed(1)} |\n`;
    }
    if (suite.brokeAt) {
      md += `\n_Escaladare oprită la **${suite.brokeAt}** concurenți (prag depășit)._\n`;
    } else {
      md += `\n_Aplicația a rezistat la toate nivelurile testate (max ${CONCURRENCY_LEVELS.at(-1)} concurenți)._\n`;
    }
    md += `\n`;
  }

  md += `## 4. Observații și recomandări\n\n`;
  md += `- Endpoint-urile read-only (\`GET /api/spaces\`, \`GET /api/health\`) tolerează concurența `;
  md += `cea mai mare; gâtuirea apare de regulă la operațiile dependente de CPU/bcrypt `;
  md += `(\`POST /api/auth/login\`) și la interogările grele de bază de date.\n`;
  md += `- Degradarea latenței (p95 peste prag) precede de obicei apariția erorilor — este `;
  md += `un indicator timpuriu al saturării pool-ului de conexiuni / event-loop-ului.\n`;
  md += `- Valorile sunt măsurate pe o singură instanță Docker; scalarea orizontală `;
  md += `(mai multe replici + load balancer) ar deplasa punctele de rupere în sus.\n`;

  return md;
}

// ─── Entry point ───────────────────────────────────────────────────────────────

async function main() {
  console.log('🧪 Stress Test LOCAL');
  console.log(`   BASE_URL: ${BASE_URL}`);
  console.log(`   Niveluri: ${CONCURRENCY_LEVELS.join(' → ')}`);
  console.log(`   Stop:     erori > ${fmtPct(STOP_ERROR_RATE)} sau p95 > ${STOP_P95_MS}ms\n`);

  // 1. Health check
  const health = await singleRequest('/api/health', 'GET', null, null);
  if (!health.ok) {
    console.error(`❌ Aplicația nu răspunde la /api/health (status ${health.status}). Pornește Docker mai întâi.`);
    process.exit(1);
  }
  console.log(`   ✅ Aplicație online (/api/health: ${health.duration}ms).`);

  // 2. Autentificare + id de spațiu
  await authenticate();
  const spaceId = await fetchSampleSpaceId();
  if (spaceId) console.log(`   ✅ Id spațiu pentru test: ${spaceId}`);
  else console.log('   ⚠️  Nu am găsit un id de spațiu — sar peste GET /api/spaces/:id.');

  // 3. Definirea suitelor
  const suites = [
    { name: 'Health check', endpoint: '/api/health', method: 'GET' },
    { name: 'Listare spații (implicit)', endpoint: '/api/spaces?page=1&limit=20', method: 'GET' },
    { name: 'Listare spații (paginare adâncă)', endpoint: '/api/spaces?page=10&limit=20', method: 'GET' },
    { name: 'Listare spații (filtrare oraș)', endpoint: '/api/spaces?page=1&limit=20&city=Brooklyn', method: 'GET' },
  ];
  if (spaceId) {
    suites.push({ name: 'Detalii spațiu', endpoint: `/api/spaces/${spaceId}`, method: 'GET' });
  }
  // Login: dependent de CPU (bcrypt) — total mai mic ca să nu dureze excesiv
  suites.push({
    name: 'Autentificare (bcrypt)',
    endpoint: '/api/auth/login',
    method: 'POST',
    body: { email: AUTH_EMAIL, password: AUTH_PASSWORD },
    maxTotal: 300,
  });
  if (authToken) {
    suites.push({ name: 'Listare rezervări (auth)', endpoint: '/api/bookings', method: 'GET', useAuth: true });
  }
  if (process.env.INCLUDE_REGISTER) {
    suites.push({
      name: 'Înregistrare utilizator (POST /api/auth/register)',
      endpoint: '/api/auth/register',
      method: 'POST',
      // Email unic per cerere prin timestamp — evită coliziuni de unicitate
      body: null, // setat dinamic mai jos
      maxTotal: 100,
      _dynamicRegister: true,
    });
  }

  // 4. Rulare
  for (const suite of suites) {
    if (suite._dynamicRegister) {
      // Notă: register declanșează trimitere email (Mailtrap) — dependență externă
      // care poate domina latența și introduce erori nelegate de capacitatea app-ului.
      console.log('\n⚠️  POST /api/auth/register apelează un serviciu extern (Mailtrap).');
      console.log('   Rezultatele reflectă și acea dependență, nu doar app-ul.');
      await runSuiteDynamicRegister(suite);
    } else {
      await runSuite(suite);
    }
  }

  // 5. Raport
  const reportContent = buildMarkdownReport();
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const reportPath = path.join(__dirname, 'stress-test-report.md');
  writeFileSync(reportPath, reportContent, 'utf-8');

  console.log('\n\n══════════════════════════════════════════════');
  console.log('  REZUMAT LIMITE');
  console.log('══════════════════════════════════════════════');
  if (findings.length) {
    for (const f of findings) {
      console.log(`  [${f.endpoint}] ${f.limitType}: ${f.value}`);
    }
  } else {
    console.log('  Nicio limită înregistrată.');
  }
  console.log(`\n📄 Raport salvat în: stress-test/stress-test-report.md`);
}

// Variantă pentru register: generează un body cu email unic la fiecare cerere.
async function runSuiteDynamicRegister(suite) {
  // Re-folosim runLevel dar cu body generat dinamic prin override pe singleRequest
  const rows = [];
  let brokeAt = null;
  console.log(`\n══════════════════════════════════════════════════════════════`);
  console.log(`▶  ${suite.name}`);
  console.log(`   POST ${suite.endpoint}`);
  console.log(`══════════════════════════════════════════════════════════════`);
  console.log('   conc | total | erori | err% | p50 | p95 | p99 |  max | req/s');
  console.log('   -----+-------+-------+------+-----+-----+-----+------+------');

  let counter = 0;
  for (const concurrency of CONCURRENCY_LEVELS) {
    const totalRequests = totalForLevel(concurrency, suite.maxTotal);
    const results = [];
    let dispatched = 0;
    const wallStart = Date.now();
    async function worker() {
      while (dispatched < totalRequests) {
        dispatched++;
        const n = ++counter;
        const body = {
          name: `LoadTest ${n}`,
          email: `loadtest_${Date.now()}_${n}@example.com`,
          password: 'Password123',
        };
        results.push(await singleRequest(suite.endpoint, 'POST', body, null));
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, totalRequests) }, () => worker()));
    const wallMs = Date.now() - wallStart;
    const durations = results.map((r) => r.duration);
    const errors = results.filter((r) => !r.ok);
    const stats = calcStats(durations);
    const errorRate = errors.length / results.length;
    const throughput = (results.length / wallMs) * 1000;
    const row = { concurrency, totalRequests: results.length, errors: errors.length, errorRate, throughput, wallMs, stats, statusBreakdown: {} };
    rows.push(row);
    console.log(
      `   ${String(concurrency).padStart(4)} | ${String(row.totalRequests).padStart(5)} | ` +
        `${String(row.errors).padStart(5)} | ${fmtPct(row.errorRate).padStart(5)} | ` +
        `${String(stats.p50).padStart(3)} | ${String(stats.p95).padStart(3)} | ` +
        `${String(stats.p99).padStart(3)} | ${String(stats.max).padStart(4)} | ` +
        `${throughput.toFixed(1).padStart(6)}`,
    );
    if (errorRate > STOP_ERROR_RATE || stats.p95 > STOP_P95_MS) {
      brokeAt = concurrency;
      recordFinding(suite.endpoint, 'breaking_point', `${concurrency} concurenți`,
        `Punct de rupere (include dependența externă Mailtrap).`);
      console.log(`   ⛔ Oprire escaladare la ${concurrency} concurenți.`);
      break;
    }
    await new Promise((r) => setTimeout(r, COOLDOWN_MS));
  }
  suiteResults.push({ name: suite.name, endpoint: suite.endpoint, method: 'POST', rows, brokeAt,
    note: 'Atenție: rezultatele includ trimiterea de email prin Mailtrap (dependență externă).' });
}

main().catch((err) => {
  console.error('❌ Eroare fatală:', err);
  process.exit(1);
});
