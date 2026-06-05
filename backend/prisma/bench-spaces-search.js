/**
 * Optional: report latency for combined search (amenity + date).
 * Usage: node prisma/bench-spaces-search.js
 */
import request from 'supertest';
import { app } from '../src/index.js';

process.env.NODE_ENV = 'test';

function tomorrowYmd() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function percentile(sorted, p) {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function main() {
  const date = tomorrowYmd();
  const url = `/api/spaces?amenities=wifi&date=${date}&limit=50`;
  const samples = [];
  const n = 30;

  for (let i = 0; i < n; i++) {
    const t0 = performance.now();
    const res = await request(app).get(url);
    const ms = performance.now() - t0;
    if (res.status !== 200) {
      console.error(`Request failed: HTTP ${res.status}`);
      process.exit(1);
    }
    samples.push(ms);
  }

  samples.sort((a, b) => a - b);
  console.log(`Bench GET ${url} (${n} requests, in-process)`);
  console.log(`  min:  ${samples[0].toFixed(1)} ms`);
  console.log(`  p50:  ${percentile(samples, 50).toFixed(1)} ms`);
  console.log(`  p95:  ${percentile(samples, 95).toFixed(1)} ms`);
  console.log(`  max:  ${samples[samples.length - 1].toFixed(1)} ms`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
